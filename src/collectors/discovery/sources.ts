// Public pages that list games, read to find ones worth tracking.
//
//  - PS Store: its category pages are drawn in the browser and come back empty,
//    but playstation.com lists every Korean game page in its sitemap
//    (https://www.playstation.com/ko-kr/sitemap.xml, allowed by robots.txt). A
//    game page that was not there before is a game Sony has added. The page
//    names the PS Store concept it sells.
//  - Xbox Store: the browse page (https://www.xbox.com/ko-KR/games/browse),
//    sorted by popularity and by wishlist count. Its first screen of results is
//    in the page's __PRELOADED_STATE__.
//  - Nintendo eShop: the best-sellers list,
//    https://store.nintendo.co.kr/digital/best-sellers.
//
// Every store adds dozens of small games a day (Xbox lists over 12,000), more
// than a twice-daily collection can read. These lists keep to the games people
// are actually looking at.
import { extractState } from '../stores/xbox';

export const USER_AGENT = 'Mozilla/5.0 (compatible; GPtracker/0.1; price history)';

export type Found = {
  key: string; // what discovery remembers it by: the store id, or the page it was found at
  id?: string; // the store's id, once known
  title: string;
  slugHint?: string; // a readable address the store already gave the game
};

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, 'accept-language': 'ko-KR,ko;q=0.9' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.text();
}

// --- PlayStation -------------------------------------------------------------

export const PS_SITEMAP = 'https://www.playstation.com/ko-kr/sitemap.xml';
export const psGamePage = (slug: string) => `https://www.playstation.com/ko-kr/games/${slug}/`;

// The game pages in the sitemap, by their address name: ".../ko-kr/games/astro-bot/" -> "astro-bot".
export function gameSlugsFromSitemap(xml: string): string[] {
  const slugs = [...xml.matchAll(/<loc>https:\/\/www\.playstation\.com\/ko-kr\/games\/([^/<]+)\/<\/loc>/g)].map((m) => m[1]);
  return [...new Set(slugs)];
}

// A game page mentions the PS Store concept it sells many times over (store
// links, price widgets); stray mentions of other games are rarer.
export function conceptFromGamePage(html: string): { conceptId: string | null; title: string | null } {
  const text = html.replace(/&quot;/g, '"');
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/conceptId"?\s*[:=]\s*"?(\d{5,9})/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  const raw = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;
  // "Gris - PS5 and PS4 Games | PlayStation (한국)" -> "Gris"
  const title = raw ? decode(raw).split(/\s+[|-]\s+/)[0].trim() || null : null;
  return { conceptId: best && best[1] >= 3 ? best[0] : null, title };
}

// --- Xbox ----------------------------------------------------------------------

export const XBOX_LISTS = ['WishlistCountTotal desc', 'MostPopular desc'];
export const xboxBrowse = (orderby: string) =>
  `https://www.xbox.com/ko-KR/games/browse?orderby=${encodeURIComponent(orderby)}&PlayWith=${encodeURIComponent('XboxSeriesX|S,XboxOne')}`;

// Console games with a price, in the order the page lists them.
export function gamesFromXboxBrowse(html: string): Found[] {
  const state = extractState(html);
  const core = state.core2 ?? {};
  const summaries: Record<string, any> = core.products?.productSummaries ?? {};
  const order: string[] = [];
  for (const channel of Object.values<any>(core.channels?.channelData ?? {})) {
    for (const p of channel?.data?.products ?? []) if (p?.productId && !order.includes(p.productId)) order.push(p.productId);
  }
  const found: Found[] = [];
  for (const id of order) {
    const p = summaries[id];
    if (!p || p.productKind !== 'Game') continue;
    if (!(p.availableOn ?? []).some((on: string) => on === 'XboxSeriesX' || on === 'XboxOne')) continue;
    const msrp = Math.max(0, ...(p.specificPrices?.purchaseable ?? []).map((x: any) => Number(x.msrp) || 0));
    if (msrp <= 0) continue; // free to play, or not on sale yet
    found.push({ key: id, id, title: p.title ?? id });
  }
  return found;
}

