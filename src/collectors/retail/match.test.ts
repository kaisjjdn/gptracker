import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, pickOffers, platformsIn, rejectReason, type DiscSpec, type Offer } from './match';

const astro: DiscSpec = { platform: 'ps5', query: 'PS5 아스트로봇', names: ['아스트로봇', 'ASTRO BOT'] };
const offer = (id: string, title: string, price: number, seller = id): Offer => ({
  id,
  title,
  price,
  seller,
  url: `https://example.test/${id}`,
});

test('normalize drops markup, spaces and punctuation', () => {
  assert.equal(normalize('PS5 <b>아스트로 봇</b> (한글판)'), 'ps5아스트로봇한글판');
});

test('finds the consoles a title names', () => {
  assert.deepEqual([...platformsIn('PS4/PS5 철권 8')].sort(), ['ps4', 'ps5']);
  assert.deepEqual([...platformsIn('플스5 아스트로봇')], ['ps5']);
  assert.deepEqual([...platformsIn('닌텐도 스위치2 마리오카트 월드')], ['switch2']);
  assert.deepEqual([...platformsIn('닌텐도 스위치 2인용 게임')], ['switch']);
  assert.deepEqual([...platformsIn('스위치 페르소나5 더 로열')], ['switch']);
  assert.ok(platformsIn('XBOX 포르자 호라이즌 5').has('xbox_series'));
});

test('accepts a plain standard edition offer', () => {
  assert.equal(rejectReason('소니 PS5 <b>아스트로 봇</b> 한글판 새제품', astro), null);
  assert.equal(rejectReason('[PS5] ASTRO BOT 초회특전 포함', astro), null);
});

test('rejects other games, consoles, editions and non-disc items', () => {
  assert.match(rejectReason('PS5 철권 8 한글판', astro)!, /game name/);
  assert.match(rejectReason('PS4 아스트로봇 레스큐 미션', astro)!, /platform/);
  assert.match(rejectReason('PS5 아스트로봇 중고', astro)!, /중고/);
  assert.match(rejectReason('PS5 아스트로봇 디지털 코드', astro)!, /코드|디지털/);
  assert.match(rejectReason('PS5 본체 + 아스트로봇 번들', astro)!, /본체|번들/);
  assert.match(rejectReason('PS5 아스트로봇 디럭스 에디션', astro)!, /디럭스/);
  assert.match(rejectReason('PS5 아스트로봇 북미판', astro)!, /북미판/);
});

test('a ruled-out word inside the game name itself is fine', () => {
  const kart: DiscSpec = { platform: 'switch', query: '스위치 마리오카트 8 디럭스', names: ['마리오카트 8 디럭스'] };
  assert.equal(rejectReason('닌텐도 스위치 마리오카트8 디럭스 한글판', kart), null);
  assert.match(rejectReason('닌텐도 스위치 마리오카트8 디럭스 본체 세트', kart)!, /본체|세트/);
});

test('picks the cheapest offer per seller and drops outliers', () => {
  const picked = pickOffers(
    [
      offer('a', 'PS5 아스트로봇', 54000, '몰A'),
      offer('b', 'PS5 아스트로봇 한글판', 52000, '몰B'),
      offer('c', 'PS5 아스트로봇', 58000, '몰B'), // same seller, dearer
      offer('d', 'PS5 아스트로봇', 9900, '몰D'), // far below the rest
      offer('e', 'PS5 아스트로봇 중고', 30000, '몰E'),
      offer('f', 'PS5 아스트로봇', 61000, '몰F'),
    ],
    astro,
  );
  assert.deepEqual(picked.map((o) => o.id), ['b', 'a', 'f']);
});

test('keeps at most the requested number of offers', () => {
  const offers = Array.from({ length: 8 }, (_, i) => offer(`m${i}`, 'PS5 아스트로봇', 50000 + i * 1000));
  assert.equal(pickOffers(offers, astro, 5).length, 5);
});
