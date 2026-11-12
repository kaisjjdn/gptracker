// Sample data, ported from the gptracker.html prototype. Every game and price
// here is made up. Running this wipes all tables first.
import { sql } from 'drizzle-orm';
import { closeDb, db } from './index';
import * as s from './schema';

const DAY = 86_400_000;
const D = (v: string) => {
  const [y, m, d] = v.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const TODAY = D('2026-11-11');
const won = (n: number) => '₩' + n.toLocaleString('ko-KR');
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10).replaceAll('-', '.');

type PlatKey = 'ps' | 'sw' | 'xb';
type SaleSpec = [start: string, end: string, pct: number, name: string];
type DigitalSpec = {
  launch: string;
  base: number;
  sales: SaleSpec[];
  hikes?: [date: string, base: number, note: string][];
};
type DiscSpec = {
  points: [date: string, price: number, note: string][];
  stores: [seller: string, price: number, note: string][];
};
type GameSpec = {
  slug: string;
  title: string;
  genre: string;
  publisher: string;
  platforms: Partial<Record<PlatKey, DigitalSpec>>;
  disc?: DiscSpec;
};

const PLAT: Record<PlatKey, { store: string; platform: (typeof s.platform.enumValues)[number] }> = {
  ps: { store: 'ps_store', platform: 'ps5' },
  sw: { store: 'eshop', platform: 'switch' },
  xb: { store: 'xbox_store', platform: 'xbox_series' },
};

