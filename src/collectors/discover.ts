// Finds games worth tracking on the stores' own lists and adds them, so the
// catalog grows without editing tracked.ts. The next collection reads them.
//   npm run discover                    every store
//   npm run discover -- ps_store        only the named stores
//   npm run discover -- --max 5         add at most 5 games per store (default 10)
//   npm run discover -- --dry-run       say what would be added, change nothing
//
// Each item a list shows is judged once and remembered in discovery_seen. A
// candidate is added only if its own store page reads like any tracked game
// does: a console game with a price. When its name matches a game already
// tracked from another store, the store id joins that game instead of starting
// a new one. See sources.ts for which lists are read and why.
import { eq } from 'drizzle-orm';
import { closeDb, db } from '../db';
import { ensureReferenceData } from '../db/reference';
import * as s from '../db/schema';
import { loadTracked } from './all-tracked';
import {
  cleanTitle,
  conceptFromGamePage,
  fetchText,
  gamesFromNintendoList,
  gamesFromXboxBrowse,
  gameSlugsFromSitemap,
  NINTENDO_LIST,
  PS_SITEMAP,
  psGamePage,
  slugFromTitle,
  titleKeys,
  XBOX_LISTS,
  xboxBrowse,
  type Found,
} from './discovery/sources';
import { collectNintendo } from './stores/nintendo';
import { collectPlayStation } from './stores/playstation';
import { collectXbox } from './stores/xbox';
import type { TrackedGame } from './tracked';
import type { Observation } from './types';

type Region = typeof s.regions.$inferSelect;
type IdField = 'psConceptId' | 'eshopId' | 'xboxProductId';

type Source = {
  store: string; // stores.code
  field: IdField;
  short: string; // for addresses made up from the id
  delayMs: number;
  // The candidates this run. `seen` holds every key judged before.
  find: (seen: Set<string>, ctx: { log: (line: string) => void; dryRun: boolean; remember: Remember }) => Promise<Found[]>;
  collect: (id: string, region: Region) => Promise<Observation[]>;
};
type Remember = (store: string, items: { key: string; outcome: string; note?: string }[]) => Promise<void>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SOURCES: Source[] = [
  {
    store: 'ps_store',
    field: 'psConceptId',
    short: 'ps',
    delayMs: 3000,
    async find(seen, { log, dryRun, remember }) {
      const slugs = gameSlugsFromSitemap(await fetchText(PS_SITEMAP));
      if (slugs.length < 100) throw new Error(`the sitemap lists only ${slugs.length} game pages (page structure may have changed)`);
      if (seen.size === 0) {
        // First run: these pages were there before discovery began. Only pages
        // added from now on are new games.
        log(`first run: ${slugs.length} existing game pages noted; new pages from now on will be added`);
        if (!dryRun) await remember('ps_store', slugs.map((key) => ({ key, outcome: 'baseline' })));
        return [];
      }
      const fresh = slugs.filter((slug) => !seen.has(slug));
      const found: Found[] = [];
      for (const [i, slug] of fresh.slice(0, 40).entries()) {
        if (i > 0) await sleep(3000);
        try {
          const page = conceptFromGamePage(await fetchText(psGamePage(slug)));
          if (!page.conceptId) {
            log(`  ${slug}: no store page linked yet`);
            continue; // not remembered: try again next run, the page may gain one
          }
          found.push({ key: slug, id: page.conceptId, title: page.title ?? slug, slugHint: slug });
        } catch (err) {
          log(`  ${slug}: ${err instanceof Error ? err.message : err}`);
        }
      }
      return found;
    },
    collect: (id, r) => collectPlayStation(id, { locale: r.locale.toLowerCase(), currency: r.currency }),
  },
  {
    store: 'xbox_store',
    field: 'xboxProductId',
    short: 'xbox',
    delayMs: 3000,
    async find(seen) {
      const found: Found[] = [];
      for (const [i, orderby] of XBOX_LISTS.entries()) {
        if (i > 0) await sleep(3000);
        for (const f of gamesFromXboxBrowse(await fetchText(xboxBrowse(orderby)))) {
          if (!seen.has(f.key) && !found.some((x) => x.key === f.key)) found.push(f);
        }
      }
      return found;
    },
    collect: (id, r) => collectXbox(id, { locale: r.locale, currency: r.currency }),
  },
  {
    store: 'eshop',
    field: 'eshopId',
    short: 'eshop',
    delayMs: 6000, // this store turns quick readers away (see run.ts)
    async find(seen) {
      return gamesFromNintendoList(await fetchText(NINTENDO_LIST)).filter((f) => !seen.has(f.key));
    },
    collect: (id, r) => collectNintendo(id, { regionCode: r.code, currency: r.currency }),
  },
];

type Options = { max: number; dryRun: boolean };

