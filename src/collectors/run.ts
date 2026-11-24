// Collection entry point.
//   npm run collect              every store
//   npm run collect -- eshop     only the named stores
//   npm run collect -- --skip eshop   every store except the ones after --skip
//   npm run collect -- --minutes 20   stop each store after about 20 minutes
//   npm run collect -- --all          read every game, even ones checked recently
//   npm run collect -- --games a,b    read only these games (by slug), now
//
// Games are read most-overdue first, and ones checked recently enough are left
// for a later run (see schedule.ts).
//                                (ps_store, eshop, xbox_store, coupang)
// Coupang is skipped, with a note, until its API keys are set.
import { eq, sql } from 'drizzle-orm';
import { closeDb, db } from '../db';
import { ensureReferenceData } from '../db/reference';
import * as s from '../db/schema';
import { deactivateMissingDiscListings, deactivateMissingListings, recordObservation } from './record';
import { collectCoupang } from './retail/coupang';
import type { DiscSpec } from './retail/match';
import { collectNintendo } from './stores/nintendo';
import { collectPlayStation } from './stores/playstation';
import { collectXbox } from './stores/xbox';
import { plan, type GameState } from './schedule';
import { loadTracked } from './all-tracked';
import { TRACKED, type TrackedGame } from './tracked';
import type { Observation } from './types';

const REGION = 'KR';
const DELAY_MS = 3000; // pause between requests to the same store

type Region = typeof s.regions.$inferSelect;
type StoreCollector = {
  store: string; // stores.code
  idOf: (game: TrackedGame) => string | undefined;
  collect: (id: string, region: Region, game: TrackedGame) => Promise<Observation[]>;
  delayMs?: number; // pause between requests, when a store needs more than the default
  maxPerRun?: number; // most pages to read in one run
};

const COLLECTORS: StoreCollector[] = [
  {
    store: 'ps_store',
    idOf: (g) => g.psConceptId,
    // ko-KR -> ko-kr, as the store's addresses use
    collect: (id, r, g) =>
      collectPlayStation(id, { locale: r.locale.toLowerCase(), currency: r.currency, match: g.match?.ps_store }),
  },
  {
    store: 'eshop',
    idOf: (g) => g.eshopId,
    // This store starts refusing a connection (403) after roughly 200 pages in
    // quick succession, so it is read more slowly and in smaller batches.
    delayMs: 6000,
    maxPerRun: 120,
    collect: (id, r) => collectNintendo(id, { regionCode: r.code, currency: r.currency }),
  },
  {
    store: 'xbox_store',
    idOf: (g) => g.xboxProductId,
    collect: (id, r, g) => collectXbox(id, { locale: r.locale, currency: r.currency, match: g.match?.xbox_store }),
  },
];

// Shopping sites: one search per boxed edition of each tracked game.
type RetailCollector = {
  store: string;
  missingKeys: () => string[]; // names of unset environment variables
  delayMs: number;
  maxPerRun?: number; // for APIs that allow only a few calls
  collect: (spec: DiscSpec) => Promise<Observation[]>;
};

const env = (name: string) => process.env[name] ?? '';
const unset = (...names: string[]) => names.filter((n) => !env(n));

