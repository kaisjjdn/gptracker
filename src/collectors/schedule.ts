// Decides which games a collection run reads, and in what order.
//
// Reading every game on every run stops scaling as the catalog grows, so each
// game has a checking interval: "hot" games (new, recently changed, on sale)
// are read on every run, the rest every few days. A run reads the most overdue
// games first and stops when its time budget is spent; whatever is left is
// simply the most overdue next time.

export type GameState = {
  checkedAt: Date | null; // last time this store's page for the game was read
  changedAt: Date | null; // last time one of its prices changed (or was first recorded)
  onSale: boolean; // a sale price is showing on this store
  releaseDate: string | null; // YYYY-MM-DD
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// A little under the gap between runs, so a run that starts a few minutes
// early still picks its games up.
export const HOT_INTERVAL = 10 * HOUR; // with two runs a day: every run
export const COLD_INTERVAL = 3 * DAY - 2 * HOUR; // every third day
const RECENT_CHANGE = 14 * DAY;
const RECENT_RELEASE = 90 * DAY;

// Worth reading on every run: its price is moving or likely to.
export function isHot(state: GameState, now: Date): boolean {
  if (state.onSale) return true; // the sale will end, and may deepen
  if (state.changedAt && now.getTime() - state.changedAt.getTime() < RECENT_CHANGE) return true;
  if (state.releaseDate) {
    const released = new Date(`${state.releaseDate}T00:00:00+09:00`).getTime();
    if (now.getTime() - released < RECENT_RELEASE) return true; // new, or not out yet
  }
  return false;
}

export type Plan<T> = { due: T[]; hot: number; resting: number };

// The games to read now, most overdue first. Games never read come first of all.
export function plan<T>(items: { item: T; state: GameState | undefined }[], now: Date): Plan<T> {
  const due: { item: T; overdue: number }[] = [];
  let hot = 0;
  let resting = 0;
  for (const { item, state } of items) {
    if (!state?.checkedAt) {
      due.push({ item, overdue: Infinity });
      continue;
    }
    const isHotGame = isHot(state, now);
    const interval = isHotGame ? HOT_INTERVAL : COLD_INTERVAL;
    // How many intervals have passed: 1 means exactly due, 2 means a whole interval late.
    const overdue = (now.getTime() - state.checkedAt.getTime()) / interval;
    if (overdue >= 1) {
      due.push({ item, overdue });
      if (isHotGame) hot += 1;
    } else resting += 1;
  }
  due.sort((a, b) => b.overdue - a.overdue);
  return { due: due.map((d) => d.item), hot, resting };
}
