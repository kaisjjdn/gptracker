import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
import type { Db } from '../db';
import * as s from '../db/schema';
import { detectChanges, type DetectedEvent } from './detect-changes';
import type { Observation, PriceState } from './types';

export type RecordContext = {
  storeId: number;
  regionId: number;
  gameId: number;
  locale: string;
  currency: string;
  now: Date;
};

// Store one observation: make sure its product and listing exist, and if the
// price differs from the last stored one, add a price point plus the events
// explaining the change. Returns the events (empty when nothing changed).
export async function recordObservation(db: Db, ctx: RecordContext, obs: Observation): Promise<DetectedEvent[]> {
  const format = obs.format ?? 'digital';
  return db.transaction(async (tx) => {
    const productKey = and(
      eq(s.products.gameId, ctx.gameId),
      eq(s.products.platform, obs.platform),
      eq(s.products.edition, obs.edition),
      eq(s.products.format, format),
    );
    let [product] = await tx.select().from(s.products).where(productKey);
    if (!product) {
      [product] = await tx
        .insert(s.products)
        .values({ gameId: ctx.gameId, platform: obs.platform, edition: obs.edition, format })
        .returning();
    }

    const listingKey = and(
      eq(s.listings.storeId, ctx.storeId),
      eq(s.listings.regionId, ctx.regionId),
      eq(s.listings.storeProductId, obs.storeProductId),
    );
    let [listing] = await tx.select().from(s.listings).where(listingKey);
    if (!listing) {
      [listing] = await tx
        .insert(s.listings)
        .values({
          productId: product.id,
          storeId: ctx.storeId,
          regionId: ctx.regionId,
          storeProductId: obs.storeProductId,
          url: obs.url,
          sellerName: obs.sellerName ?? null,
          korean: obs.korean ?? null,
          firstSeenAt: ctx.now,
        })
        .returning();
    }
    if (listing.productId !== product.id) {
      // The same store item is already recorded under another product.
      const [owner] = await tx.select().from(s.products).where(eq(s.products.id, listing.productId));
      if (owner && owner.gameId !== ctx.gameId) {
        // Under another game, usually because that game's page lists this one as
        // an edition. While that game still shows it, leave it there: recording
        // it twice would make its price flip between two readings. Once that
        // game has let go of it, it moves here with its history.
        if (listing.isActive) return [];
      }
      // Same game, filed under a different edition name than before (the page
      // relabelled it, or the rules for naming editions changed): the listing
      // and its history follow the new name.
      await tx.update(s.listings).set({ productId: product.id }).where(eq(s.listings.id, listing.id));
    }
    await tx
      .update(s.listings)
      .set({ lastCheckedAt: ctx.now, url: obs.url, sellerName: obs.sellerName ?? listing.sellerName, korean: obs.korean ?? listing.korean, isActive: true })
      .where(eq(s.listings.id, listing.id));

    const [last] = await tx
      .select()
      .from(s.pricePoints)
      .where(eq(s.pricePoints.listingId, listing.id))
      .orderBy(desc(s.pricePoints.observedAt), desc(s.pricePoints.id))
      .limit(1);
    const prev: PriceState | null = last
      ? { basePrice: last.basePrice, salePrice: last.salePrice, memberPrice: last.memberPrice }
      : null;

    // The campaign behind the previous sale price, to tell back-to-back sales apart.
    let prevSale: { id: number; externalId: string | null } | undefined;
    if (prev && prev.salePrice !== null) {
      [prevSale] = await tx
        .select({ id: s.sales.id, externalId: s.sales.externalId })
        .from(s.priceEvents)
        .innerJoin(s.sales, eq(s.priceEvents.saleId, s.sales.id))
        .where(eq(s.priceEvents.listingId, listing.id))
        .orderBy(desc(s.priceEvents.occurredAt), desc(s.priceEvents.id))
        .limit(1);
    }

    const events = detectChanges(prev, obs.price, {
      sale: obs.sale,
      prevSaleId: prevSale?.externalId,
      locale: ctx.locale,
      currency: ctx.currency,
      retail: format === 'disc',
    });

    // Keep the campaign's end date and name fresh even when the price is unchanged.
    let saleId: number | null = null;
    if (obs.sale && obs.price.salePrice !== null) {
      const saleKey = and(
        eq(s.sales.storeId, ctx.storeId),
        eq(s.sales.regionId, ctx.regionId),
        eq(s.sales.externalId, obs.sale.externalId),
      );
      const [existing] = await tx.select().from(s.sales).where(saleKey);
      if (existing) {
        saleId = existing.id;
        await tx
          .update(s.sales)
          .set({ endsAt: obs.sale.endsAt ?? existing.endsAt, name: obs.sale.name ?? existing.name })
          .where(eq(s.sales.id, existing.id));
      } else {
        const [created] = await tx
          .insert(s.sales)
          .values({
            storeId: ctx.storeId,
            regionId: ctx.regionId,
            externalId: obs.sale.externalId,
            name: obs.sale.name,
            startsAt: obs.sale.startsAt ?? ctx.now,
            endsAt: obs.sale.endsAt,
          })
          .returning();
        saleId = created.id;
      }
    }
    if (events.length === 0) return [];

    await tx.insert(s.pricePoints).values({ listingId: listing.id, ...obs.price, observedAt: ctx.now });
    await tx.insert(s.priceEvents).values(
      events.map((e) => ({
        listingId: listing.id,
        type: e.type,
        oldPrice: e.oldPrice,
        newPrice: e.newPrice,
        note: e.note,
        occurredAt: ctx.now,
        saleId:
          e.type === 'sale_end'
            ? (prevSale?.id ?? null)
            : e.type === 'sale_start' || e.type === 'new_listing'
              ? saleId
              : null,
      })),
    );
    return events;
  });
}

