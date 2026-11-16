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
  releaseDate?: string | null; // YYYY-MM-DD, as the store states it
  korean?: boolean | null; // Korean text (interface or subtitles); null when the store does not say
  // The subscription that includes this game at no extra cost ("PS Plus 게임 카탈로그",
  // "Game Pass"), null when none does. Left undefined by stores without one.
  subscription?: string | null;
};

// Does a store's product name contain this text? Trademark signs and case are
// ignored. Used when a store page mixes several games and only some of its
// products belong to the game being tracked.
export function nameContains(name: string | undefined, text: string | undefined): boolean {
  if (!text) return true;
  const plain = (s: string) => s.replace(/[®™]/g, '').toLowerCase();
  const [haystack, needle] = [plain(name ?? ''), plain(text)];
  // The text must end where a word ends, so "모던 워페어 II" does not also
  // claim "모던 워페어 III", nor "Black Ops" "Black Ops 4".
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    const next = haystack[at + needle.length] ?? '';
    const afterSpace = haystack.slice(at + needle.length).match(/^\s+(\S)/)?.[1] ?? '';
    if (/[\p{L}\p{N}]/u.test(next)) continue; // runs on: a longer word or number
    if (/^\d$/.test(afterSpace) || /^[ivx]$/i.test(afterSpace) && /^\s+[ivx]+(\s|$|[^\p{L}])/iu.test(haystack.slice(at + needle.length))) continue; // followed by a sequel number
    return true;
  }
  return false;
}

// A store's release date as YYYY-MM-DD in the given time zone, or null when it
// is missing or a placeholder (stores use far-future dates for "to be announced").
export function releaseDay(value: string | Date | null | undefined, timeZone = 'Asia/Seoul'): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone }).format(date);
  const year = Number(day.slice(0, 4));
  return year >= 1980 && year < 2100 ? day : null;
}
