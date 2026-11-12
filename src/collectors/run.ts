// Daily collection entry point.
//   npm run collect              every store
//   npm run collect -- eshop     only the named stores
//                                (ps_store, eshop, xbox_store, coupang)
// Coupang is skipped, with a note, until its API keys are set.
import { eq } from 'drizzle-orm';
import { closeDb, db } from '../db';
import { ensureReferenceData } from '../db/reference';
import * as s from '../db/schema';
import { deactivateMissingDiscListings, recordObservation } from './record';
import { collectCoupang } from './retail/coupang';
import type { DiscSpec } from './retail/match';
import { collectNintendo } from './stores/nintendo';
import { collectPlayStation } from './stores/playstation';
import { collectXbox } from './stores/xbox';
import { TRACKED, type TrackedGame } from './tracked';
import type { Observation } from './types';

const REGION = 'KR';
const DELAY_MS = 3000; // pause between requests to the same store

type Region = typeof s.regions.$inferSelect;
type StoreCollector = {
  store: string; // stores.code
  idOf: (game: TrackedGame) => string | undefined;
  collect: (id: string, region: Region) => Promise<Observation[]>;
};

const COLLECTORS: StoreCollector[] = [
  {
    store: 'ps_store',
    idOf: (g) => g.psConceptId,
    // ko-KR -> ko-kr, as the store's addresses use
    collect: (id, r) => collectPlayStation(id, { locale: r.locale.toLowerCase(), currency: r.currency }),
  },
  {
    store: 'eshop',
    idOf: (g) => g.eshopId,
    collect: (id, r) => collectNintendo(id, { regionCode: r.code, currency: r.currency }),
  },
  {
    store: 'xbox_store',
    idOf: (g) => g.xboxProductId,
    collect: (id, r) => collectXbox(id, { locale: r.locale, currency: r.currency }),
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
    })
    .where(eq(s.games.id, existing.id));
  return existing.id;
}

// Collect one store. Returns the number of games that failed.
async function runStore(collector: StoreCollector, region: Region): Promise<number> {
  const [store] = await db.select().from(s.stores).where(eq(s.stores.code, collector.store));
  const games = TRACKED.filter((g) => collector.idOf(g));
  let checked = 0;
  let changed = 0;
  let failed = 0;

  for (const [i, game] of games.entries()) {
    if (i > 0) await sleep(DELAY_MS);
    try {
      const observations = await collector.collect(collector.idOf(game)!, region);
      if (observations.length === 0) throw new Error('no priced products found on the page');
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
    } catch (err) {
      failed += 1;
      console.error(`  ${game.title} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`${store.name} ${region.code}: ${games.length} games, ${checked} listings checked, ${changed} changed, ${failed} failed.`);
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
  const only = process.argv.slice(2);
  const unknown = only.filter((code) => ![...COLLECTORS, ...RETAIL].some((c) => c.store === code));
  if (unknown.length > 0) throw new Error(`Unknown store: ${unknown.join(', ')}`);

  await ensureReferenceData(db);
  const [region] = await db.select().from(s.regions).where(eq(s.regions.code, REGION));

  let failed = 0;
  for (const collector of COLLECTORS) {
    if (only.length > 0 && !only.includes(collector.store)) continue;
    failed += await runStore(collector, region);
  }
  for (const collector of RETAIL) {
    if (only.length > 0 && !only.includes(collector.store)) continue;
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
