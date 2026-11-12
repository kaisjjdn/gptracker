// Coupang collector, for boxed (disc / cartridge) prices.
//
// Uses the Coupang Partners product search API. Needs COUPANG_ACCESS_KEY and
// COUPANG_SECRET_KEY, which Coupang issues once the Partners account is
// approved. The links it returns are affiliate links, so pages showing them
// must carry the Partners disclosure. The search API allows very few calls
// (see MAX_PER_RUN in run.ts).
import { createHmac } from 'node:crypto';
import type { Observation } from '../types';
import { pickOffers, toObservation, type DiscSpec, type Offer } from './match';

const HOST = 'https://api-gateway.coupang.com';
const PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';

type Json = Record<string, any>;

// Coupang's HMAC header: the signed text is date + method + path + query.
export function authorization(
  method: string,
  path: string,
  query: string,
  keys: { accessKey: string; secretKey: string },
  now: Date,
): string {
  // yyMMddTHHmmssZ, in UTC
  const signedDate = now.toISOString().slice(2, 19).replace(/[-:]/g, '') + 'Z';
  const signature = createHmac('sha256', keys.secretKey).update(`${signedDate}${method}${path}${query}`).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${keys.accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

export function offersFromCoupang(body: Json): Offer[] {
  if (String(body.rCode) !== '0') throw new Error(`Coupang: search failed (${body.rCode} ${body.rMessage ?? ''})`);
  const products = body.data?.productData;
  if (!Array.isArray(products)) throw new Error('Coupang: unexpected response (no productData)');
  const offers: Offer[] = [];
  for (const p of products as Json[]) {
    const price = Number(p.productPrice);
    if (!p.productId || !Number.isInteger(price) || price <= 0) continue;
    // Everything is sold through Coupang, so there is one seller: keep only the cheapest match.
    offers.push({ id: String(p.productId), title: String(p.productName ?? ''), price, seller: null, url: String(p.productUrl) });
  }
  return offers;
}

export async function collectCoupang(
  spec: DiscSpec,
  keys: { accessKey: string; secretKey: string },
): Promise<Observation[]> {
  const query = new URLSearchParams({ keyword: spec.query, limit: '10' }).toString();
  const res = await fetch(`${HOST}${PATH}?${query}`, {
    headers: { Authorization: authorization('GET', PATH, query, keys, new Date()) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Coupang: search responded ${res.status}`);
  return pickOffers(offersFromCoupang(await res.json()), spec, 1).map((o) => toObservation(o, spec));
}
