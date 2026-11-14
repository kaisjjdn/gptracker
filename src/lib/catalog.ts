// Loads everything the screens need and shapes it per game.
//
// It reads all tracked games in one go and groups in memory, which is fine
// while the list is hand-picked. Past a few thousand listings this should
// become per-game queries.
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import {
  buildChanges,
  lowestOverTime,
  salePeriods,
  type DiscView,
  type EventRow,
  type Family,
  type GameView,
  type PointRow,
  type Series,
} from './view';

const REGION = 'KR';
const STORE_FAMILY: Record<string, Family> = { ps_store: 'ps', eshop: 'sw', xbox_store: 'xb' };
const FAMILY_ORDER: Family[] = ['ps', 'sw', 'xb'];
// Newest console first: the one a game is filed under when a store sells several.
const PLATFORMS = ['ps5', 'ps4', 'switch2', 'switch', 'xbox_series', 'xbox_one'];
const CHIP: Record<string, string> = {
  ps5: 'PS5', ps4: 'PS4', switch2: 'Switch 2', switch: 'Switch', xbox_series: 'Xbox', xbox_one: 'Xbox One',
};

async function readCatalog(): Promise<GameView[]> {
  // One query at a time, on purpose. With this driver and a pooled Postgres
  // connection, queries that have to wait for a free connection never finish,
  // which froze the deployed site. Run in sequence, nothing ever waits.
  const games = await db.select().from(s.games).orderBy(asc(s.games.id));
  const products = await db.select().from(s.products);
  const listings = await db
    .select({ listing: s.listings, storeCode: s.stores.code, storeName: s.stores.name })
    .from(s.listings)
    .innerJoin(s.stores, eq(s.listings.storeId, s.stores.id))
    .innerJoin(s.regions, eq(s.listings.regionId, s.regions.id))
    .where(eq(s.regions.code, REGION));
  const points = await db.select().from(s.pricePoints).orderBy(asc(s.pricePoints.observedAt), asc(s.pricePoints.id));
  const events = await db
    .select({ event: s.priceEvents, saleName: s.sales.name, saleEndsAt: s.sales.endsAt })
    .from(s.priceEvents)
    .leftJoin(s.sales, eq(s.priceEvents.saleId, s.sales.id))
    .orderBy(asc(s.priceEvents.occurredAt), asc(s.priceEvents.id));

  const pointsOf = new Map<number, PointRow[]>();
  for (const p of points) {
    const row = { t: p.observedAt.getTime(), base: p.basePrice, sale: p.salePrice, member: p.memberPrice };
    pointsOf.set(p.listingId, [...(pointsOf.get(p.listingId) ?? []), row]);
  }
  const eventsOf = new Map<number, EventRow[]>();
  for (const { event: e, saleName, saleEndsAt } of events) {
    const row = { t: e.occurredAt.getTime(), type: e.type, note: e.note, saleName, saleEndsAt: saleEndsAt?.getTime() ?? null };
    eventsOf.set(e.listingId, [...(eventsOf.get(e.listingId) ?? []), row]);
  }
  const productById = new Map(products.map((p) => [p.id, p]));

  const views: GameView[] = [];
  for (const game of games) {
    const mine = listings
      .map((l) => ({ ...l, product: productById.get(l.listing.productId)!, points: pointsOf.get(l.listing.id) ?? [] }))
      .filter((l) => l.product?.gameId === game.id && l.points.length > 0);

    const series: Series[] = [];
    for (const key of FAMILY_ORDER) {
      const inStore = mine
        .filter((l) => l.product.format === 'digital' && STORE_FAMILY[l.storeCode] === key && l.listing.isActive)
        .sort(
          (a, b) =>
            Number(b.product.edition === 'standard') - Number(a.product.edition === 'standard') ||
            PLATFORMS.indexOf(a.product.platform) - PLATFORMS.indexOf(b.product.platform),
        );
      const main = inStore[0];
      if (!main) continue;
      const evs = eventsOf.get(main.listing.id) ?? [];
      const changes = buildChanges(main.points, evs);
      const last = main.points.at(-1)!;
      const cur = last.sale ?? last.base;
      series.push({
        key,
        storeName: main.storeName,
        chip: CHIP[main.product.platform],
        edition: main.product.edition === 'standard' ? null : main.product.edition,
        url: main.listing.url,
        changes,
        sales: salePeriods(main.points),
        cur,
        base: last.base,
        member: last.member,
        low: Math.min(...changes.map((c) => c.price)),
        pct: cur < last.base ? Math.round((1 - cur / last.base) * 100) : 0,
        saleEndsAt: last.sale === null ? null : (evs.findLast((e) => e.saleEndsAt !== null)?.saleEndsAt ?? null),
        editions: inStore.slice(1).map((l) => {
          const p = l.points.at(-1)!;
          const name = l.product.edition === 'standard' ? CHIP[l.product.platform] : l.product.edition;
          return { name, price: p.sale ?? p.base, base: p.base, url: l.listing.url };
        }),
      });
    }

    const discs = mine.filter((l) => l.product.format === 'disc');
    let disc: DiscView | null = null;
    if (discs.length > 0) {
      const changes = lowestOverTime(
        discs.map((l) => {
          const evs = eventsOf.get(l.listing.id) ?? [];
          return l.points.map((p) => ({ t: p.t, price: p.sale ?? p.base, note: evs.find((e) => e.t === p.t)?.note ?? '' }));
        }),
      );
      const sellers = discs
        .filter((l) => l.listing.isActive)
        .map((l) => {
          const p = l.points.at(-1)!;
          return { name: l.listing.sellerName ?? l.storeName, note: l.listing.note, price: p.sale ?? p.base, url: l.listing.url };
        })
        .sort((a, b) => a.price - b.price);
      if (sellers.length > 0) {
        disc = {
          changes,
          cur: sellers[0].price,
          low: Math.min(...changes.map((c) => c.price)),
          sellers,
          affiliate: discs.some((l) => l.storeCode === 'coupang' && l.listing.isActive),
        };
      }
    }

    if (series.length > 0) {
      views.push({ slug: game.slug, title: game.title, genre: game.genre, publisher: game.publisher, coverUrl: game.coverUrl, series, disc });
    }
  }
  return views;
}

const FRESH_MS = 30_000;
const TIMEOUT_MS = 10_000;
let latest: { at: number; result: Promise<GameView[]> } | null = null;

// The catalog for the screens. Page views arriving together (and the several
// reads one page makes) share a single read, kept for half a minute, so the
// database only ever sees one query from this server at a time. A read that
// stalls fails after ten seconds instead of leaving the page loading forever.
export function loadCatalog(): Promise<GameView[]> {
  if (latest && Date.now() - latest.at < FRESH_MS) return latest.result;
  let timer: ReturnType<typeof setTimeout>;
  const result = Promise.race([
    readCatalog(),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('The price database did not answer in time.')), TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  const entry = { at: Date.now(), result };
  latest = entry;
  // A failed read is not kept, so the next page view tries again.
  result.catch(() => {
    if (latest === entry) latest = null;
  });
  return result;
}