const RETAIL: RetailCollector[] = [
  {
    store: 'coupang',
    missingKeys: () => unset('COUPANG_ACCESS_KEY', 'COUPANG_SECRET_KEY'),
    delayMs: 3000,
    // Coupang Partners limits product searches to about 10 an hour. With more
    // boxed editions than that, each run covers a different slice (see below).
    maxPerRun: 10,
    collect: (spec) => collectCoupang(spec, { accessKey: env('COUPANG_ACCESS_KEY'), secretKey: env('COUPANG_SECRET_KEY') }),
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gameIdFor(game: TrackedGame, seen: Observation) {
  const [existing] = await db.select().from(s.games).where(eq(s.games.slug, game.slug));
  if (!existing) {
    const [created] = await db
      .insert(s.games)
      .values({
        slug: game.slug,
        title: game.title,
        coverUrl: seen.coverUrl,
        publisher: seen.publisher,
        genre: seen.genre,
        releaseDate: seen.releaseDate ?? null,
      })
      .returning();
    return created.id;
  }
  await db
    .update(s.games)
    .set({
      title: game.title,
      coverUrl: existing.coverUrl ?? seen.coverUrl,
      publisher: existing.publisher ?? seen.publisher,
      genre: existing.genre ?? seen.genre,
      // Stores can differ (a later port, a re-release): keep the earliest.
      releaseDate:
        existing.releaseDate && seen.releaseDate
          ? existing.releaseDate < seen.releaseDate
            ? existing.releaseDate
            : seen.releaseDate
          : (existing.releaseDate ?? seen.releaseDate ?? null),
    })
    .where(eq(s.games.id, existing.id));
  return existing.id;
}

type RunOptions = { minutes: number | null; all: boolean; games: string[] | null };

// What is known about each game on one store, by slug: when it was last read,
// when its price last changed, and whether it is on sale there.
async function storeStates(storeId: number, regionId: number): Promise<Map<string, GameState>> {
  const result = await db.execute(sql`
    select g.slug, g.release_date,
           max(l.last_checked_at) as checked_at,
           max(latest.observed_at) as changed_at,
           coalesce(bool_or(latest.sale_price is not null), false) as on_sale
    from games g
    join products p on p.game_id = g.id and p.format = 'digital'
    join listings l on l.product_id = p.id and l.store_id = ${storeId} and l.region_id = ${regionId}
    left join lateral (
      select sale_price, observed_at from price_points
      where listing_id = l.id order by observed_at desc, id desc limit 1
    ) latest on true
    group by g.slug, g.release_date
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Record<string, unknown>[];
  const date = (v: unknown) => (v ? new Date(v as string | Date) : null);
  return new Map(
    rows.map((r) => [
      r.slug as string,
      {
        checkedAt: date(r.checked_at),
        changedAt: date(r.changed_at),
        onSale: r.on_sale === true || r.on_sale === 't',
        releaseDate: r.release_date ? String(r.release_date).slice(0, 10) : null,
      },
    ]),
  );
}

// Collect one store. Returns the number of games that failed.
async function runStore(collector: StoreCollector, region: Region, all: TrackedGame[], opts: RunOptions): Promise<number> {
  const [store] = await db.select().from(s.stores).where(eq(s.stores.code, collector.store));
  const tracked = all.filter((g) => collector.idOf(g) && (!opts.games || opts.games.includes(g.slug)));
  const states = opts.all || opts.games ? new Map<string, GameState>() : await storeStates(store.id, region.id);
  const { due: games, hot, resting } = plan(
    tracked.map((g) => ({ item: g, state: states.get(g.slug) })),
    new Date(),
  );
  const deadline = opts.minutes === null ? Infinity : Date.now() + opts.minutes * 60_000;
  let read = 0;
  let checked = 0;
  let changed = 0;
  let failed = 0;

  let refused = false;
  for (const [i, game] of games.entries()) {
    if (Date.now() >= deadline) break; // out of time: the rest is first in line next run
    if (collector.maxPerRun && read >= collector.maxPerRun) break;
    if (i > 0) await sleep(collector.delayMs ?? DELAY_MS);
    read += 1;
    try {
      const observations = await collector.collect(collector.idOf(game)!, region, game);
      if (observations.length === 0) throw new Error('no priced products found on the page');
      // This store only sells a bigger edition: file the price under that edition's name.
      const onlyEdition = game.onlyEdition?.[collector.store as keyof NonNullable<TrackedGame['onlyEdition']>];
      if (onlyEdition) {
        for (const o of observations) if (o.edition === 'standard') o.edition = onlyEdition;
      }
      const first = observations.find((o) => o.edition === 'standard') ?? observations[0];
      const gameId = await gameIdFor(game, first);
      const now = new Date();
      for (const obs of observations) {
        const events = await recordObservation(
          db,
          { storeId: store.id, regionId: region.id, gameId, locale: region.locale, currency: region.currency, now },
          obs,
        );
        checked += 1;
        if (events.length > 0) changed += 1;
        for (const e of events) console.log(`  ${game.title} [${obs.edition}] ${e.type}: ${e.note}`);
      }
      // Editions the page no longer offers stop being shown; their history is kept.
      await deactivateMissingListings(
        db,
        { storeId: store.id, regionId: region.id, gameId },
        observations.map((o) => o.storeProductId),
      );
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ${game.title} failed: ${message}`);
      // The store is turning this connection away. Asking again only makes it
      // worse: stop here and let the next run pick up where this one left off.
      if (/responded (403|429)\b/.test(message)) {
        refused = true;
        break;
      }
    }
  }
  if (refused) console.error(`  ${store.name} is refusing requests for now; stopped early.`);
  const left = games.length - read;
  console.log(
    `${store.name} ${region.code}: ${read} of ${tracked.length} games read` +
      (opts.all || opts.games ? '' : ` (${hot} on the frequent schedule, ${resting} not due yet${left > 0 ? `, ${left} left for the next run` : ''})`) +
      `, ${checked} listings checked, ${changed} changed, ${failed} failed.`,
  );
  return failed;
}