const GAMES: GameSpec[] = [
  {
    slug: 'chrono-ranger', title: '크로노 레인저', genre: '액션 RPG', publisher: '샘플 스튜디오',
    platforms: {
      ps: {
        launch: '2024-03-21', base: 69800,
        sales: [
          ['2024-06-28', '2024-07-25', 0.25, '여름 세일'],
          ['2024-11-22', '2024-12-05', 0.35, '블랙프라이데이 세일'],
          ['2024-12-18', '2025-01-08', 0.4, '연말 세일'],
          ['2025-07-02', '2025-07-24', 0.3, '여름 세일'],
          ['2025-11-21', '2025-12-04', 0.4, '블랙프라이데이 세일'],
          ['2025-12-17', '2026-01-07', 0.5, '연말 세일'],
          ['2026-05-29', '2026-06-11', 0.45, '스토어 기념 세일'],
          ['2026-11-06', '2026-11-27', 0.5, '블랙프라이데이 사전 세일'],
        ],
        hikes: [['2025-04-14', 79800, '스토어의 지역 가격 정책 변경으로 정가가 올랐어요.']],
      },
    },
    disc: {
      points: [
        ['2024-03-21', 69800, '출시 정가'], ['2024-05-10', 59800, '오픈마켓 할인 시작'],
        ['2024-11-25', 49800, '블랙프라이데이 행사'], ['2024-12-10', 54800, '행사 종료'],
        ['2025-03-01', 45800, '재고 정리 할인'], ['2025-06-15', 52000, '재입고 후 가격 상승'],
        ['2025-11-24', 39800, '블랙프라이데이 행사'], ['2026-01-05', 42800, '행사 종료'],
        ['2026-08-01', 34800, '초판 재고 소진 할인'], ['2026-11-03', 36500, '재고 감소'],
      ],
      stores: [['쿠팡', 36500, '로켓배송'], ['11번가', 37900, ''], ['G마켓', 38200, ''], ['게임 전문몰 A', 39800, '특전 포함']],
    },
  },
  {
    slug: 'cat-post', title: '고양이 우편국', genre: '퍼즐 어드벤처', publisher: '샘플 퍼블리싱',
    platforms: {
      sw: {
        launch: '2023-09-14', base: 54800,
        sales: [
          ['2024-03-15', '2024-04-01', 0.3, '봄 세일'],
          ['2024-12-19', '2025-01-05', 0.33, '연말 세일'],
          ['2025-08-01', '2025-08-15', 0.4, '여름 세일'],
          ['2025-12-18', '2026-01-04', 0.4, '연말 세일'],
          ['2026-07-24', '2026-08-06', 0.5, '여름 세일'],
        ],
      },
    },
    disc: {
      points: [
        ['2023-09-14', 54800, '출시 정가'], ['2023-12-01', 48900, '연말 행사'],
        ['2024-06-10', 44800, '오픈마켓 할인'], ['2025-02-01', 41800, '재고 정리 할인'],
        ['2025-09-20', 46800, '재입고 후 가격 상승'], ['2026-07-25', 37800, '여름 행사'],
        ['2026-09-01', 41500, '행사 종료'],
      ],
      stores: [['11번가', 41500, ''], ['쿠팡', 42300, '로켓배송'], ['게임 전문몰 B', 43800, '']],
    },
  },
  {
    slug: 'neon-drift-2', title: '네온 드리프트 2', genre: '레이싱', publisher: '샘플 모터웍스',
    platforms: {
      ps: {
        launch: '2025-02-20', base: 79800,
        sales: [
          ['2025-06-27', '2025-07-10', 0.2, '여름 세일'],
          ['2025-11-21', '2025-12-04', 0.3, '블랙프라이데이 세일'],
          ['2026-03-13', '2026-03-26', 0.35, '봄 세일'],
          ['2026-11-06', '2026-11-27', 0.4, '블랙프라이데이 사전 세일'],
        ],
      },
      xb: {
        launch: '2025-02-20', base: 79800,
        sales: [
          ['2025-07-15', '2025-07-29', 0.25, '여름 세일'],
          ['2025-11-27', '2025-12-03', 0.3, '블랙프라이데이 세일'],
          ['2026-06-10', '2026-06-24', 0.4, '쇼케이스 세일'],
        ],
        hikes: [['2026-09-01', 59800, '스토어 공지에 따라 출시 1년 반 만에 정가가 내려갔어요.']],
      },
    },
    disc: {
      points: [
        ['2025-02-20', 79800, '출시 정가'], ['2025-04-01', 68000, '오픈마켓 할인'],
        ['2025-11-24', 52800, '블랙프라이데이 행사'], ['2025-12-08', 59800, '행사 종료'],
        ['2026-05-01', 49800, '재고 정리 할인'], ['2026-11-05', 44800, '블랙프라이데이 사전 행사'],
      ],
      stores: [['G마켓', 44800, ''], ['쿠팡', 45900, '로켓배송'], ['11번가', 46500, '']],
    },
  },
  {
    slug: 'deep-log', title: '심해 기록', genre: '서바이벌 호러', publisher: '샘플 게임즈',
    platforms: {
      ps: {
        launch: '2024-10-10', base: 44800,
        sales: [
          ['2025-01-24', '2025-02-06', 0.2, '설날 세일'],
          ['2025-06-27', '2025-07-10', 0.3, '여름 세일'],
          ['2025-10-24', '2025-11-06', 0.4, '할로윈 세일'],
          ['2026-01-30', '2026-02-12', 0.4, '설날 세일'],
          ['2026-10-23', '2026-11-05', 0.5, '할로윈 세일'],
        ],
      },
      sw: {
        launch: '2024-10-10', base: 44800,
        sales: [
          ['2025-10-30', '2025-11-12', 0.3, '할로윈 세일'],
          ['2026-10-29', '2026-11-12', 0.35, '할로윈 세일'],
        ],
      },
    },
  },
  {
    slug: 'dragon-lantern', title: '용의 등불', genre: '오픈월드 어드벤처', publisher: '샘플 엔터테인먼트',
    platforms: {
      sw: { launch: '2025-05-29', base: 64800, sales: [['2026-03-20', '2026-04-02', 0.2, '봄 세일']] },
    },
    disc: {
      points: [
        ['2025-05-29', 64800, '출시 정가'], ['2025-07-15', 58800, '오픈마켓 할인'],
        ['2025-12-20', 54800, '연말 행사'], ['2026-01-10', 57800, '행사 종료'],
        ['2026-06-01', 52800, '재고 정리 할인'],
      ],
      stores: [['쿠팡', 52800, '로켓배송'], ['11번가', 53900, ''], ['게임 전문몰 A', 55000, '특전 포함']],
    },
  },
  {
    slug: 'final-striker-26', title: '파이널 스트라이커 26', genre: '스포츠', publisher: '샘플 스포츠',
    platforms: {
      ps: {
        launch: '2025-09-26', base: 89800,
        sales: [
          ['2025-11-21', '2025-12-04', 0.33, '블랙프라이데이 세일'],
          ['2025-12-17', '2026-01-07', 0.45, '연말 세일'],
          ['2026-02-13', '2026-02-26', 0.55, '설날 세일'],
          ['2026-04-10', '2026-04-23', 0.6, '봄 세일'],
          ['2026-06-05', '2026-06-18', 0.65, '스토어 기념 세일'],
          ['2026-08-21', '2026-09-03', 0.7, '여름 세일'],
          ['2026-09-26', '2026-10-09', 0.75, '신작 출시 직전 할인'],
        ],
      },
      xb: {
        launch: '2025-09-26', base: 89800,
        sales: [
          ['2025-11-27', '2025-12-03', 0.3, '블랙프라이데이 세일'],
          ['2025-12-16', '2026-01-06', 0.4, '연말 세일'],
          ['2026-03-10', '2026-03-24', 0.5, '봄 세일'],
          ['2026-06-10', '2026-06-24', 0.6, '쇼케이스 세일'],
          ['2026-09-20', '2026-10-07', 0.7, '신작 출시 직전 할인'],
        ],
      },
    },
  },
];

