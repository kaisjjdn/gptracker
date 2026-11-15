import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractCache, observationsFromCache, parseConceptPage } from './playstation';

const html = readFileSync(new URL('./fixtures/ps-concept.html', import.meta.url), 'utf8');
const opts = { locale: 'ko-kr', currency: 'KRW' };

test('parses every edition of a game from a captured page', () => {
  const observations = parseConceptPage(html, '10002684', opts);
  assert.equal(observations.length, 2);

  const standard = observations.find((o) => o.edition === 'standard')!;
  assert.equal(standard.storeProductId, 'HP9000-PPSA21568_00-0000000000000000');
  assert.equal(standard.platform, 'ps5');
  assert.equal(standard.publisher, 'Sony Interactive Entertainment');
  assert.deepEqual(standard.price, { basePrice: 69800, salePrice: 46068, memberPrice: null });
  assert.equal(standard.sale?.externalId, 'PROMO-PROD-00020015');
  assert.equal(standard.sale?.endsAt?.toISOString(), '2026-11-20T14:59:00.000Z');
  assert.equal(standard.url, 'https://store.playstation.com/ko-kr/product/HP9000-PPSA21568_00-0000000000000000');

  const deluxe = observations.find((o) => o.edition === '디지털 디럭스 에디션')!;
  assert.deepEqual(deluxe.price, { basePrice: 79800, salePrice: null, memberPrice: null });
  assert.equal(deluxe.sale, null);
});

test('a subscriber-only offer becomes the member price, not the sale price', () => {
  const cache = extractCache(html);
  for (const [key, value] of Object.entries(cache)) {
    if (!key.startsWith('GameCTA:') || !key.includes('-0000000000000000-')) continue;
    for (const detail of value.local.telemetryMeta.skuDetail.skuPriceDetail) {
      detail.offerIsTiedToSubscription = true;
      detail.offerBranding = 'PS_PLUS';
    }
  }
  const standard = observationsFromCache(cache, '10002684', opts).find((o) => o.edition === 'standard')!;
  assert.deepEqual(standard.price, { basePrice: 69800, salePrice: null, memberPrice: 46068 });
  assert.equal(standard.sale, null);
});

test('"included with PS Plus" is not treated as a price', () => {
  const cache = extractCache(html);
  const id = 'HP9000-PPSA21568_00-DDE0000000000000';
  cache[`GameCTA:UPSELL_PS_PLUS_GAME_CATALOG:${id}`] = {
    local: {
      telemetryMeta: {
        skuDetail: {
          skuId: `${id}-K002`,
          skuPriceDetail: [
            {
              originalPriceValue: 79800,
              discountPriceValue: 0,
              priceCurrencyCode: 'KRW',
              offerBranding: 'PS_PLUS',
              offerIsTiedToSubscription: true,
            },
          ],
        },
      },
    },
  };
  const deluxe = observationsFromCache(cache, '10002684', opts).find((o) => o.storeProductId === id)!;
  assert.deepEqual(deluxe.price, { basePrice: 79800, salePrice: null, memberPrice: null });
});

test('demos are skipped and a second standard product gets its own edition name', () => {
  const cache = extractCache(html);
  const deluxeId = 'HP9000-PPSA21568_00-DDE0000000000000';
  // Turn the deluxe edition into a second "standard" product, like an online-only version.
  cache[`Product:${deluxeId}`].edition = { type: 'STANDARD', name: 'Standard Edition' };
  cache[`Product:${deluxeId}`].name = '아스트로봇 온라인 (중국어(간체자), 한국어, 영어)';
  // Turn nothing else into a demo: add one.
  cache['Product:DEMO'] = { id: 'DEMO', name: '아스트로봇 DEMO', topCategory: 'DEMO', platforms: ['PS5'] };
  cache['Concept:10002684'].products.push({ __ref: 'Product:DEMO' });

  const observations = observationsFromCache(cache, '10002684', opts);
  assert.deepEqual(observations.map((o) => o.edition).sort(), ['standard', '아스트로봇 온라인']);
});

test('fails loudly when the page no longer contains the game', () => {
  assert.throws(() => parseConceptPage('<html></html>', '10002684', opts), /page structure may have changed/);
});

test('rejects prices in an unexpected currency', () => {
  assert.throws(() => parseConceptPage(html, '10002684', { locale: 'en-us', currency: 'USD' }), /priced in KRW/);
});

test('release dates are given in Korean time, and placeholders are dropped', async () => {
  const { releaseDay } = await import('../types');
  assert.equal(releaseDay('2024-09-05T15:00:00Z'), '2024-09-06');
  assert.equal(releaseDay('9998-12-30T00:00:00Z'), null);
  assert.equal(releaseDay(undefined), null);
  assert.equal(releaseDay('not a date'), null);
});

test('a deluxe edition the page does not label is not taken as the standard edition', async () => {
  const { observationsFromCache } = await import('./playstation');
  const cta = (id: string, price: number) => ({
    local: { telemetryMeta: { skuDetail: { skuId: `${id}-SKU`, skuPriceDetail: [{ originalPriceValue: price, discountPriceValue: price, priceCurrencyCode: 'KRW', offerIsTiedToSubscription: false, offerBranding: 'NONE' }] } } },
  });
  // Older pages mark every edition as "OTHER", with no name.
  const product = (id: string, name: string) => ({ id, name, topCategory: 'GAME', platforms: ['PS4'], storeDisplayClassification: 'FULL_GAME', edition: { name: '', type: 'OTHER' } });
  const cache = {
    'Concept:1': { name: 'DARK SOULS III', defaultProduct: { __ref: 'Product:DLX' }, products: [{ __ref: 'Product:DLX' }, { __ref: 'Product:STD' }] },
    'Product:DLX': product('DLX', 'DARK SOULS™ III - 디럭스 에디션'),
    'Product:STD': product('STD', 'DARK SOULS™ III'),
    'GameCTA:a': cta('DLX', 89600),
    'GameCTA:b': cta('STD', 64800),
  };
  const observations = observationsFromCache(cache, '1', { locale: 'ko-kr', currency: 'KRW' });
  const standard = observations.find((o) => o.edition === 'standard')!;
  assert.equal(standard.storeProductId, 'STD');
  assert.equal(standard.price.basePrice, 64800);
  assert.equal(observations.find((o) => o.storeProductId === 'DLX')!.edition, 'DARK SOULS™ III - 디럭스 에디션');
});
