// PlayStation Store collector.
//
// Reads the public game page (store.playstation.com/<locale>/concept/<id>),
// which robots.txt allows and which embeds its data as JSON in
// <script id="env:..."> tags. One request returns every edition of a game.
import { nameContains, releaseDay } from '../types';
import type { Observation, Platform, SaleInfo } from '../types';

const USER_AGENT = 'Mozilla/5.0 (compatible; GPtracker/0.1; price history)';

type Json = Record<string, any>;

const PLATFORM: Record<string, Platform> = { PS5: 'ps5', PS4: 'ps4' };

// The page splits one normalized cache across several script tags; merge them.
export function extractCache(html: string): Json {
  const cache: Json = {};
  for (const m of html.matchAll(/<script id="env:[^"]*"[^>]*>(.*?)<\/script>/gs)) {
    let parsed: Json;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const [key, value] of Object.entries<Json>(parsed.cache ?? {})) {
      cache[key] = { ...cache[key], ...value };
    }
  }
  return cache;
}

const coverOf = (entity: Json | undefined): string | null =>
  entity?.media?.find((m: Json) => m.role === 'MASTER' && m.type === 'IMAGE')?.url ?? null;

// The subscription that includes this product, from the page's "included with"
// buttons: an offer tied to a subscription that brings the price to zero.
const SUBSCRIPTIONS: Record<string, string> = { PS_PLUS: 'PS Plus', EA_ACCESS: 'EA Play', UBISOFT_PLUS: 'Ubisoft+' };
export function subscriptionOf(product: Json, ctas: [string, Json][]): string | null {
  for (const [, cta] of ctas) {
    const sku = cta.local?.telemetryMeta?.skuDetail;
    if (!sku?.skuId?.startsWith(product.id)) continue;
    const free = (sku.skuPriceDetail ?? []).find(
      (d: Json) => d.discountPriceValue === 0 && d.originalPriceValue > 0 && d.offerIsTiedToSubscription,
    );
    if (!free) continue;
    const name = SUBSCRIPTIONS[free.offerBranding] ?? '구독';
    return cta.type === 'UPSELL_PS_PLUS_GAME_CATALOG' ? `${name} 게임 카탈로그` : name;
  }
  return null;
}

// Does this product have Korean text? The page lists screen languages for newer
// products; older ones only say so in the name: "... (한국어판)" or a language list
// in brackets at the end, "... (중국어(간체자), 한국어, 영어)".
export function koreanOf(product: Json): boolean | null {
  const screen: string[] = product.screenLanguages ?? [];
  if (screen.length > 0) return screen.includes('ko');
  const name: string = product.name ?? '';
  if (/한국어/.test(name)) return true;
  // A bracketed list of languages that leaves Korean out.
  if (/\((?:[^()]|\([^()]*\))*(영어|일본어|중국어)(?:[^()]|\([^()]*\))*\)\s*$/.test(name)) return false;
  return null;
}

// Words in a product name that mark a bigger edition, for pages that don't label it.
const BIGGER_EDITION = /디럭스|deluxe|얼티밋|ultimate|프리미엄|premium|컴플리트|complete|골드 에디션|gold edition|gourmet|번들|bundle|collector|볼트 에디션|vault edition/i;

