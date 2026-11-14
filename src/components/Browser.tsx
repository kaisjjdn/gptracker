import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadCatalog } from '@/lib/catalog';
import { sized } from '@/lib/image';
import { atLow, comparable, SORT_DEFAULT, sortGames, type SortDir, type SortKey } from '@/lib/view';
import { GameDetail } from './GameDetail';

const FILTERS = [
  ['all', '전체'],
  ['sale', '할인 중'],
  ['low', '역대 최저가'],
] as const;

const SORTS: [SortKey, string][] = [
  ['release', '출시일순'],
  ['price', '가격순'],
  ['discount', '할인율순'],
];

export type BrowserParams = { f?: string; q?: string; s?: string; d?: string };
type View = { filter: string; q: string; sort: SortKey; dir: SortDir };

// What the address asks for, with anything unknown replaced by the default.
function readView(params: BrowserParams): View {
  const filter = FILTERS.some(([k]) => k === params.f) ? params.f! : 'all';
  const sort = SORTS.some(([k]) => k === params.s) ? (params.s as SortKey) : 'release';
  const dir = params.d === 'asc' || params.d === 'desc' ? params.d : SORT_DEFAULT[sort];
  return { filter, q: (params.q ?? '').trim(), sort, dir };
}

function query({ filter, q, sort, dir }: View) {
  const p = new URLSearchParams();
  if (filter !== 'all') p.set('f', filter);
  if (q) p.set('q', q);
  if (sort !== 'release') p.set('s', sort);
  if (dir !== SORT_DEFAULT[sort]) p.set('d', dir);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// A game's picture, or a coloured tile with its first letter when there is none.
function Art({ title, slug, url }: { title: string; slug: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={sized(url, 320)} alt="" />;
  }
  let hue = 0;
  for (const ch of slug) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="letter num" style={{ background: `hsl(${hue} 55% 42%)` }}>
      {title[0]}
    </span>
  );
}

// The home screen: every tracked game as a cover tile. A tile opens the game's page.
export async function GameGrid({ params }: { params: BrowserParams }) {
  const games = await loadCatalog();
  const view = readView(params);
  const { filter, q, sort, dir } = view;
  const needle = q.toLowerCase();

  const matching = games.filter((g) => {
    if (needle && !g.title.toLowerCase().includes(needle)) return false;
    if (filter === 'sale') return comparable(g.series).some((s) => s.pct > 0);
    if (filter === 'low') return comparable(g.series).some(atLow);
    return true;
  });
  const items = sortGames(matching, sort, dir);

  return (
    <main className="home">
      <div className="filters" role="group" aria-label="목록 필터">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/${query({ ...view, filter: k })}`} aria-current={k === filter} scroll={false}>
            {label}
          </Link>
        ))}
        <span className="count">{items.length}개</span>
      </div>
      <div className="sorts" role="group" aria-label="정렬">
        {SORTS.map(([k, label]) => {
          const active = k === sort;
          // Choosing the current sort again flips its direction.
          const next: SortDir = active ? (dir === 'asc' ? 'desc' : 'asc') : SORT_DEFAULT[k];
          return (
            <Link key={k} href={`/${query({ ...view, sort: k, dir: next })}`} aria-current={active} scroll={false}>
              {label}
              {active && <span aria-label={dir === 'asc' ? '오름차순' : '내림차순'}> {dir === 'asc' ? '↑' : '↓'}</span>}
            </Link>
          );
        })}
      </div>
      {items.length === 0 ? (
        <div className="empty">조건에 맞는 게임이 없어요. 검색어나 필터를 바꿔 보세요.</div>
      ) : (
        <nav className="grid" aria-label="게임 목록">
          {items.map((g) => {
            // The badge follows the stores selling the plain game.
            const compared = comparable(g.series);
            const pct = Math.max(...compared.map((s) => s.pct));
            const low = compared.some(atLow);
            return (
              <Link key={g.slug} className="tile" href={`/games/${g.slug}${query(view)}`} title={g.title}>
                <Art title={g.title} slug={g.slug} url={g.coverUrl} />
                {low ? <span className="badge low">역대 최저</span> : pct > 0 ? <span className="badge">-{pct}%</span> : null}
                <span className="name">{g.title}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </main>
  );
}

// One game's page.
export async function GamePage({ slug, params }: { slug: string; params: BrowserParams }) {
  const game = (await loadCatalog()).find((g) => g.slug === slug);
  if (!game) notFound();
  return (
    <main className="game">
      <GameDetail key={game.slug} game={game} now={Date.now()} backHref={`/${query(readView(params))}`} />
    </main>
  );
}
