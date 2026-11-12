'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { fmtDay, type DiscView, type Series } from '@/lib/view';

export type Range = '6m' | '1y' | 'all';

const DAY = 86_400_000;
const KST = 9 * 3_600_000; // month labels follow Korean time
const won = (n: number) => '₩' + n.toLocaleString('ko-KR');
const man = (v: number) => (v / 10000).toFixed(v % 10000 ? 1 : 0).replace('.0', '') + '만';

function nice(x: number) {
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}
// The step in force at time t (the first one if t is earlier than all of them).
function stepAt<T extends { t: number }>(steps: T[], t: number): T {
  let current = steps[0];
  for (const x of steps) {
    if (x.t <= t) current = x;
    else break;
  }
  return current;
}

// Step chart of one store's price, with sale periods shaded, the all-time low
// marked, and optionally the lowest disc price drawn alongside.
export function PriceChart({
  title,
  series: s,
  disc,
  range,
  now,
}: {
  title: string;
  series: Series;
  disc: DiscView | null;
  range: Range;
  now: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  const [hoverT, setHoverT] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const H = W < 520 ? 230 : 290;
  const pad = { l: 44, r: 10, t: 14, b: 26 };
  const first = s.changes[0].t;
  const end = Math.max(now, first + DAY); // a brand-new listing still gets a day's width
  const start = range === 'all' ? first : Math.max(first, end - (range === '6m' ? 182 : 365) * DAY);

  const visible = (steps: { t: number; price: number }[]) => [
    stepAt(steps, start).price,
    ...steps.filter((c) => c.t > start).map((c) => c.price),
  ];
  let values = visible(s.changes);
  if (disc) values = values.concat(visible(disc.changes));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = nice((hi - lo || 10000) / 4);
  const y0 = Math.max(0, Math.floor((lo * 0.92) / step) * step);
  const y1 = Math.max(y0 + step, Math.ceil((hi * 1.03) / step) * step);
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const X = (t: number) => pad.l + ((t - start) / (end - start)) * pw;
  const Y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * ph;
  const pathOf = (steps: { t: number; price: number }[]) => {
    let d = `M${X(start)},${Y(stepAt(steps, start).price)}`;
    for (const x of steps) if (x.t > start) d += `H${X(x.t)}V${Y(x.price)}`;
    return d + `H${X(end)}`;
  };

  const yTicks: number[] = [];
  for (let v = y0; v <= y1 + 1; v += step) yTicks.push(v);

  const months = Math.max(1, Math.round((end - start) / DAY / 30));
  const per = [1, 2, 3, 6, 12].find((m) => months / m <= pw / 64) ?? 12;
  const xTicks: { t: number; label: string }[] = [];
  const sd = new Date(start + KST);
  let cursor = Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth() + 1, 1);
  while (cursor - KST <= end) {
    const d = new Date(cursor);
    const m = d.getUTCMonth();
    if (m % per === 0) {
      xTicks.push({ t: cursor - KST, label: `${String(d.getUTCFullYear()).slice(2)}.${String(m + 1).padStart(2, '0')}` });
    }
    cursor = Date.UTC(d.getUTCFullYear(), m + 1, 1);
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    let t = Math.min(end, Math.max(start, start + ((px - pad.l) / pw) * (end - start)));
    // Snap to a nearby change so its exact moment is easy to hit.
    let nearest = 10;
    for (const c of s.changes) {
      if (c.t < start) continue;
      const d = Math.abs(X(c.t) - px);
      if (d < nearest) {
        nearest = d;
        t = c.t;
      }
    }
    setHoverT(t);
  };

  const hover = hoverT === null ? null : stepAt(s.changes, hoverT);
  const hoverDisc = hoverT !== null && disc ? stepAt(disc.changes, hoverT) : null;
  const hx = hoverT === null ? 0 : X(hoverT);
  const off = hover && hover.price < hover.base ? Math.round((1 - hover.price / hover.base) * 100) : 0;
  const ttWidth = 220;
  const ttLeft = hx + 14 + ttWidth > W ? Math.max(0, hx - ttWidth - 14) : hx + 14;

  return (
    <div className="chartwrap" ref={wrap}>
      <svg role="img" aria-label={`${title} 가격 변동 그래프`} viewBox={`0 0 ${W} ${H}`} height={H}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="var(--line)" />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {man(v)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text key={tick.t} x={X(tick.t)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {tick.label}
          </text>
        ))}
        {s.sales
          .filter((p) => (p.e ?? end) >= start)
          .map((p) => {
            const a = X(Math.max(p.s, start));
            const b = X(Math.min(p.e ?? end, end));
            return <rect key={p.s} x={a} y={pad.t} width={Math.max(1, b - a)} height={ph} fill="var(--pc)" opacity=".13" />;
          })}
        <line x1={pad.l} x2={W - pad.r} y1={Y(s.low)} y2={Y(s.low)} stroke="var(--hl)" strokeWidth="2" strokeDasharray="5 4" />
        {disc && <path d={pathOf(disc.changes)} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray="5 4" opacity=".75" />}
        <path d={pathOf(s.changes)} fill="none" stroke="var(--pc)" strokeWidth="2.5" strokeLinejoin="round" />
        {s.changes
          .filter((c) => c.t >= start)
          .map((c) =>
            c.kind === 'hike' || c.kind === 'cut' ? (
              <rect key={c.t} x={X(c.t) - 4} y={Y(c.price) - 4} width="8" height="8" fill="var(--ink)" />
            ) : (
              <circle key={c.t} cx={X(c.t)} cy={Y(c.price)} r="3.6" fill={c.kind === 'sale' ? 'var(--pc)' : 'var(--surface)'} stroke="var(--pc)" strokeWidth="2" />
            ),
          )}
        {hover && (
          <>
            <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + ph} stroke="var(--ink)" strokeWidth="1" opacity=".35" />
            <circle cx={hx} cy={Y(hover.price)} r="5.5" fill="var(--pc)" stroke="var(--surface)" strokeWidth="2" />
          </>
        )}
        <rect x={pad.l} y={0} width={pw} height={H} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHoverT(null)} />
      </svg>
      {hover && hoverT !== null && (
        <div className="tt" style={{ left: ttLeft }}>
          <div className="d">{fmtDay(hoverT)}</div>
          <div className="p num">
            {won(hover.price)}
            {off > 0 && <small> 정가 대비 -{off}%</small>}
          </div>
          <div className="why">
            <b>{hover.label}</b>
            {hover.note}
            <span>{fmtDay(hover.t)}부터 적용된 가격</span>
          </div>
          {hoverDisc && (
            <div className="disc">
              디스크 최저가 {won(hoverDisc.price)}
              {hoverDisc.note && ` (${hoverDisc.note})`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