type EventType = (typeof s.priceEventType.enumValues)[number];
type Sale = { start: number; end: number; pct: number; name: string };
type Change = {
  t: number;
  base: number;
  price: number; // effective price
  type: EventType;
  oldPrice: number | null;
  note: string;
  sale: Sale | null; // the campaign this change belongs to
};

// Walk day by day from launch to today and record each day the price changed,
// classified the same way the real change detector will classify it.
function expandDigital(spec: DigitalSpec): Change[] {
  const sales: Sale[] = spec.sales.map(([a, b, pct, name]) => ({ start: D(a), end: D(b), pct, name }));
  const hikes = (spec.hikes ?? []).map(([d, base, note]) => ({ t: D(d), base, note }));
  const baseAt = (t: number) => hikes.reduce((b, h) => (h.t <= t ? h.base : b), spec.base);

  const changes: Change[] = [];
  let prev: { price: number; base: number; sale: Sale | null } | null = null;
  for (let t = D(spec.launch); t <= TODAY; t += DAY) {
    const base = baseAt(t);
    const sale = sales.find((x) => x.start <= t && t <= x.end) ?? null;
    const price = sale ? Math.round((base * (1 - sale.pct)) / 100) * 100 : base;
    const common = { t, base, price, oldPrice: prev?.price ?? null };

    if (!prev) {
      changes.push({ ...common, type: 'new_listing', note: `정가 ${won(base)}로 출시됐어요.`, sale: null });
    } else if (price !== prev.price || base !== prev.base) {
      if (sale && sale !== prev.sale) {
        const note = `${Math.round(sale.pct * 100)}% 할인, ${fmt(sale.end)}까지 진행돼요.`;
        changes.push({ ...common, type: 'sale_start', note, sale });
      } else if (!sale && prev.sale) {
        const note = `${prev.sale.name}이 끝나 정가로 돌아왔어요.`;
        changes.push({ ...common, type: 'sale_end', note, sale: prev.sale });
      } else if (base !== prev.base) {
        const type = base > prev.base ? 'base_price_up' : 'base_price_down';
        changes.push({ ...common, type, note: hikes.find((h) => h.t === t)?.note ?? '', sale: null });
      } else {
        changes.push({ ...common, type: 'price_change', note: '', sale: null });
      }
    }
    prev = { price, base, sale };
  }
  return changes;
}