// Collect one shopping site. Returns the number of searches that failed.
async function runRetail(collector: RetailCollector, region: Region, asked: boolean): Promise<number> {
  const [store] = await db.select().from(s.stores).where(eq(s.stores.code, collector.store));
  const missing = collector.missingKeys();
  if (missing.length > 0) {
    console.log(`${store.name} ${region.code}: skipped, ${missing.join(' and ')} not set in .env.`);
    return asked ? 1 : 0; // only an error when this store was asked for by name
  }

  let jobs = TRACKED.flatMap((game) => (game.discs ?? []).map((spec) => ({ game, spec })));
  const total = jobs.length;
  if (collector.maxPerRun && total > collector.maxPerRun) {
    // Start one slice further each day so every edition gets its turn.
    const day = Math.floor(Date.now() / 86_400_000);
    const start = (day * collector.maxPerRun) % total;
    jobs = [...jobs.slice(start), ...jobs.slice(0, start)].slice(0, collector.maxPerRun);
  }

  let checked = 0;
  let changed = 0;
  let failed = 0;
  let empty = 0;
  for (const [i, { game, spec }] of jobs.entries()) {
    if (i > 0) await sleep(collector.delayMs);
    try {
      const observations = await collector.collect(spec);
      if (observations.length === 0) {
        // Not an error: the game may simply not be on sale there. Keep what we had.
        empty += 1;
        console.log(`  ${game.title} [${spec.platform}] no matching offers`);
        continue;
      }
      const gameId = await gameIdFor(game, observations[0]);
      const now = new Date();
      for (const obs of observations) {
        const events = await recordObservation(
          db,
          { storeId: store.id, regionId: region.id, gameId, locale: region.locale, currency: region.currency, now },
          obs,
        );
        checked += 1;
        if (events.length > 0) changed += 1;
        for (const e of events) console.log(`  ${game.title} [${spec.platform} disc, ${obs.sellerName ?? store.name}] ${e.type}: ${e.note}`);
      }
      await deactivateMissingDiscListings(
        db,
        { storeId: store.id, regionId: region.id, gameId, platform: spec.platform },
        observations.map((o) => o.storeProductId),
      );
    } catch (err) {
      failed += 1;
      console.error(`  ${game.title} [${spec.platform}] failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(
    `${store.name} ${region.code}: ${jobs.length} of ${total} searches, ${checked} offers checked, ${changed} changed, ${empty} without offers, ${failed} failed.`,
  );
  return failed;
}

async function main() {
  // Store names before any flag are the ones to collect; names after --skip are left out.
  const only: string[] = [];
  const skip: string[] = [];
  const opts: RunOptions = { minutes: null, all: false, games: null };
  let into = only;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skip') into = skip;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--games') opts.games = (args[++i] ?? '').split(',').filter(Boolean);
    else if (arg === '--minutes') {
      opts.minutes = Number(args[++i]);
      if (!(opts.minutes > 0)) throw new Error('--minutes needs a number, for example --minutes 20');
    } else into.push(arg);
  }
  const unknown = [...only, ...skip].filter((code) => ![...COLLECTORS, ...RETAIL].some((c) => c.store === code));
  if (unknown.length > 0) throw new Error(`Unknown store: ${unknown.join(', ')}`);

  await ensureReferenceData(db);
  const [region] = await db.select().from(s.regions).where(eq(s.regions.code, REGION));

  // The hand-picked games plus the ones discovery added (see discover.ts).
  const tracked = await loadTracked(db);

  let failed = 0;
  for (const collector of COLLECTORS) {
    if (skip.includes(collector.store) || (only.length > 0 && !only.includes(collector.store))) continue;
    failed += await runStore(collector, region, tracked, opts);
  }
  for (const collector of RETAIL) {
    if (skip.includes(collector.store) || (only.length > 0 && !only.includes(collector.store))) continue;
    if (region.code !== 'KR') continue; // Korean shops only
    failed += await runRetail(collector, region, only.includes(collector.store));
  }
  await closeDb();
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
