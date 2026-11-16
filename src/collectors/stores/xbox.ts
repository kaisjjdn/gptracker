// Xbox Store collector.
//
// Reads the public game page, https://www.xbox.com/<locale>/games/store/-/<productId>,
// which robots.txt allows. The page embeds its data as JSON in
// window.__PRELOADED_STATE__, including every edition of the game.
import { nameContains, releaseDay, type Observation, type Platform, type SaleInfo } from '../types';

const USER_AGENT = 'Mozilla/5.0 (compatible; GPtracker/0.1; price history)';

type Json = Record<string, any>;

// Pull the object literal assigned to window.__PRELOADED_STATE__ out of the page.
export function extractState(html: string): Json {
  const marker = html.indexOf('__PRELOADED_STATE__');
  const start = marker < 0 ? -1 : html.indexOf('{', marker);
  if (start < 0) throw new Error('Xbox Store: page data not found (page structure may have changed)');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth += 1;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1));
  }
  throw new Error('Xbox Store: page data is incomplete');
}

// "11/12/2026 09:59:59", in UTC.
function utcDate(text: string | undefined): Date | null {
  const m = text?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  return m ? new Date(`${m[3]}-${m[1]}-${m[2]}T${m[4]}Z`) : null;
}

// Korean interface, subtitles or audio, from the product's language table;
// null when the table is empty.
export function koreanOf(product: Json): boolean | null {
  const table: Json = product.languagesSupported ?? {};
  if (Object.keys(table).length === 0) return null;
  const ko = table['ko-KR'] ?? table.ko;
  return !!ko && (ko.isInterfaceSupported || ko.areSubtitlesSupported || ko.isAudioSupported) === true;
}

// "Game Pass" (or another pass, by its name) when the product is included with
// one; the page lists the passes by product id and describes each alongside.
export function subscriptionOf(product: Json, summaries: Json): string | null {
  const titles: string[] = (product.includedWithPassesProductIds ?? []).map((id: string) => summaries[id]?.title ?? '');
  if (titles.length === 0) return null;
  if (titles.some((t) => /game pass/i.test(t))) return 'Game Pass';
  return titles.find(Boolean)?.trim() || '구독';
}

export function observationsFromState(
  state: Json,
  productId: string,
  opts: { locale: string; currency: string; match?: string },
): Observation[] {
  const summaries: Json = state.core2?.products?.productSummaries ?? {};
  const main = summaries[productId];
  if (!main) {
    throw new Error(`Xbox Store: product ${productId} not found in page data (page structure may have changed)`);
  }
  const ids: string[] = [...new Set([productId, ...(main.editions ?? [])])];
  const observations: Observation[] = [];

  for (const id of ids) {
    const product = summaries[id];
    if (!product || product.productKind !== 'Game') continue;
    if (id !== productId) {
      // Listed alongside the game, but not an edition of it: another game sold
      // from the same page, or an upgrade for people who already own the game.
      if (!nameContains(product.title, opts.match)) continue;
      if (/업그레이드|upgrade/i.test(product.title ?? '')) continue;
    }

    const platform: Platform | null = product.availableOn?.includes('XboxSeriesX')
      ? 'xbox_series'
      : product.availableOn?.includes('XboxOne')
        ? 'xbox_one'
        : null;
    if (!platform) continue; // PC-only

    // Each entry is a price for some audience: everyone, or Game Pass members.
    const prices: Json[] = product.specificPrices?.purchaseable ?? [];
    for (const p of prices) {
      if (p.currency !== opts.currency) {
        throw new Error(`Xbox Store: expected ${opts.currency} but ${id} is priced in ${p.currency}`);
      }
    }
    const lowest = (list: Json[]) =>
      list.reduce<Json | null>((best, p) => (!best || p.listPrice < best.listPrice ? p : best), null);
    const open = lowest(prices.filter((p) => p.eligibilityInfo?.eligibility === 'None'));
    if (!open || open.msrp <= 0) continue; // free or not for sale
    const member = lowest(prices.filter((p) => p.eligibilityInfo?.eligibility !== 'None' && p.listPrice > 0));

    const basePrice: number = open.msrp;
    const salePrice: number | null = open.listPrice < basePrice ? open.listPrice : null;
    const memberPrice: number | null = member && member.listPrice < (salePrice ?? basePrice) ? member.listPrice : null;

    // No campaign id or name is published; the discounted price's own id stands in.
    const sale: SaleInfo | null =
      salePrice !== null && open.availabilityId
        ? { externalId: open.availabilityId, name: null, endsAt: utcDate(open.endDateUtc) }
        : null;

    observations.push({
      storeProductId: id,
      title: product.title,
      edition: id === productId ? 'standard' : product.title,
      platform,
      url: `https://www.xbox.com/${opts.locale}/games/store/-/${id}`,
      coverUrl: product.images?.boxArt?.url ?? product.images?.poster?.url ?? null,
      publisher: product.publisherName ?? null,
      genre: product.categories?.[0] ?? null,
      price: { basePrice, salePrice, memberPrice },
      sale,
      releaseDate: releaseDay(product.releaseDate),
      korean: koreanOf(product),
      subscription: subscriptionOf(product, summaries),
    });
  }
  return observations;
}

export async function collectXbox(productId: string, opts: { locale: string; currency: string; match?: string }): Promise<Observation[]> {
  const url = `https://www.xbox.com/${opts.locale}/games/store/-/${productId}`;
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Xbox Store: ${url} responded ${res.status}`);
  return observationsFromState(extractState(await res.text()), productId, opts);
}
