'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { fmtDay, verdict, type GameView } from '@/lib/view';
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

function readWatch(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

// One game's page: store tabs, current price and verdict, chart, change log,
// other editions and disc sellers. `now` comes from the server so both sides
// draw the same chart.
export function GameDetail({ game, now, backHref }: { game: GameView; now: number; backHref: string }) {
  const [tab, setTab] = useState(game.series[0].key);
  const [range, setRange] = useState<Range>('all');
  const [showDisc, setShowDisc] = useState(false);
  const [logAll, setLogAll] = useState(false);
  const [watch, setWatch] = useState<Record<string, number>>({});
  const [watchOpen, setWatchOpen] = useState(false);
  const [targetText, setTargetText] = useState('');
  useEffect(() => setWatch(readWatch()), []);

  const s = game.series.find((x) => x.key === tab) ?? game.series[0];
  const v = verdict(s, now);
  const vc = v.tone === 'good' ? 'var(--good)' : v.tone === 'wait' ? 'var(--wait)' : 'var(--muted)';
  const watchKey = `${game.slug}:${s.key}`;
  const target = watch[watchKey];
  const saveWatch = (next: Record<string, number>) => {
    setWatch(next);
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(next));
    } catch {
      // Private browsing: the alert just lasts until the page is closed.
    }
  };

  const log = [...s.changes].reverse();
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
        </div>
      </div>

      <div className="tabs" role="tablist">
        {game.series.map((x) => (
          <button
            key={x.key}
            role="tab"
            style={{ '--pc': `var(--${x.key})` } as CSSProperties}
            aria-selected={x.key === s.key}
            onClick={() => {
              setTab(x.key);
              setWatchOpen(false);
              setLogAll(false);
            }}
          >
            {x.storeName}
          </button>
        ))}
      </div>

      <section className="price">
        <div>
          {s.edition && (
            <div className="edition">
              <span className="tag">{s.edition}</span> {s.storeName}에서는 {s.edition}만 판매해요.
            </div>
          )}
          {s.pct > 0 && (
            <div>
              <span className="off">-{s.pct}%</span> <span className="was">{won(s.base)}</span>
            </div>
          )}
          <div className="big num">{won(s.cur)}</div>
          {s.member !== null && (
            <div className="member">
              {MEMBER_LABEL[s.key]} <b>{won(s.member)}</b>
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
                {s.cur <= target && <span className="hit">목표가에 도달했어요!</span>}
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
                setTargetText(String(s.low));
                setWatchOpen(true);
              }}
            >
              가격 알림 받기
            </button>
          )}
          {s.url && (
            <a className="btn" href={s.url} target="_blank" rel="noopener noreferrer">
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
        <PriceChart key={s.key} title={game.title} series={s} disc={showDisc ? disc : null} range={range} now={now} />
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
            const i = s.changes.indexOf(c);
            const prev = i > 0 ? s.changes[i - 1].price : null;
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

      {s.editions.length > 0 && (
        <section className="card">
          <h2>다른 에디션</h2>
          <table>
            <tbody>
              {s.editions.map((e) => (
                <tr key={e.name}>
                  <td>
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer">
                        {e.name}
                      </a>
                    ) : (
                      e.name
                    )}
                  </td>
                  <td>
                    {e.price < e.base && <small className="was">{won(e.base)}</small>} <span className="num">{won(e.price)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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
