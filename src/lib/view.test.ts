import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChanges, lowestOverTime, salePeriods, verdict, type EventRow, type PointRow, type Series } from './view';

const DAY = 86_400_000;
const ev = (t: number, type: string, note = '', saleName: string | null = null): EventRow => ({ t, type, note, saleName, saleEndsAt: null });

test('labels each price step from the events recorded with it', () => {
  const points: PointRow[] = [
    { t: 1, base: 69800, sale: null, member: null },
    { t: 2, base: 69800, sale: 48860, member: null },
    { t: 3, base: 79800, sale: null, member: null },
  ];
  const events = [
    ev(1, 'new_listing', '정가 ₩69,800로 추적을 시작했어요.'),
    ev(2, 'sale_start', '30% 할인', '여름 세일'),
    ev(3, 'base_price_up', '정가가 올랐어요.'),
    ev(3, 'sale_end', '세일이 끝났어요.'),
  ];
  const changes = buildChanges(points, events);
  assert.deepEqual(changes.map((c) => [c.kind, c.label, c.price]), [
    ['launch', '추적 시작', 69800],
    ['sale', '여름 세일', 48860],
    ['end', '세일 종료', 79800],
  ]);
  assert.equal(changes[2].note, '세일이 끝났어요. 정가가 올랐어요.');
  assert.deepEqual(salePeriods(points), [{ s: 2, e: 3 }]);
});

test('a sale without a name gets a generic label, and an open sale has no end', () => {
  const points: PointRow[] = [
    { t: 1, base: 100, sale: null, member: null },
    { t: 2, base: 100, sale: 50, member: null },
  ];
  assert.equal(buildChanges(points, [ev(2, 'sale_start')])[1].label, '세일 시작');
  assert.deepEqual(salePeriods(points), [{ s: 2, e: null }]);
});

test('lowest price across shops over time', () => {
  const a = [{ t: 1, price: 50000, note: 'a1' }, { t: 5, price: 42000, note: 'a2' }];
  const b = [{ t: 3, price: 45000, note: 'b1' }, { t: 7, price: 47000, note: 'b2' }];
  assert.deepEqual(lowestOverTime([a, b]), [
    { t: 1, price: 50000, note: 'a1' },
    { t: 3, price: 45000, note: 'b1' },
    { t: 5, price: 42000, note: 'a2' },
  ]);
});

const series = (changes: Series['changes'], over: Partial<Series> = {}): Series => {
  const last = changes.at(-1)!;
  return {
    key: 'ps', storeName: 'PS 스토어', chip: 'PS5', url: '', changes, sales: [], cur: last.price, base: last.base,
    member: null, low: Math.min(...changes.map((c) => c.price)), pct: 0, saleEndsAt: null, editions: [], ...over,
  };
};
const step = (day: number, price: number, kind: Series['changes'][number]['kind']) => ({ t: day * DAY, price, base: 60000, kind, label: '', note: '' });

test('verdict: too little history, good time, and wait', () => {
  assert.equal(verdict(series([step(0, 60000, 'launch')]), DAY).head, '기록 쌓는 중');
  const low = series([step(0, 60000, 'launch'), step(100, 30000, 'sale')]);
  assert.equal(verdict(low, 101 * DAY).head, '사기 좋은 때');
  const back = series([step(0, 60000, 'launch'), step(100, 30000, 'sale'), step(114, 60000, 'end')]);
  const v = verdict(back, 150 * DAY);
  assert.equal(v.head, '기다려 보세요');
  assert.match(v.text, /100% 비싸요/);
  assert.match(v.sub, /50일 전/);
});