async function main() {
  await db.execute(
    sql`truncate table price_events, price_points, sales, listings, products, games, stores, regions restart identity cascade`,
  );

  const [kr] = await db
    .insert(s.regions)
    .values([
      { code: 'KR', name: '대한민국', currency: 'KRW', locale: 'ko-KR' },
      { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US' },
    ])
    .returning();

  const storeRows = await db
    .insert(s.stores)
    .values([
      { code: 'ps_store', name: 'PS 스토어', kind: 'digital' },
      { code: 'eshop', name: '닌텐도 e숍', kind: 'digital' },
      { code: 'xbox_store', name: 'Xbox 스토어', kind: 'digital' },
      { code: 'naver', name: '네이버 쇼핑', kind: 'retail' },
      { code: 'coupang', name: '쿠팡', kind: 'retail' },
    ])
    .returning();
  const storeId = Object.fromEntries(storeRows.map((r) => [r.code, r.id]));

  const saleIds = new Map<string, number>();
  async function saleIdFor(store: string, sale: Sale) {
    const key = `${store}|${sale.name}|${sale.start}`;
    let id = saleIds.get(key);
    if (id === undefined) {
      const [row] = await db
        .insert(s.sales)
        .values({
          storeId: storeId[store],
          regionId: kr.id,
          name: sale.name,
          startsAt: new Date(sale.start),
          endsAt: new Date(sale.end),
        })
        .returning();
      id = row.id;
      saleIds.set(key, id);
    }
    return id;
  }

  for (const g of GAMES) {
    const [game] = await db
      .insert(s.games)
      .values({ slug: g.slug, title: g.title, genre: g.genre, publisher: g.publisher })
      .returning();

    const platKeys = Object.keys(g.platforms) as PlatKey[];
    for (const key of platKeys) {
      const { store, platform } = PLAT[key];
      const changes = expandDigital(g.platforms[key]!);
      const [product] = await db
        .insert(s.products)
        .values({ gameId: game.id, platform, format: 'digital' })
        .returning();
      const [listing] = await db
        .insert(s.listings)
        .values({
          productId: product.id,
          storeId: storeId[store],
          regionId: kr.id,
          storeProductId: `sample-${g.slug}-${key}`,
          firstSeenAt: new Date(changes[0].t),
          lastCheckedAt: new Date(TODAY),
        })
        .returning();

      await db.insert(s.pricePoints).values(
        changes.map((c) => ({
          listingId: listing.id,
          basePrice: c.base,
          salePrice: c.price < c.base ? c.price : null,
          observedAt: new Date(c.t),
        })),
      );
      const events = [];
      for (const c of changes) {
        events.push({
          listingId: listing.id,
          type: c.type,
          oldPrice: c.oldPrice,
          newPrice: c.price,
          saleId: c.sale ? await saleIdFor(store, c.sale) : null,
          note: c.note || null,
          occurredAt: new Date(c.t),
        });
      }
      await db.insert(s.priceEvents).values(events);
    }

    if (g.disc) {
      // The prototype only has one "lowest disc price" history per game, so the
      // currently cheapest seller gets that history and the others get today's price.
      const [product] = await db
        .insert(s.products)
        .values({ gameId: game.id, platform: PLAT[platKeys[0]].platform, format: 'disc' })
        .returning();
      const sellers = [...g.disc.stores].sort((a, b) => a[1] - b[1]);
      for (const [i, [seller, price, note]] of sellers.entries()) {
        const isCoupang = seller === '쿠팡';
        const history: [number, number, string][] =
          i === 0 ? g.disc.points.map(([d, p, n]) => [D(d), p, n]) : [[TODAY, price, '']];
        const [listing] = await db
          .insert(s.listings)
          .values({
            productId: product.id,
            storeId: storeId[isCoupang ? 'coupang' : 'naver'],
            regionId: kr.id,
            storeProductId: `sample-${g.slug}-disc-${i}`,
            sellerName: isCoupang ? null : seller,
            note: note || null,
            firstSeenAt: new Date(history[0][0]),
            lastCheckedAt: new Date(TODAY),
          })
          .returning();
        await db.insert(s.pricePoints).values(
          history.map(([t, p]) => ({ listingId: listing.id, basePrice: p, observedAt: new Date(t) })),
        );
        await db.insert(s.priceEvents).values(
          history.map(([t, p, n], j) => ({
            listingId: listing.id,
            type: (j === 0 ? 'new_listing' : 'price_change') as EventType,
            oldPrice: j === 0 ? null : history[j - 1][1],
            newPrice: p,
            note: n || null,
            occurredAt: new Date(t),
          })),
        );
      }
    }
  }

  const count = async (table: string) => {
    const rows = await db.execute(sql`select count(*)::int as n from ${sql.identifier(table)}`);
    const list = (Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows) as { n: number }[];
    return list[0].n;
  };
  for (const t of ['games', 'products', 'listings', 'sales', 'price_points', 'price_events']) {
    console.log(`${t}: ${await count(t)}`);
  }
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