// Retail offers come and go. Mark a game's disc listings on one store as
// inactive when the latest search no longer returned them, so only current
// offers are shown. Their price history is kept.
export async function deactivateMissingDiscListings(
  db: Db,
  key: { storeId: number; regionId: number; gameId: number; platform: Observation['platform'] },
  seenStoreProductIds: string[],
): Promise<void> {
  const products = await db
    .select({ id: s.products.id })
    .from(s.products)
    .where(and(eq(s.products.gameId, key.gameId), eq(s.products.platform, key.platform), eq(s.products.format, 'disc')));
  if (products.length === 0) return;
  await db
    .update(s.listings)
    .set({ isActive: false })
    .where(
      and(
        eq(s.listings.storeId, key.storeId),
        eq(s.listings.regionId, key.regionId),
        inArray(s.listings.productId, products.map((p) => p.id)),
        seenStoreProductIds.length > 0 ? notInArray(s.listings.storeProductId, seenStoreProductIds) : undefined,
      ),
    );
}

// After reading a game's page on a digital store: listings of that game on that
// store which the page did not return are no longer offered (an edition was
// withdrawn, or the tracked list now leaves it to another game). Mark them
// inactive so they stop being shown; their price history is kept.
export async function deactivateMissingListings(
  db: Db,
  key: { storeId: number; regionId: number; gameId: number },
  seenStoreProductIds: string[],
): Promise<void> {
  if (seenStoreProductIds.length === 0) return; // an empty read is a failed read, not a withdrawal
  const products = await db
    .select({ id: s.products.id })
    .from(s.products)
    .where(and(eq(s.products.gameId, key.gameId), eq(s.products.format, 'digital')));
  if (products.length === 0) return;
  await db
    .update(s.listings)
    .set({ isActive: false })
    .where(
      and(
        eq(s.listings.storeId, key.storeId),
        eq(s.listings.regionId, key.regionId),
        inArray(s.listings.productId, products.map((p) => p.id)),
        notInArray(s.listings.storeProductId, seenStoreProductIds),
      ),
    );
}
