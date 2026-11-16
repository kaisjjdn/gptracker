import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// All prices are integers in the currency's minor unit (KRW: won, USD: cents).
// The currency of a price is the currency of its listing's region.

export const storeKind = pgEnum('store_kind', ['digital', 'retail']);
export const platform = pgEnum('platform', [
  'ps4',
  'ps5',
  'switch',
  'switch2',
  'xbox_one',
  'xbox_series',
]);
export const productFormat = pgEnum('product_format', ['digital', 'disc']);
export const priceEventType = pgEnum('price_event_type', [
  'new_listing',
  'sale_start',
  'sale_end',
  'base_price_up',
  'base_price_down',
  'price_change', // retail price moves and anything the rules can't classify
  'delisted',
]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const regions = pgTable('regions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // ISO 3166-1 alpha-2: KR, US
  name: text('name').notNull(),
  currency: text('currency').notNull(), // ISO 4217: KRW, USD
  locale: text('locale').notNull(), // ko-KR, en-US
});

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // ps_store, eshop, xbox_store, naver, coupang
  name: text('name').notNull(),
  kind: storeKind('kind').notNull(),
});

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  genre: text('genre'),
  publisher: text('publisher'),
  coverUrl: text('cover_url'),
  releaseDate: date('release_date'), // earliest release the stores state, YYYY-MM-DD
  createdAt: ts('created_at').notNull().defaultNow(),
});

// One sellable thing: a game on a platform, in an edition, as digital or disc.
export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    platform: platform('platform').notNull(),
    edition: text('edition').notNull().default('standard'),
    format: productFormat('format').notNull(),
  },
  (t) => [uniqueIndex('products_unique').on(t.gameId, t.platform, t.edition, t.format)],
);

// A product offered by one store in one region. Price history hangs off this.
export const listings = pgTable(
  'listings',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storeId: integer('store_id')
      .notNull()
      .references(() => stores.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    storeProductId: text('store_product_id').notNull(), // the store's own id for the item
    url: text('url'),
    sellerName: text('seller_name'), // marketplace seller on retail stores, e.g. 11번가
    note: text('note'), // e.g. 로켓배송, 특전 포함
    korean: boolean('korean'), // Korean text supported, as the store states; null when unknown
  subscription: text('subscription'), // subscription that includes it at no extra cost, if any
  isActive: boolean('is_active').notNull().default(true),
    firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
    lastCheckedAt: ts('last_checked_at'),
  },
  (t) => [
    uniqueIndex('listings_store_item').on(t.storeId, t.regionId, t.storeProductId),
    index('listings_product').on(t.productId),
  ],
);

// A row is written only when a price changes; the latest row is the current price.
export const pricePoints = pgTable(
  'price_points',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    basePrice: integer('base_price').notNull(), // regular price
    salePrice: integer('sale_price'), // null when not discounted
    memberPrice: integer('member_price'), // PS Plus / Game Pass price, if different
    observedAt: ts('observed_at').notNull(),
  },
  (t) => [index('price_points_listing_time').on(t.listingId, t.observedAt)],
);

// A named sale campaign run by a store in a region.
export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    storeId: integer('store_id')
      .notNull()
      .references(() => stores.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    externalId: text('external_id'), // the store's own campaign id, when it exposes one
    name: text('name'), // null until the campaign's display name is known
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at'),
  },
  (t) => [uniqueIndex('sales_external').on(t.storeId, t.regionId, t.externalId)],
);

// Why a price changed. A single price_points row can produce several events
// (e.g. the regular price rises on the day a sale starts).
export const priceEvents = pgTable(
  'price_events',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    type: priceEventType('type').notNull(),
    oldPrice: integer('old_price'), // effective price before; null for new_listing
    newPrice: integer('new_price'), // effective price after; null for delisted
    saleId: integer('sale_id').references(() => sales.id),
    note: text('note'),
    occurredAt: ts('occurred_at').notNull(),
  },
  (t) => [index('price_events_listing_time').on(t.listingId, t.occurredAt)],
);
