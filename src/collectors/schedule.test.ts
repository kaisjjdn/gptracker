import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isHot, plan, type GameState } from './schedule';

const HOUR = 3_600_000;
const now = new Date('2026-11-16T03:37:00Z');
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);
const state = (over: Partial<GameState>): GameState => ({
  checkedAt: ago(12), changedAt: ago(24 * 60), onSale: false, releaseDate: '2020-01-01', ...over,
});

test('games on sale, recently changed, new or unreleased are hot', () => {
  assert.equal(isHot(state({}), now), false);
  assert.equal(isHot(state({ onSale: true }), now), true);
  assert.equal(isHot(state({ changedAt: ago(24 * 3) }), now), true);
  assert.equal(isHot(state({ releaseDate: '2026-10-23' }), now), true);
  assert.equal(isHot(state({ releaseDate: '2026-11-19' }), now), true); // not out yet
  assert.equal(isHot(state({ releaseDate: null }), now), false);
});

test('hot games are read every run, the rest every third day', () => {
  const items = [
    { item: 'hot-12h', state: state({ onSale: true }) },
    { item: 'hot-2h', state: state({ onSale: true, checkedAt: ago(2) }) },
    { item: 'cold-12h', state: state({}) },
    { item: 'cold-3d', state: state({ checkedAt: ago(72) }) },
  ];
  const p = plan(items, now);
  assert.deepEqual([...p.due].sort(), ['cold-3d', 'hot-12h']);
  assert.equal(p.hot, 1);
  assert.equal(p.resting, 2);
});

test('never-read games come first, then the most overdue', () => {
  const items = [
    { item: 'cold-4d', state: state({ checkedAt: ago(96) }) }, // 1.4 intervals
    { item: 'hot-30h', state: state({ onSale: true, checkedAt: ago(30) }) }, // 3 intervals
    { item: 'new', state: undefined },
    { item: 'hot-12h', state: state({ onSale: true }) }, // 1.2 intervals
  ];
  assert.deepEqual(plan(items, now).due, ['new', 'hot-30h', 'cold-4d', 'hot-12h']);
});
