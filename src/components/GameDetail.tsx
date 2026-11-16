'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { cheapestStore, fmtDay, verdict, type Family, type GameView } from '@/lib/view';
import { Cover } from './Cover';
import { PriceChart, type Range } from './PriceChart';

const won = (n: number) => '₩' + n.toLocaleString('ko-KR');
const WATCH_KEY = 'gptracker_watch';
const MEMBER_LABEL = { ps: 'PS Plus 회원가', sw: '회원가', xb: 'Game Pass 회원가' } as const;
const RANGES: [Range, string][] = [
  ['6m', '6개월'],
  ['1y', '1년'],
  ['all', '전체'],
];

// "Forza Horizon 5 프리미엄 에디션" -> "프리미엄 에디션": the page already names the game.
function shortEdition(name: string, title: string): string {
  const plain = (text: string) => text.replace(/[®™]/g, '').trim();
  const [n, g] = [plain(name), plain(title)];
  if (!n.toLowerCase().startsWith(g.toLowerCase())) return name;
  return n.slice(g.length).replace(/^[\s:\-–—]+/, '') || name;
}

function readWatch(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

// One game's page: store tabs, an edition picker, current price and verdict,
// chart, change log and disc sellers. `now` comes from the server so both sides
// draw the same chart.
export function GameDetail({
  game,
  now,
  backHref,
  startOn = null,
}: {
  game: GameView;
  now: number;
  backHref: string;
  startOn?: Family | null;
}) {
  const [tab, setTab] = useState(game.series.find((x) => x.key === startOn)?.key ?? game.series[0].key);
  const cheapest = cheapestStore(game);
  const [edition, setEdition] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('all');
  const [showDisc, setShowDisc] = useState(false);
  const [logAll, setLogAll] = useState(false);
  const [watch, setWatch] = useState<Record<string, number>>({});
  const [watchOpen, setWatchOpen] = useState(false);
  const [targetText, setTargetText] = useState('');
  useEffect(() => setWatch(readWatch()), []);

  const s = game.series.find((x) => x.key === tab) ?? game.series[0];
  // What is on screen: the plain game (null) or one of the store's other editions.
  const picked = s.editions.find((e) => e.name === edition) ?? null;
  const t = picked ?? s;
  const mainLabel = s.edition ?? '기본판';
  const v = verdict(t, now);
  const vc = v.tone === 'good' ? 'var(--good)' : v.tone === 'wait' ? 'var(--wait)' : 'var(--muted)';
  const watchKey = picked ? `${game.slug}:${s.key}:${picked.name}` : `${game.slug}:${s.key}`;
  const target = watch[watchKey];
  const saveWatch = (next: Record<string, number>) => {
    setWatch(next);
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(next));
    } catch {
      // Private browsing: the alert just lasts until the page is closed.
    }
  };

  const log = [...t.changes].reverse();
  const shown = logAll ? log : log.slice(0, 6);
  const disc = game.disc;

  return (
    <div style={{ '--pc': `var(--${s.key})` } as CSSProperties}>
      <Link className="back" href={backHref}>
        ‹ 목록으로
      </Link>
      <div className="head">
        <Cover title={game.title} slug={game.slug} url={game.coverUrl} />
        <div>
          <h1>{game.title}</h1>
          <p>{[game.genre, game.publisher].filter(Boolean).join(', ')}</p>
          {game.releaseDate && (
            <p>
              {new Date(`${game.releaseDate}T00:00:00+09:00`).getTime() > now ? '출시 예정 ' : '출시 '}
              {game.releaseDate.replaceAll('-', '.')}
            </p>
          )}
        </div>
      </div>

      {cheapest && (
        <p className="best">
          지금 가장 싼 곳은 <b>{cheapest.best.storeName}</b> {won(cheapest.best.cur)}. {cheapest.next.storeName}보다{' '}
          <b>{won(cheapest.next.cur - cheapest.best.cur)}</b> 저렴해요.
        </p>
      )}
      <div className="tabs" role="tablist">
        {game.series.map((x) => (
          <button
            key={x.key}
            role="tab"
            style={{ '--pc': `var(--${x.key})` } as CSSProperties}
            aria-selected={x.key === s.key}
            onClick={() => {
              setTab(x.key);
              setEdition(null);
              setWatchOpen(false);
              setLogAll(false);
            }}
          >
            {x.storeName}
            {cheapest?.best.key === x.key && <span className="tag low">최저</span>}
          </button>
        ))}
      </div>

      {s.editions.length > 0 && (
        <div className="editions" role="group" aria-label="에디션">
          {[{ name: null as string | null, label: mainLabel, cur: s.cur }, ...s.editions.map((e) => ({ name: e.name as string | null, label: shortEdition(e.name, game.title), cur: e.cur }))].map((e) => (
            <button
              key={e.name ?? ''}
              aria-pressed={e.name === (picked?.name ?? null)}
              onClick={() => {
                setEdition(e.name);
                setWatchOpen(false);
                setLogAll(false);
              }}
            >
              {e.label} <span className="num">{won(e.cur)}</span>
            </button>
          ))}
        </div>
      )}

      <section className="price">
        <div>
          {s.edition && !picked && (
            <div className="edition">
              <span className="tag">{s.edition}</span> {s.storeName}에서는 {s.edition}만 판매해요.
            </div>
          )}
          {t.pct > 0 && (
            <div>
              <span className="off">-{t.pct}%</span> <span className="was">{won(t.base)}</span>
            </div>
          )}
          <div className="big num">{won(t.cur)}</div>
          {t.korean !== null && (
            <div className={`lang ${t.korean ? 'yes' : 'no'}`}>{t.korean ? '한국어 지원' : '한국어 미지원'}</div>
          )}
          {t.subscription && (
            <div className="sub">
              <b>{t.subscription}</b> 가입자는 추가 비용 없이 플레이할 수 있어요.
            </div>
          )}
          {t.member !== null && (
            <div className="member">
              {MEMBER_LABEL[s.key]} <b>{won(t.member)}</b>
            </div>
          )}
        </div>
        <div className="verdict" style={{ '--vc': vc } as CSSProperties}>
          <strong>{v.head}</strong>
          <p>{v.text}</p>
          <small>{v.sub}</small>
        </div>
        <div className="actions">
          {target ? (
            <>
              <span className="watch">
                🔔 {won(target)} 이하가 되면 알려드려요.
                {t.cur <= target && <span className="hit">목표가에 도달했어요!</span>}
              </span>
              <button
                className="btn"
                onClick={() => {
                  const { [watchKey]: _removed, ...rest } = watch;
                  saveWatch(rest);
                }}
              >
                알림 해제
              </button>
            </>
          ) : watchOpen ? (
            <div className="watch">
              <label htmlFor="tg">목표가</label>
              <input id="tg" type="number" inputMode="numeric" step={100} value={targetText} onChange={(e) => setTargetText(e.target.value)} autoFocus />
              <button
                className="btn primary"
                onClick={() => {
                  const value = parseInt(targetText, 10);
                  if (value > 0) saveWatch({ ...watch, [watchKey]: value });
                  setWatchOpen(false);
                }}
              >
                알림 저장
              </button>
              <button className="btn" onClick={() => setWatchOpen(false)}>
                취소
              </button>
            </div>
          ) : (
            <button
              className="btn primary"
              onClick={() => {
                setTargetText(String(t.low));
                setWatchOpen(true);
              }}
            >
              가격 알림 받기
            </button>
          )}
          {t.url && (
            <a className="btn" href={t.url} target="_blank" rel="noopener noreferrer">
              {s.storeName}에서 보기
            </a>
          )}
        </div>
      </section>

      <section className="card">
        <div className="ctrl">
          <h2>가격 기록</h2>
          <div className="seg" role="group" aria-label="기간">
            {RANGES.map(([k, label]) => (
              <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {disc && (
          <label className="toggle">
            <input type="checkbox" checked={showDisc} onChange={(e) => setShowDisc(e.target.checked)} /> 디스크 최저가 함께 보기
          </label>
        )}
        <p className="hint">그래프에 손가락이나 마우스를 올리면 그날 가격과 바뀐 이유가 보여요.</p>
        <PriceChart key={`${s.key}:${picked?.name ?? ''}`} title={picked ? `${game.title} ${picked.name}` : game.title} series={t} disc={showDisc ? disc : null} range={range} now={now} />
        <div className="legend">
          <span>
            <i style={{ width: 16, height: 3, background: 'var(--pc)' }} />
            {s.storeName}
          </span>
          {showDisc && disc && (
            <span>
              <i style={{ width: 16, borderTop: '2px dashed var(--ink)' }} />
              디스크 최저가
            </span>
          )}
          <span>
            <i style={{ width: 12, height: 12, background: 'var(--pc)', opacity: 0.15 }} />
            세일 기간
          </span>
          <span>
            <i style={{ width: 16, borderTop: '2px dashed var(--hl)' }} />
            역대 최저가
          </span>
          <span>
            <i className="k k-hike" />
            정가 변경
          </span>
        </div>
      </section>

      <section className="card">
        <h2>변동 기록</h2>
        <ul className="log">
          {shown.map((c) => {
            const i = t.changes.indexOf(c);
            const prev = i > 0 ? t.changes[i - 1].price : null;
            const delta = prev ? Math.round(((c.price - prev) / prev) * 100) : 0;
            return (
              <li key={c.t}>
                <span className="dt">{fmtDay(c.t)}</span>
                <div>
                  <b>
                    <i className={`k k-${c.kind}`} />
                    {c.label}
                  </b>
                  <span>{c.note}</span>
                </div>
                <div className="pr">
                  <span className="num">{won(c.price)}</span>
                  {delta !== 0 && (
                    <span className={`dl ${delta > 0 ? 'up' : 'dn'}`}>
                      {delta > 0 ? '+' : ''}
                      {delta}%
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {log.length > 6 && (
          <button className="btn more" onClick={() => setLogAll(!logAll)}>
            {logAll ? '접기' : `전체 기록 ${log.length}건 보기`}
          </button>
        )}
      </section>

      {disc && (
        <section className="card">
          <h2>디스크 판매처</h2>
          <table>
            <tbody>
              {disc.sellers.map((seller, i) => (
                <tr key={`${seller.name}-${i}`}>
                  <td>
                    {seller.url ? (
                      <a href={seller.url} target="_blank" rel="noopener noreferrer sponsored">
                        {seller.name}
                      </a>
                    ) : (
                      seller.name
                    )}
                    {seller.note && <small>{seller.note}</small>}
                  </td>
                  <td>
                    <span className="num">{won(seller.price)}</span>
                    {i === 0 && <> <span className="tag low">최저</span></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            디스크 역대 최저가 {won(disc.low)}.
            {disc.affiliate && ' 쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받아요.'}
          </p>
        </section>
      )}
    </div>
  );
}
