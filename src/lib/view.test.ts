import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChanges, cheapestStore, comparable, highlights, inScope, lowestOverTime, salePeriods, sortGames, verdict, type GameView, type EventRow, type PointRow, type Series } from './view';

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
    key: 'ps', storeName: 'PS 스토어', chip: 'PS5', edition: null, url: '', changes, sales: [], cur: last.price, base: last.base,
    member: null, korean: null, low: Math.min(...changes.map((c) => c.price)), pct: 0, saleEndsAt: null, editions: [], ...over,
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

test('a bigger edition is left out of price comparisons unless nothing else is sold', () => {
  const plain = series([step(0, 60000, 'launch')]);
  const complete = series([step(0, 30000, 'launch')], { key: 'sw', edition: '컴플리트 에디션' });
  assert.deepEqual(comparable([plain, complete]), [plain]);
  assert.deepEqual(comparable([complete]), [complete]);
});

test('sorts games by release date, price and discount', () => {
  const game = (slug: string, releaseDate: string | null, price: number, pct: number): GameView => ({
    slug, title: slug, genre: null, publisher: null, coverUrl: null, releaseDate, disc: null,
    series: [series([step(0, price, 'launch')], { pct })],
  });
  const games = [game('old', '2020-03-20', 30000, 50), game('undated', null, 10000, 0), game('new', '2026-11-19', 89800, 0)];
  const order = (key: Parameters<typeof sortGames>[1], dir: Parameters<typeof sortGames>[2]) => sortGames(games, key, dir).map((g) => g.slug);
  assert.deepEqual(order('release', 'desc'), ['new', 'old', 'undated']);
  assert.deepEqual(order('release', 'asc'), ['old', 'new', 'undated']);
  assert.deepEqual(order('price', 'asc'), ['undated', 'old', 'new']);
  assert.deepEqual(order('discount', 'desc'), ['old', 'undated', 'new']);
  assert.deepEqual(order('name', 'asc'), ['new', 'old', 'undated']);
  assert.deepEqual(order('name', 'desc'), ['undated', 'old', 'new']);
});

test('scope narrows a game to one platform and to Korean-language versions', () => {
  const ps = series([step(0, 60000, 'launch')], { key: 'ps', korean: false });
  const xb = series([step(0, 50000, 'launch')], { key: 'xb', korean: true });
  const game: GameView = { slug: 'g', title: 'g', genre: null, publisher: null, coverUrl: null, releaseDate: null, disc: null, series: [ps, xb] };
  assert.deepEqual(inScope(game, { platform: null, korean: false }), [ps, xb]);
  assert.deepEqual(inScope(game, { platform: 'ps', korean: false }), [ps]);
  assert.deepEqual(inScope(game, { platform: null, korean: true }), [xb]);
  assert.deepEqual(inScope(game, { platform: 'ps', korean: true }), []);
  assert.deepEqual(inScope(game, { platform: 'sw', korean: false }), []);
});

test('highlights: sales ending soon, sales just started, and fresh lows', () => {
  const now = 100 * DAY;
  const game = (slug: string, s: Series): GameView => ({ slug, title: slug, genre: null, publisher: null, coverUrl: null, releaseDate: null, disc: null, series: [s] });
  const ending = game('ending', series([step(0, 60000, 'launch'), step(80, 30000, 'sale')], { pct: 50, saleEndsAt: now + 2 * DAY }));
  const later = game('later', series([step(0, 60000, 'launch'), step(80, 30000, 'sale')], { pct: 50, saleEndsAt: now + 10 * DAY }));
  const fresh = game('fresh', series([step(0, 60000, 'launch'), step(99, 45000, 'sale')], { pct: 25, saleEndsAt: now + 20 * DAY }));
  const firstSeenOnSale = game('first-seen', series([step(99, 30000, 'launch')], { pct: 50 }));
  const h = highlights([later, ending, fresh, firstSeenOnSale], now);
  assert.deepEqual(h.ending.map((x) => x.game.slug), ['ending']);
  assert.deepEqual(h.started.map((x) => x.game.slug), ['fresh']);
  assert.deepEqual(h.lows.map((x) => x.game.slug), ['fresh']); // "ending" reached its low 20 days ago
});

test('cheapest store: needs two stores selling the plain game at different prices', () => {
  const at = (key: Series['key'], price: number, over: Partial<Series> = {}) => series([step(0, price, 'launch')], { key, storeName: key, ...over });
  const game = (list: Series[]): GameView => ({ slug: 'g', title: 'g', genre: null, publisher: null, coverUrl: null, releaseDate: null, disc: null, series: list });
  const c = cheapestStore(game([at('ps', 60000), at('xb', 45000), at('sw', 50000)]))!;
  assert.deepEqual([c.best.key, c.next.key], ['xb', 'sw']);
  assert.equal(cheapestStore(game([at('ps', 60000)])), null);
  assert.equal(cheapestStore(game([at('ps', 60000), at('xb', 60000)])), null);
  assert.equal(cheapestStore(game([at('ps', 60000), at('sw', 30000, { edition: '컴플리트 에디션' })])), null);
});