async function discoverStore(source: Source, region: Region, tracked: TrackedGame[], usedSlugs: Set<string>, opts: Options) {
  const log = (line: string) => console.log(line);
  const [store] = await db.select().from(s.stores).where(eq(s.stores.code, source.store));
  const seenRows = await db.select({ key: s.discoverySeen.key }).from(s.discoverySeen).where(eq(s.discoverySeen.store, source.store));
  const seen = new Set(seenRows.map((r) => r.key));
  const remember: Remember = async (code, items) => {
    if (opts.dryRun || items.length === 0) return;
    for (let i = 0; i < items.length; i += 500) {
      await db
        .insert(s.discoverySeen)
        .values(items.slice(i, i + 500).map((x) => ({ store: code, key: x.key, outcome: x.outcome, note: x.note ?? null })))
        .onConflictDoNothing();
    }
  };

  const candidates = await source.find(seen, { log, dryRun: opts.dryRun, remember });
  // Store ids already followed, under any game: the game itself or one of its editions.
  const trackedIds = new Set(tracked.map((g) => g[source.field]).filter(Boolean) as string[]);
  const listed = new Set(
    (await db.select({ id: s.listings.storeProductId }).from(s.listings).where(eq(s.listings.storeId, store.id))).map((r) => r.id),
  );
  const byKey = new Map<string, TrackedGame>();
  for (const g of tracked) for (const k of titleKeys(g.title)) if (!byKey.has(k)) byKey.set(k, g);
  const sameGame = (name: string) => titleKeys(name).map((k) => byKey.get(k)).find(Boolean);

  let added = 0;
  let merged = 0;
  let read = 0;
  for (const found of candidates) {
    if (added + merged >= opts.max) break;
    const id = found.id!;
    if (trackedIds.has(id) || listed.has(id)) {
      await remember(source.store, [{ key: found.key, outcome: 'tracked', note: id }]);
      continue;
    }
    if (read > 0) await sleep(source.delayMs);
    read += 1;
    let observations: Observation[];
    try {
      observations = await source.collect(id, region);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/responded (403|429)\b/.test(message)) {
        log(`  ${store.name} is refusing requests for now; stopped early.`);
        break;
      }
      log(`  ${found.title}: turned down (${message})`);
      await remember(source.store, [{ key: found.key, outcome: 'rejected', note: message.slice(0, 200) }]);
      continue;
    }
    const priced = observations.filter((o) => o.price.basePrice > 0);
    if (priced.length === 0) {
      log(`  ${found.title}: turned down (no price on its store page)`);
      await remember(source.store, [{ key: found.key, outcome: 'rejected', note: 'no price' }]);
      continue;
    }
    // A product the page sells that is already followed as part of another game.
    const already = priced.find((o) => listed.has(o.storeProductId));
    if (already) {
      await remember(source.store, [{ key: found.key, outcome: 'tracked', note: `${id} sells ${already.storeProductId}` }]);
      continue;
    }
    const standard = priced.find((o) => o.edition === 'standard') ?? priced[0];
    const title = cleanTitle(source.store === 'ps_store' ? found.title : found.title || standard.title);
    const same = sameGame(found.title) ?? sameGame(title);

    if (same && same[source.field]) {
      // The same game, already followed here under another store id (a second
      // product for a newer console, say). One is enough.
      log(`  ${title}: already tracked as ${same.slug}`);
      await remember(source.store, [{ key: found.key, outcome: 'tracked', note: `same name as ${same.slug}` }]);
      continue;
    }
    if (same) {
      log(`  ${title}: joins ${same.slug} (${source.store} ${id})`);
      if (!opts.dryRun) {
        await db
          .insert(s.discoveredGames)
          .values({ slug: same.slug, title: same.title, [source.field]: id, source: source.store })
          .onConflictDoUpdate({ target: s.discoveredGames.slug, set: { [source.field]: id } });
      }
      same[source.field] = id;
      trackedIds.add(id);
      await remember(source.store, [{ key: found.key, outcome: 'merged', note: same.slug }]);
      merged += 1;
      continue;
    }

    const base = found.slugHint ?? slugFromTitle(found.title) ?? `${source.short}-${id.toLowerCase()}`;
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    if (!opts.dryRun) {
      // The other store's job may run at the same moment and take the same address.
      const inserted = await db
        .insert(s.discoveredGames)
        .values({ slug, title, [source.field]: id, source: source.store })
        .onConflictDoNothing()
        .returning({ id: s.discoveredGames.id });
      if (inserted.length === 0) {
        log(`  ${title}: ${slug} was just taken; left for the next run`);
        continue;
      }
    }
    log(`  ${title}: added as ${slug} (${source.store} ${id}, ₩${standard.price.basePrice.toLocaleString('ko-KR')})`);
    const game: TrackedGame = { slug, title, [source.field]: id };
    tracked.push(game);
    usedSlugs.add(slug);
    trackedIds.add(id);
    for (const k of titleKeys(found.title)) if (!byKey.has(k)) byKey.set(k, game);
    await remember(source.store, [{ key: found.key, outcome: 'added', note: slug }]);
    added += 1;
  }
  console.log(
    `${store.name}: ${candidates.length} new on its lists, ${added} added, ${merged} joined to tracked games${opts.dryRun ? ' (dry run: nothing saved)' : ''}.`,
  );
}

async function main() {
  const only: string[] = [];
  const opts: Options = { max: 10, dryRun: false };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--max') {
      opts.max = Number(args[++i]);
      if (!(opts.max >= 0)) throw new Error('--max needs a number, for example --max 5');
    } else only.push(args[i]);
  }
  const unknown = only.filter((code) => !SOURCES.some((x) => x.store === code));
  if (unknown.length > 0) throw new Error(`Unknown store: ${unknown.join(', ')}`);

  await ensureReferenceData(db);
  const [region] = await db.select().from(s.regions).where(eq(s.regions.code, 'KR'));
  const tracked = await loadTracked(db);
  const usedSlugs = new Set([
    ...tracked.map((g) => g.slug),
    ...(await db.select({ slug: s.games.slug }).from(s.games)).map((r) => r.slug),
  ]);

  let failed = 0;
  for (const source of SOURCES) {
    if (only.length > 0 && !only.includes(source.store)) continue;
    try {
      await discoverStore(source, region, tracked, usedSlugs, opts);
    } catch (err) {
      failed += 1;
      console.error(`${source.store}: discovery failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  await closeDb();
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
