import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectChanges } from './detect-changes';
import type { PriceState } from './types';

const p = (basePrice: number, salePrice: number | null = null, memberPrice: number | null = null): PriceState => ({
  basePrice,
  salePrice,
  memberPrice,
});
const types = (events: { type: string }[]) => events.map((e) => e.type);

test('first observation is a new listing', () => {
  const [e] = detectChanges(null, p(69800));
  assert.equal(e.type, 'new_listing');
  assert.equal(e.oldPrice, null);
  assert.equal(e.newPrice, 69800);
});

test('first observation during a sale records the sale price', () => {
  const [e] = detectChanges(null, p(69800, 46068));
  assert.equal(e.newPrice, 46068);
  assert.match(e.note, /할인가/);
});

test('unchanged price produces no events', () => {
  assert.deepEqual(detectChanges(p(69800, 46068), p(69800, 46068)), []);
});

test('sale start, with discount and end date in Korean time', () => {
  const sale = { externalId: 'PROMO-1', name: null, endsAt: new Date('2026-11-20T14:59:00Z') };
  const [e] = detectChanges(p(69800), p(69800, 46068), { sale });
  assert.equal(e.type, 'sale_start');
  assert.equal(e.oldPrice, 69800);
  assert.equal(e.newPrice, 46068);
  assert.equal(e.note, '34% 할인, 2026.11.20까지 진행돼요.');
});

test('sale end returns to the regular price', () => {
  const [e] = detectChanges(p(69800, 46068), p(69800));
  assert.equal(e.type, 'sale_end');
  assert.equal(e.oldPrice, 46068);
  assert.equal(e.newPrice, 69800);
});

test('regular price increase and decrease', () => {
  const [up] = detectChanges(p(69800), p(79800));
  assert.equal(up.type, 'base_price_up');
  assert.equal(up.note, '정가가 ₩69,800에서 ₩79,800로 올랐어요.');
  assert.deepEqual(types(detectChanges(p(79800), p(59800))), ['base_price_down']);
});

test('sale ends and regular price rises on the same day', () => {
  assert.deepEqual(types(detectChanges(p(69800, 34900), p(79800))), ['sale_end', 'base_price_up']);
});

test('regular price rises on the day a sale starts', () => {
  const events = detectChanges(p(69800), p(79800, 39900));
  assert.deepEqual(types(events), ['base_price_up', 'sale_start']);
  assert.equal(events[1].oldPrice, 79800);
});

test('back-to-back campaigns are an end and a start', () => {
  const sale = { externalId: 'PROMO-2', name: null, endsAt: null };
  const events = detectChanges(p(69800, 46068), p(69800, 34900), { sale, prevSaleId: 'PROMO-1' });
  assert.deepEqual(types(events), ['sale_end', 'sale_start']);
});

test('deeper discount within the same campaign is a price change', () => {
  const sale = { externalId: 'PROMO-1', name: null, endsAt: null };
  const events = detectChanges(p(69800, 46068), p(69800, 34900), { sale, prevSaleId: 'PROMO-1' });
  assert.deepEqual(types(events), ['price_change']);
});

test('member-only price appearing is a price change', () => {
  const [e] = detectChanges(p(69800), p(69800, null, 55840));
  assert.equal(e.type, 'price_change');
  assert.equal(e.newPrice, 55840);
  assert.match(e.note, /회원 할인가/);
});

test('a shop price is tracked as plain price moves', () => {
  const [first] = detectChanges(null, p(52000), { retail: true });
  assert.equal(first.type, 'new_listing');
  assert.match(first.note, /판매가/);
  assert.deepEqual(detectChanges(p(52000), p(52000), { retail: true }), []);
  const [down] = detectChanges(p(52000), p(47800), { retail: true });
  assert.equal(down.type, 'price_change');
  assert.equal(down.oldPrice, 52000);
  assert.equal(down.newPrice, 47800);
  assert.match(down.note, /내렸어요/);
});
