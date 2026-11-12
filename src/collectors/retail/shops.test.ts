import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorization, offersFromCoupang } from './coupang';
import type { DiscSpec } from './match';
import { toObservation } from './match';

const spec: DiscSpec = { platform: 'ps5', query: 'PS5 아스트로봇', names: ['아스트로봇'] };

test('an offer becomes a disc observation', () => {
  const obs = toObservation({ id: '1', title: 'PS5 아스트로봇', price: 51800, seller: null, url: 'https://example.test/1' }, spec);
  assert.equal(obs.format, 'disc');
  assert.equal(obs.platform, 'ps5');
  assert.equal(obs.edition, 'standard');
  assert.deepEqual(obs.price, { basePrice: 51800, salePrice: null, memberPrice: null });
});

test('Coupang: signs the request as date + method + path + query', () => {
  const header = authorization('GET', '/p', 'keyword=a', { accessKey: 'AK', secretKey: 'SK' }, new Date('2026-11-12T03:04:05Z'));
  assert.match(header, /^CEA algorithm=HmacSHA256, access-key=AK, signed-date=261112T030405Z, signature=[0-9a-f]{64}$/);
});

test('Coupang: reads products and reports API errors', () => {
  const offers = offersFromCoupang({
    rCode: '0',
    data: { productData: [{ productId: 77, productName: 'PS5 아스트로봇', productPrice: 52900, productUrl: 'https://link.coupang.com/a/x' }] },
  });
  assert.deepEqual(offers, [{ id: '77', title: 'PS5 아스트로봇', price: 52900, seller: null, url: 'https://link.coupang.com/a/x' }]);
  assert.throws(() => offersFromCoupang({ rCode: '400', rMessage: 'bad' }), /search failed/);
});