// --- Nintendo --------------------------------------------------------------------

export const NINTENDO_LIST = 'https://store.nintendo.co.kr/digital/best-sellers';

// Games (ids starting 7001; 7005 are add-ons, 7007 bundles) with a price.
export function gamesFromNintendoList(html: string): Found[] {
  const found: Found[] = [];
  for (const item of html.split('<li class="item product product-item">').slice(1)) {
    const link = item.match(/class="product-item-link"\s+href="https:\/\/store\.nintendo\.co\.kr\/(\d{14})">\s*([\s\S]*?)\s*<\/a>/);
    if (!link || !link[1].startsWith('7001')) continue;
    const price = Number(item.match(/data-price-amount="(\d+)"\s+data-price-type="(?:finalPrice|oldPrice)"/)?.[1] ?? 0);
    if (price <= 0) continue;
    if (!found.some((f) => f.id === link[1])) found.push({ key: link[1], id: link[1], title: decode(link[2]) });
  }
  return found;
}

// --- Names -------------------------------------------------------------------------

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// A store's product name as a game title: no trademark signs, no language
// list or English name in brackets at the end.
//   "Kingdom Come: Deliverance (중국어(간체자), 한국어, 영어)" -> "Kingdom Come: Deliverance"
//   "메타포: 리판타지오（Metaphor: ReFantazio）" -> "메타포: 리판타지오"
export function cleanTitle(name: string): string {
  let text = name.replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
  for (;;) {
    const m = text.match(/^(.*\S)\s*[(（](?:[^()（）]|[(（][^()（）]*[)）])*[)）]$/);
    if (!m || m[1].length < 2) break;
    text = m[1];
  }
  return text.replace(/\s+-\s+PS[45](\s*(&|및|and)\s*PS[45])?$/i, '').trim();
}

// The same game under each store's spelling compares equal: case, spacing,
// punctuation, bracketed names, platform names and edition names are ignored.
// ("Ace Combat 7 Deluxe Edition" is Ace Combat 7: one game, another product.)
export function titleKey(name: string): string {
  return cleanTitle(name)
    .replace(/[®™©]/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\([^()]*\)/g, ' ') // "데이브 더 다이버 (DAVE THE DIVER)"
    .replace(/nintendo switch\s*2\s*edition|nintendo switch|xbox series x\|s|xbox series x|xbox one|ps4|ps5/g, '')
    .replace(
      /(digital |디지털 )?(standard|deluxe|ultimate|complete|gold|premium|game of the year|goty|스탠다드|디럭스|얼티밋|컴플리트|골드|프리미엄) ?(edition|에디션)/g,
      '',
    )
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// Every key a name can be matched by: the name itself, and an English name it
// gives in brackets ("에이스 컴뱃 7（ACE COMBAT 7）" also matches "ACE COMBAT 7").
export function titleKeys(name: string): string[] {
  const plain = name.replace(/[®™©]/g, '').normalize('NFKC');
  const bracketed = [...plain.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]).filter((t) => /[A-Za-z]{3}/.test(t));
  return [...new Set([titleKey(plain), ...bracketed.map(titleKey)])].filter((k) => k.length >= 2);
}

// A web address from the Latin letters in a name, or null when there are too
// few. An English name in brackets is preferred when there is one.
//   "메타포: 리판타지오（Metaphor: ReFantazio）" -> "metaphor-refantazio"
export function slugFromTitle(name: string): string | null {
  const plain = name.replace(/[®™©]/g, '').normalize('NFKC');
  const bracketed = [...plain.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]).find((t) => /[A-Za-z]{3}/.test(t));
  const slug = (bracketed ?? plain)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return /[a-z]{3}/.test(slug) ? slug : null;
}