export function observationsFromCache(
  cache: Json,
  conceptId: string,
  opts: { locale: string; currency: string; match?: string },
): Observation[] {
  const concept = cache[`Concept:${conceptId}`];
  if (!concept) {
    throw new Error(`PS Store: concept ${conceptId} not found in page data (page structure may have changed)`);
  }
  const ctas = Object.entries<Json>(cache).filter(([key]) => key.startsWith('GameCTA:'));
  const observations: Observation[] = [];

  const products: Json[] = (concept.products ?? [])
    .map((ref: Json) => cache[ref.__ref])
    .filter((p: Json | undefined) => p?.id && p.topCategory === 'GAME') // drops demos
    .filter((p: Json) => nameContains(p.name, opts.match)); // on a shared page, this game's products only

  // Every purchase button of a product, with its price breakdown. An offer that
  // discounts to zero is "included with a subscription", not a price.
  const offersOf = (product: Json) =>
    ctas.flatMap(([, cta]) => {
      const sku = cta.local?.telemetryMeta?.skuDetail;
      if (!sku?.skuId?.startsWith(product.id)) return [];
      return (sku.skuPriceDetail ?? [])
        .filter((detail: Json) => detail.discountPriceValue > 0)
        .map((detail: Json) => ({ detail, local: cta.local as Json }));
    });

  // Which product is the game itself? Pages disagree on how they label things
  // (older ones mark everything "OTHER", some mark even the standard edition
  // "PREMIUM"), so several signals are weighed:
  //  1. the page's own default product, unless it is plainly a bigger edition;
  //  2. otherwise a priced product that is not a bigger edition;
  //  3. otherwise (every product looks bigger) the one called "Standard", else
  //     the default.
  const priced = products.filter((p) => offersOf(p).length > 0);
  // By its own label or name, a bigger edition (deluxe, ultimate, ...).
  const namedBigger = (p: Json) =>
    !['STANDARD', 'OTHER', undefined, null].includes(p.edition?.type) || BIGGER_EDITION.test(p.name ?? '');
  // Also counts how the store files it. Not applied to the page's default
  // product: a remaster or director's cut is often filed as a "bundle" and is
  // still the game the page is about.
  const isBigger = (p: Json) =>
    namedBigger(p) || ['GAME_BUNDLE', 'PREMIUM_EDITION'].includes(p.storeDisplayClassification);
  const isDefault = (p: Json) => `Product:${p.id}` === concept.defaultProduct?.__ref;
  const saysStandard = (p: Json) => /standard|스탠다드|일반판/i.test(p.edition?.name ?? '');
  const plain = priced.filter((p) => !isBigger(p));
  const firstChoice =
    priced.find((p) => isDefault(p) && !namedBigger(p)) ??
    plain.find((p) => p.edition?.type !== 'OTHER' && p.storeDisplayClassification === 'FULL_GAME') ??
    plain.find((p) => p.storeDisplayClassification === 'FULL_GAME') ??
    plain[0] ??
    priced.find((p) => isDefault(p) && saysStandard(p)) ??
    priced.find(saysStandard) ??
    priced.find(isDefault) ??
    priced[0];
  // Some games are sold as separate products per language. On the Korean
  // store, the Korean-language one is the one to follow.
  const standard =
    firstChoice && koreanOf(firstChoice) === false
      ? (plain.find((p) => koreanOf(p) === true) ?? firstChoice)
      : firstChoice;
  // Product names end with a language list, "(중국어(간체자), 한국어, 영어)": cut that
  // trailing group, minding the nested parentheses.
  const withoutLanguages = (name: string) => {
    const text = name.trimEnd();
    if (!text.endsWith(')')) return text;
    let depth = 0;
    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === ')') depth += 1;
      else if (text[i] === '(' && --depth === 0) return text.slice(0, i).trimEnd() || text;
    }
    return text;
  };

  for (const product of products) {
    const offers = offersOf(product);
    if (offers.length === 0) continue; // free, unreleased, or not for sale

    for (const { detail } of offers) {
      if (detail.priceCurrencyCode !== opts.currency) {
        throw new Error(`PS Store: expected ${opts.currency} but ${product.id} is priced in ${detail.priceCurrencyCode}`);
      }
    }
    const basePrice: number = Math.max(...offers.map((o) => o.detail.originalPriceValue));
    const cheapest = (list: typeof offers) =>
      list.reduce<(typeof offers)[number] | null>(
        (best, o) => (!best || o.detail.discountPriceValue < best.detail.discountPriceValue ? o : best),
        null,
      );
    const isMemberOffer = (d: Json) => d.offerIsTiedToSubscription || (d.offerBranding && d.offerBranding !== 'NONE');

    const open = cheapest(offers.filter((o) => !isMemberOffer(o.detail)));
    const member = cheapest(offers.filter((o) => isMemberOffer(o.detail)));
    const salePrice = open && open.detail.discountPriceValue < basePrice ? open.detail.discountPriceValue : null;
    const memberPrice =
      member && member.detail.discountPriceValue < (salePrice ?? basePrice) ? member.detail.discountPriceValue : null;

    let sale: SaleInfo | null = null;
    if (salePrice !== null && open?.detail.offerCampaignId) {
      sale = {
        externalId: open.detail.offerCampaignId,
        name: open.local.offerLabel || null,
        endsAt: open.local.offerAvailability ? new Date(open.local.offerAvailability) : null,
      };
    }

    const platforms: string[] = product.platforms ?? concept.platforms ?? [];
    const platformKey = platforms.includes('PS5') ? 'PS5' : platforms[0];
    const platform = PLATFORM[platformKey];
    if (!platform) continue; // not a console game (e.g. PC)

    // Other products go by their edition name. One that also calls itself
    // "standard" (an online-only version, the last-generation copy) would be
    // indistinguishable that way, so it goes by its product name instead.
    const edition =
      product === standard
        ? 'standard'
        : (!saysStandard(product) && isBigger(product) && product.edition?.name) ||
          withoutLanguages(product.name ?? product.id);
    observations.push({
      storeProductId: product.id,
      title: product.name ?? concept.name,
      edition,
      platform,
      url: `https://store.playstation.com/${opts.locale}/product/${product.id}`,
      coverUrl: coverOf(product) ?? coverOf(concept),
      publisher: product.publisherName ?? concept.publisherName ?? null,
      genre: product.localizedGenres?.[0]?.value ?? null,
      price: { basePrice, salePrice, memberPrice },
      sale,
      releaseDate: releaseDay(product.releaseDate),
      korean: koreanOf(product),
      subscription: subscriptionOf(product, ctas),
    });
  }
  return observations;
}

export function parseConceptPage(
  html: string,
  conceptId: string,
  opts: { locale: string; currency: string; match?: string },
): Observation[] {
  return observationsFromCache(extractCache(html), conceptId, opts);
}

export async function collectPlayStation(
  conceptId: string,
  opts: { locale: string; currency: string; match?: string },
): Promise<Observation[]> {
  const url = `https://store.playstation.com/${opts.locale}/concept/${conceptId}`;
  // Now and then the store answers with an empty shell of the page (no title,
  // no data), and the full page a moment later. Ask up to three times.
  let html = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, 'accept-language': opts.locale },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`PS Store: ${url} responded ${res.status}`);
    html = await res.text();
    if (html.includes(`Concept:${conceptId}`)) break;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return parseConceptPage(html, conceptId, opts);
}
