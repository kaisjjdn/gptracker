import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadCatalog } from '@/lib/catalog';
import { atLow } from '@/lib/view';
import { Cover } from './Cover';
import { GameDetail } from './GameDetail';

const won = (n: number) => '₩' + n.toLocaleString('ko-KR');
const FILTERS = [
  ['all', '전체'],
  ['sale', '할인 중'],
  ['low', '역대 최저가'],
] as const;

export type BrowserParams = { f?: string; q?: string };

// The whole screen: the game list on the left, one game's detail on the right.
// `slug` is set on a game's own page; the home page shows the first listed game.
export async function Browser({ slug, params }: { slug?: string; params: BrowserParams }) {
  const games = await loadCatalog();
  const filter = FILTERS.some(([k]) => k === params.f) ? params.f! : 'all';
  const q = (params.q ?? '').trim().toLowerCase();

  const items = games.filter((g) => {
    if (q && !g.title.toLowerCase().includes(q)) return false;
    if (filter === 'sale') return g.series.some((s) => s.pct > 0);
    if (filter === 'low') return g.series.some(atLow);
    return true;
  });
  const selected = slug ? games.find((g) => g.slug === slug) : items[0];
  if (slug && !selected) notFound();

  const query = (f: string) => {
    const p = new URLSearchParams();
    if (f !== 'all') p.set('f', f);
    if (q) p.set('q', params.q!.trim());
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const here = slug ? `/games/${slug}` : '/';

  return (
    <div className="app" data-view={slug ? 'detail' : 'list'}>
      <aside className="side">
        <div className="filters" role="group" aria-label="목록 필터">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`${here}${query(k)}`} aria-current={k === filter} scroll={false}>
              {label}
            </Link>
          ))}
        </div>
        <nav className="list" aria-label="게임 목록">
          {items.length === 0 && <div className="empty">조건에 맞는 게임이 없어요. 검색어나 필터를 바꿔 보세요.</div>}
          {items.map((g) => {
            const best = Math.min(...g.series.map((s) => s.cur));
            const low = g.series.some(atLow);
            const sale = g.series.some((s) => s.pct > 0);
            return (
              <Link key={g.slug} className="row" href={`/games/${g.slug}${query(filter)}`} aria-current={g.slug === selected?.slug}>
                <Cover title={g.title} slug={g.slug} url={g.coverUrl} />
                <div>
                  <h3>{g.title}</h3>
                  <div className="chips">
                    {g.series.map((s) => (
                      <span key={s.key} className={`chip c-${s.key}`}>
                        {s.chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rp">
                  <span className="num">{won(best)}</span>
                  {low ? <span className="tag low">역대 최저</span> : sale ? <span className="tag sale">할인 중</span> : null}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="detail">
        {selected && <GameDetail key={selected.slug} game={selected} now={Date.now()} backHref={`/${query(filter)}`} />}
      </main>
    </div>
  );
}
