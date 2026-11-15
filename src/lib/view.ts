// Shapes the screens work with, and the pure logic that builds them from
// stored price points and events. No database access here, so it is testable.

export type Family = 'ps' | 'sw' | 'xb';
export type ChangeKind = 'launch' | 'sale' | 'end' | 'hike' | 'cut' | 'other';

// One step in a price history: from `t` on, the price was `price`.
export type Change = { t: number; price: number; base: number; kind: ChangeKind; label: string; note: string };

// The price history of one item on one store.
export type Track = {
  url: string | null;
  changes: Change[];
  sales: { s: number; e: number | null }[]; // periods spent on sale; e is null while it runs
  cur: number;
  base: number;
  member: number | null;
  low: number;
  pct: number; // current discount off the regular price
  saleEndsAt: number | null;
};

// A store's view of a game: the plain game's history, plus that of every other
// edition the store sells.
export type Series = Track & {
  key: Family;
  storeName: string;
  chip: string; // console label for the list
  edition: string | null; // set when this store only sells a bigger edition, not the plain game
  editions: (Track & { name: string })[]; // cheapest first
};

export type DiscView = {
  changes: { t: number; price: number; note: string }[]; // lowest price across shops over time
  cur: number;
  low: number;
  sellers: { name: string; note: string | null; price: number; url: string | null }[];
  affiliate: boolean;
};

export type GameView = {
  slug: string;
  title: string;
  genre: string | null;
  publisher: string | null;
  coverUrl: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  series: Series[];
  disc: DiscView | null;
};

export type PointRow = { t: number; base: number; sale: number | null; member: number | null };
export type EventRow = { t: number; type: string; note: string | null; saleName: string | null; saleEndsAt: number | null };

const PRIORITY = ['sale_start', 'sale_end', 'base_price_up', 'base_price_down', 'price_change', 'new_listing'];

// Turn stored price points, plus the events recorded at the same moments, into
// labelled steps for the chart and the change log.
export function buildChanges(points: PointRow[], events: EventRow[]): Change[] {
  return points.map((p, i) => {
    const at = events.filter((e) => e.t === p.t).sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
    const main = at[0];
    const note = at.map((e) => e.note).filter(Boolean).join(' ');
    let kind: ChangeKind = 'other';
    let label = '가격 변경';
    if (i === 0) {
      kind = 'launch';
      label = note.includes('출시') ? '출시' : '추적 시작';
    } else if (main?.type === 'sale_start') {
      kind = 'sale';
      label = main.saleName ?? '세일 시작';
    } else if (main?.type === 'sale_end') {
      kind = 'end';
      label = '세일 종료';
    } else if (main?.type === 'base_price_up') {
      kind = 'hike';
      label = '정가 인상';
    } else if (main?.type === 'base_price_down') {
      kind = 'cut';
      label = '정가 인하';
    }
    return { t: p.t, price: p.sale ?? p.base, base: p.base, kind, label, note };
  });
}

export function salePeriods(points: PointRow[]): { s: number; e: number | null }[] {
  const periods: { s: number; e: number | null }[] = [];
  let open: { s: number; e: number | null } | null = null;
  for (const p of points) {
    if (p.sale !== null && !open) periods.push((open = { s: p.t, e: null }));
    else if (p.sale === null && open) {
      open.e = p.t;
      open = null;
    }
  }
  return periods;
}

// The lowest price across several shops over time. Each shop's history is a
// list of steps; a shop counts from its first step on.
export function lowestOverTime(histories: { t: number; price: number; note: string }[][]): DiscView['changes'] {
  const times = [...new Set(histories.flatMap((h) => h.map((x) => x.t)))].sort((a, b) => a - b);
  const out: DiscView['changes'] = [];
  for (const t of times) {
    let best: number | null = null;
    let note = '';
    for (const h of histories) {
      const step = h.findLast((x) => x.t <= t);
      if (!step) continue;
      if (best === null || step.price < best) {
        best = step.price;
        note = step.t === t ? step.note : '';
      }
    }
    if (best !== null && out.at(-1)?.price !== best) out.push({ t, price: best, note });
  }
  return out;
}

