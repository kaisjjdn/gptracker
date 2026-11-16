import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadCatalog } from '@/lib/catalog';
import { sized } from '@/lib/image';
import {
  atLow,
  fmtDay,
  highlights,
  inScope,
  SORT_DEFAULT,
  sortGames,
  type Family,
  type Highlight,
  type Scope,
  type SortDir,
  type SortKey,
} from '@/lib/view';
import { GameDetail } from './GameDetail';

const won = (n: number) => '₩' + n.toLocaleString('ko-KR');

const FILTERS = [
  ['all', '전체'],
  ['sale', '할인 중'],
  ['low', '역대 최저가'],
] as const;
const PLATFORMS: [Family, string][] = [
  ['ps', 'PlayStation'],
  ['sw', 'Switch'],
  ['xb', 'Xbox'],
];
const SORTS: [SortKey, string][] = [
  ['release', '출시일순'],
  ['price', '가격순'],
  ['discount', '할인율순'],
  ['name', '이름순'],
];

export type BrowserParams = { f?: string; q?: string; s?: string; d?: string; p?: string; k?: string };
type View = { filter: string; q: string; sort: SortKey; dir: SortDir; platform: Family | null; korean: boolean };

// What the address asks for, with anything unknown replaced by the default.
function readView(params: BrowserParams): View {
  const filter = FILTERS.some(([k]) => k === params.f) ? params.f! : 'all';
  const sort = SORTS.some(([k]) => k === params.s) ? (params.s as SortKey) : 'release';
  const dir = params.d === 'asc' || params.d === 'desc' ? params.d : SORT_DEFAULT[sort];
  const platform = PLATFORMS.some(([k]) => k === params.p) ? (params.p as Family) : null;
  return { filter, q: (params.q ?? '').trim(), sort, dir, platform, korean: params.k === '1' };
}

function query({ filter, q, sort, dir, platform, korean }: View) {
  const p = new URLSearchParams();
  if (filter !== 'all') p.set('f', filter);
  if (platform) p.set('p', platform);
  if (korean) p.set('k', '1');
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

// One row of today's highlights: small cards that scroll sideways.
function Strip({ title, items, note, back }: { title: string; items: Highlight[]; note: (h: Highlight) => string; back: string }) {
  if (items.length === 0) return null;
  return (
    <section className="strip">
      <h2>{title}</h2>
      <div className="cards">
        {items.map(({ game, series }) => (
          <Link key={game.slug} className="card-s" href={`/games/${game.slug}${back}`}>
            <span className="thumb">
              <Art title={game.title} slug={game.slug} url={game.coverUrl} />
            </span>
            <span className="t">{game.title}</span>
            <span className="p">
              <span className="num">{won(series.cur)}</span>
              {series.pct > 0 && <span className="off">-{series.pct}%</span>}
            </span>
            <span className="n">
              <i className={`dot c-${series.key}`} />
              {note({ game, series })}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// The home screen: today's highlights, then every tracked game as a cover tile.
export async function GameGrid({ params }: { params: BrowserParams }) {
  const games = await loadCatalog();
  const view = readView(params);
  const { filter, q, sort, dir, platform, korean } = view;
  const scope: Scope = { platform, korean };
  const needle = q.toLowerCase();
  const now = Date.now();

  // Games with at least one store in scope; everything below compares those stores only.
  const scoped = games.filter((g) => inScope(g, scope).length > 0);
  const matching = scoped.filter((g) => {
    if (needle && !g.title.toLowerCase().includes(needle)) return false;
    if (filter === 'sale') return inScope(g, scope).some((s) => s.pct > 0);
    if (filter === 'low') return inScope(g, scope).some(atLow);
    return true;
  });
  const items = sortGames(matching, sort, dir, scope);
  // Highlights are for browsing, not for a search or a narrowed list.
  const today = !needle && filter === 'all' ? highlights(scoped, now, scope) : null;
  const back = query(view);
  const timeLeft = (t: number) => {
    const hours = (t - now) / 3_600_000;
    return hours < 24 ? '오늘 끝나요' : `${Math.ceil(hours / 24)}일 남음`;
  };

  return (
    <main className="home">
      <div className="filters" role="group" aria-label="플랫폼">
        <Link href={`/${query({ ...view, platform: null })}`} aria-current={platform === null} scroll={false}>
          모든 플랫폼
        </Link>
        {PLATFORMS.map(([k, label]) => (
          <Link key={k} href={`/${query({ ...view, platform: k })}`} aria-current={k === platform} scroll={false}>
            {label}
          </Link>
        ))}
        <Link className="toggle-k" href={`/${query({ ...view, korean: !korean })}`} aria-current={korean} scroll={false}>
          한국어 지원만
        </Link>
      </div>

      {today && (
        <>
          <Strip title="곧 끝나는 세일" items={today.ending} back={back} note={(h) => `${fmtDay(h.series.saleEndsAt!).slice(5)}까지 · ${timeLeft(h.series.saleEndsAt!)}`} />
          <Strip title="새로 시작한 세일" items={today.started} back={back} note={(h) => `${fmtDay(h.series.changes.at(-1)!.t).slice(5)} 시작 · ${h.series.storeName}`} />
          <Strip title="역대 최저가 갱신" items={today.lows} back={back} note={(h) => `${h.series.storeName} 기록상 최저`} />
        </>
      )}

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
            // The badge follows the stores in scope.
            const compared = inScope(g, scope);
            const pct = Math.max(...compared.map((s) => s.pct));
            const low = compared.some(atLow);
            return (
              <Link key={g.slug} className="tile" href={`/games/${g.slug}${back}`} title={g.title}>
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
  const view = readView(params);
  return (
    <main className="game">
      {/* Coming from a platform's list, open on that platform's store. */}
      <GameDetail key={game.slug} game={game} now={Date.now()} backHref={`/${query(view)}`} startOn={view.platform} />
    </main>
  );
}
