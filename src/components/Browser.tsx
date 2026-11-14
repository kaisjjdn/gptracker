import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadCatalog } from '@/lib/catalog';
import { sized } from '@/lib/image';
import { atLow, comparable } from '@/lib/view';
import { GameDetail } from './GameDetail';

const FILTERS = [
  ['all', '전체'],
  ['sale', '할인 중'],
  ['low', '역대 최저가'],
] as const;

export type BrowserParams = { f?: string; q?: string };

function query(filter: string, q: string) {
  const p = new URLSearchParams();
  if (filter !== 'all') p.set('f', filter);
  if (q) p.set('q', q);
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
  const filter = FILTERS.some(([k]) => k === params.f) ? params.f! : 'all';
  const q = (params.q ?? '').trim();
  const needle = q.toLowerCase();

  const items = games.filter((g) => {
    if (needle && !g.title.toLowerCase().includes(needle)) return false;
    if (filter === 'sale') return comparable(g.series).some((s) => s.pct > 0);
    if (filter === 'low') return comparable(g.series).some(atLow);
    return true;
  });

  return (
    <main className="home">
      <div className="filters" role="group" aria-label="목록 필터">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/${query(k, q)}`} aria-current={k === filter} scroll={false}>
            {label}
          </Link>
        ))}
        <span className="count">{items.length}개</span>
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
              <Link key={g.slug} className="tile" href={`/games/${g.slug}${query(filter, q)}`} title={g.title}>
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
  const filter = FILTERS.some(([k]) => k === params.f) ? params.f! : 'all';
  return (
    <main className="game">
      <GameDetail key={game.slug} game={game} now={Date.now()} backHref={`/${query(filter, (params.q ?? '').trim())}`} />
    </main>
  );
}
