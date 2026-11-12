import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractState, observationsFromState } from './xbox';

const html = readFileSync(new URL('./fixtures/xbox-product.html', import.meta.url), 'utf8');
const opts = { locale: 'ko-KR', currency: 'KRW' };

test('parses every edition, with the Game Pass price as the member price', () => {
  const observations = observationsFromState(extractState(html), '9NKX70BBCDRN', opts);
  assert.equal(observations.length, 3);

  const standard = observations.find((o) => o.edition === 'standard')!;
  assert.equal(standard.storeProductId, '9NKX70BBCDRN');
  assert.equal(standard.platform, 'xbox_series');
  assert.equal(standard.publisher, 'Xbox Game Studios');
  assert.deepEqual(standard.price, { basePrice: 59900, salePrice: null, memberPrice: 47920 });
  assert.equal(standard.sale, null);
  assert.equal(standard.url, 'https://www.xbox.com/ko-KR/games/store/-/9NKX70BBCDRN');

  const deluxe = observations.find((o) => o.storeProductId === '9P1HX37NMJLT')!;
  assert.equal(deluxe.edition, 'Forza Horizon 5 디럭스 에디션');
  assert.deepEqual(deluxe.price, { basePrice: 79900, salePrice: null, memberPrice: null });
});

test('parses a discounted game with its sale end time', () => {
  const [obs] = observationsFromState(extractState(html), 'BXBJQ1932138', opts);
  assert.deepEqual(obs.price, { basePrice: 37900, salePrice: 7580, memberPrice: null });
  assert.equal(obs.sale?.externalId, '9Q7C1097JJ9C');
  assert.equal(obs.sale?.endsAt?.toISOString(), '2026-11-12T09:59:59.000Z');
});

test('fails loudly when the product is not in the page', () => {
  assert.throws(() => observationsFromState(extractState(html), 'MISSING', opts), /page structure may have changed/);
  assert.throws(() => extractState('<html></html>'), /page data not found/);
});

test('rejects prices in an unexpected currency', () => {
  assert.throws(
    () => observationsFromState(extractState(html), '9NKX70BBCDRN', { locale: 'en-US', currency: 'USD' }),
    /priced in KRW/,
  );
});
