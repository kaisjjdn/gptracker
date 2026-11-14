// Nintendo eShop (Korea) collector.
//
// Reads the public product page on the My Nintendo Store,
// https://store.nintendo.co.kr/<nsuid>. The price, regular price and sale
// period are in the page's HTML. Korea has its own store site, so this
// collector is Korea-only; other regions will need their own.
import { releaseDay } from '../types';
import type { Observation, Platform, SaleInfo } from '../types';

const USER_AGENT = 'Mozilla/5.0 (compatible; GPtracker/0.1; price history)';
const ORIGIN = 'https://store.nintendo.co.kr';

const decode = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();

// Values of one row in the product attribute table, e.g. "publisher".
function attribute(html: string, name: string): string[] {
  const start = html.search(new RegExp(`class="product-attribute ${name}[ "]`));
  if (start < 0) return [];
  const next = html.indexOf('class="product-attribute ', start + 1);
  const block = html.slice(start, next < 0 ? start + 2000 : next);
  return [...block.matchAll(/class="attribute-item-val">\s*([^<]+?)\s*</g)].map((m) => decode(m[1]));
}

// "2026/11/4 00:00" in Korean time.
function kstDate(text: string | undefined): Date | null {
  const m = text?.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:00+09:00`);
}

// "발매일 2023/5/12" from the product details, as YYYY-MM-DD.
export function releaseDateFromPage(html: string): string | null {
  const m = html.match(/class="product-attribute release_date[^>]*>[\s\S]{0,200}?class="product-attribute-val">\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s*</);
  if (!m) return null;
  return releaseDay(new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T12:00:00+09:00`));
}

// The product's main picture, from the image gallery data embedded in the page.
export function coverFromPage(html: string): string | null {
  const entries = [...html.matchAll(/\{"thumb":"[^"]*","img":"([^"]+)"[^{}]*?"isMain":(true|false)/g)];
  const main = entries.find((m) => m[2] === 'true') ?? entries[0];
  if (!main) return null;
  const url = main[1].replaceAll('\\/', '/');
  return url.startsWith(`${ORIGIN}/media/`) ? url : null;
}

export function parseNintendoPage(html: string, nsuid: string, opts: { currency: string }): Observation[] {
  // The main product's price box sits between these two markers; other price
  // boxes on the page belong to recommended products.
  const start = html.indexOf('class="product-info-price"');
  const end = html.indexOf('class="product-add-form"', start);
  if (start < 0 || end < 0) {
    throw new Error(`Nintendo eShop: price section not found for ${nsuid} (page structure may have changed)`);
  }
  const box = html.slice(start, end);
  const amount = (type: string) => {
    const m = box.match(new RegExp(`data-price-amount="(\\d+)"\\s+data-price-type="${type}"`));
    return m ? Number(m[1]) : null;
  };
  const finalPrice = amount('finalPrice');
  if (finalPrice === null || finalPrice === 0) return []; // not on sale yet, or free

  const currency = box.match(/itemprop="priceCurrency" content="([A-Z]{3})"/)?.[1];
  if (currency !== opts.currency) {
    throw new Error(`Nintendo eShop: expected ${opts.currency} but ${nsuid} is priced in ${currency}`);
  }
  const oldPrice = amount('oldPrice');
  const onSale = oldPrice !== null && oldPrice > finalPrice;

  let sale: SaleInfo | null = null;
  if (onSale) {
    const startsAt = kstDate(box.match(/class="special-period-start">([^<]+)</)?.[1]);
    const endsAt = kstDate(box.match(/class="special-period-end">([^<]+)</)?.[1]);
    if (startsAt || endsAt) {
      // The store shows no campaign id; games in the same sale share its period.
      const key = (d: Date | null) => d?.toISOString().slice(0, 10) ?? '';
      sale = { externalId: `period:${key(startsAt)}/${key(endsAt)}`, name: null, startsAt, endsAt };
    }
  }

  const platforms = attribute(html, 'label_platform');
  const platform: Platform =
    platforms.length > 0 && platforms.every((p) => p === 'Nintendo Switch 2') ? 'switch2' : 'switch';
  const title = html.match(/data-ui-id="page-title-wrapper"[^>]*>([^<]+)</)?.[1];

  return [
    {
      storeProductId: nsuid,
      title: title ? decode(title) : nsuid,
      edition: 'standard',
      platform,
      url: `${ORIGIN}/${nsuid}`,
      coverUrl: coverFromPage(html),
      publisher: attribute(html, 'publisher')[0] ?? null,
      genre: attribute(html, 'game_category')[0] ?? null,
      price: { basePrice: onSale ? oldPrice : finalPrice, salePrice: onSale ? finalPrice : null, memberPrice: null },
      sale,
      releaseDate: releaseDateFromPage(html),
    },
  ];
}

export async function collectNintendo(nsuid: string, opts: { regionCode: string; currency: string }): Promise<Observation[]> {
  if (opts.regionCode !== 'KR') throw new Error(`Nintendo eShop: region ${opts.regionCode} is not supported yet`);
  const url = `${ORIGIN}/${nsuid}`;
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Nintendo eShop: ${url} responded ${res.status}`);
  const html = await res.text();
  try {
    return parseNintendoPage(html, nsuid, opts);
  } catch (err) {
    // Say what came back instead, to tell a changed page from a regional or
    // access notice served to this machine.
    const title = html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim().slice(0, 80) ?? 'none';
    const where = res.url === url ? '' : `, redirected to ${res.url}`;
    throw new Error(`${err instanceof Error ? err.message : err} [received ${html.length} bytes, title "${title}"${where}]`);
  }
}
