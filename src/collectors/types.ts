import type { platform, priceEventType } from '@/db/schema';

export type Platform = (typeof platform.enumValues)[number];
export type EventType = (typeof priceEventType.enumValues)[number];

// Prices are integers in the currency's minor unit (KRW: won, USD: cents).
export type PriceState = {
  basePrice: number; // regular price
  salePrice: number | null; // discounted price open to everyone
  memberPrice: number | null; // subscriber-only price (PS Plus, Game Pass)
};

export type SaleInfo = {
  externalId: string; // the store's campaign id, or a stable key built from what it shows
  name: string | null;
  startsAt?: Date | null; // when the store says it began; otherwise first seen
  endsAt: Date | null;
};

// What a collector saw for one item on one store, right now.
export type Observation = {
  storeProductId: string;
  title: string;
  edition: string; // 'standard' or the store's edition name
  platform: Platform;
  url: string;
  coverUrl: string | null;
  publisher: string | null;
  genre: string | null;
  price: PriceState;
  sale: SaleInfo | null;
  format?: 'digital' | 'disc'; // default 'digital'
  sellerName?: string | null; // the shop behind a retail offer
};