export const atLow = (s: Track) => s.changes.length > 1 && s.cur <= s.low;

// The stores to compare when showing one price for a game: those selling the
// plain game. A bigger edition is a different product, so it only counts when
// no store sells the plain game.
export function comparable(series: Series[]): Series[] {
  const plain = series.filter((s) => s.edition === null);
  return plain.length > 0 ? plain : series;
}

export type SortKey = 'release' | 'price' | 'discount' | 'name';
export type SortDir = 'asc' | 'desc';
// The direction each sort starts in: newest first, cheapest first, biggest discount first.
export const SORT_DEFAULT: Record<SortKey, SortDir> = { release: 'desc', price: 'asc', discount: 'desc', name: 'asc' };

// Order games for the grid. Price and discount follow the stores selling the
// plain game; games without a release date always go last.
export function sortGames(games: GameView[], key: SortKey, dir: SortDir): GameView[] {
  const sign = dir === 'asc' ? 1 : -1;
  const price = (g: GameView) => Math.min(...comparable(g.series).map((s) => s.cur));
  const discount = (g: GameView) => Math.max(...comparable(g.series).map((s) => s.pct));
  return [...games].sort((a, b) => {
    if (key === 'name') return sign * a.title.localeCompare(b.title, 'ko');
    if (key === 'release') {
      if (!a.releaseDate || !b.releaseDate) return Number(!a.releaseDate) - Number(!b.releaseDate);
      return sign * a.releaseDate.localeCompare(b.releaseDate);
    }
    const value = key === 'price' ? price : discount;
    return sign * (value(a) - value(b)) || price(a) - price(b);
  });
}

export type Verdict = { tone: 'good' | 'wait' | 'ok'; head: string; text: string; sub: string };

const DAY = 86_400_000;
const won = (n: number) => '₩' + n.toLocaleString('ko-KR');
export const fmtDay = (t: number) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(t)).replaceAll('-', '.');

// Is now a good time to buy? Based only on this listing's own history.
export function verdict(s: Track, now: number): Verdict {
  if (s.changes.length < 2) {
    return {
      tone: 'ok',
      head: '기록 쌓는 중',
      text: '추적을 시작한 지 얼마 안 됐어요.',
      sub: '가격 기록이 쌓이면 지금이 살 때인지 알려드려요.',
    };
  }
  const starts = s.changes.filter((c) => c.kind === 'sale');
  const n = starts.length;
  if (n === 0) return { tone: 'ok', head: '가격 변동 없음', text: '추적 이후 아직 세일한 적이 없어요.', sub: '' };
  const avg = n > 1 ? Math.round((starts[n - 1].t - starts[0].t) / (n - 1) / DAY) : null;
  const since = Math.round((now - starts[n - 1].t) / DAY);
  const hist = `지금까지 세일 ${n}번${avg ? `, 평균 ${avg}일 간격` : ''}이었어요.`;
  if (s.cur <= s.low) {
    return {
      tone: 'good',
      head: '사기 좋은 때',
      text: '지금이 역대 최저가예요.',
      sub: s.pct > 0 && s.saleEndsAt ? `이번 세일은 ${fmtDay(s.saleEndsAt)}에 끝나요. ${hist}` : hist,
    };
  }
  const diff = Math.round(((s.cur - s.low) / s.low) * 100);
  return {
    tone: diff >= 30 ? 'wait' : 'ok',
    head: diff >= 30 ? '기다려 보세요' : '나쁘지 않아요',
    text: `역대 최저가 ${won(s.low)}보다 ${diff}% 비싸요.`,
    sub: `${hist} 마지막 세일은 ${since}일 전에 시작했어요.`,
  };
}
