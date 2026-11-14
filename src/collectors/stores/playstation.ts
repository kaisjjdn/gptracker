// PlayStation Store collector.
//
// Reads the public game page (store.playstation.com/<locale>/concept/<id>),
// which robots.txt allows and which embeds its data as JSON in
// <script id="env:..."> tags. One request returns every edition of a game.
import { releaseDay } from '../types';
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

export function observationsFromCache(
  cache: Json,
  conceptId: string,
  opts: { locale: string; currency: string },
): Observation[] {
  const concept = cache[`Concept:${conceptId}`];
  if (!concept) {
    throw new Error(`PS Store: concept ${conceptId} not found in page data (page structure may have changed)`);
  }
  const ctas = Object.entries<Json>(cache).filter(([key]) => key.startsWith('GameCTA:'));
  const observations: Observation[] = [];

  const products: Json[] = (concept.products ?? [])
    .map((ref: Json) => cache[ref.__ref])
    .filter((p: Json | undefined) => p?.id && p.topCategory === 'GAME'); // drops demos

  // A game page can list several "standard" products (the game itself, an
  // online-only version, a two-game pack). Only one is the game's standard
  // edition: the page's default product if it is standard, else the full game.
  const standards = products.filter((p) => !p.edition?.type || p.edition.type === 'STANDARD');
  const standard =
    standards.find((p) => `Product:${p.id}` === concept.defaultProduct?.__ref) ??
    standards.find((p) => p.storeDisplayClassification === 'FULL_GAME') ??
    standards[0];
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
    // Every purchase button of this product, with its price breakdown. An offer
    // that discounts to zero is "included with a subscription", not a price.
    const offers = ctas.flatMap(([, cta]) => {
      const sku = cta.local?.telemetryMeta?.skuDetail;
      if (!sku?.skuId?.startsWith(product.id)) return [];
      return (sku.skuPriceDetail ?? [])
        .filter((detail: Json) => detail.discountPriceValue > 0)
        .map((detail: Json) => ({ detail, local: cta.local as Json }));
    });
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

    const isOtherStandard = standards.includes(product) && product !== standard;
    const edition =
      product === standard
        ? 'standard'
        : (!isOtherStandard && product.edition?.name) || withoutLanguages(product.name ?? product.id);
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
    });
  }
  return observations;
}

export function parseConceptPage(
  html: string,
  conceptId: string,
  opts: { locale: string; currency: string },
): Observation[] {
  return observationsFromCache(extractCache(html), conceptId, opts);
}

export async function collectPlayStation(
  conceptId: string,
  opts: { locale: string; currency: string },
): Promise<Observation[]> {
  const url = `https://store.playstation.com/${opts.locale}/concept/${conceptId}`;
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, 'accept-language': opts.locale },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`PS Store: ${url} responded ${res.status}`);
  return parseConceptPage(await res.text(), conceptId, opts);
}
