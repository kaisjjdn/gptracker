import type { Db } from './index';
import * as s from './schema';

// Fixed rows every environment needs. Adding a region or store starts here.
export const REGIONS = [
  { code: 'KR', name: '대한민국', currency: 'KRW', locale: 'ko-KR' },
  { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US' },
];

export const STORES: (typeof s.stores.$inferInsert)[] = [
  { code: 'ps_store', name: 'PS 스토어', kind: 'digital' },
  { code: 'eshop', name: '닌텐도 e숍', kind: 'digital' },
  { code: 'xbox_store', name: 'Xbox 스토어', kind: 'digital' },
  { code: 'naver', name: '네이버 쇼핑', kind: 'retail' },
  { code: 'coupang', name: '쿠팡', kind: 'retail' },
];

export async function ensureReferenceData(db: Db) {
  await db.insert(s.regions).values(REGIONS).onConflictDoNothing({ target: s.regions.code });
  await db.insert(s.stores).values(STORES).onConflictDoNothing({ target: s.stores.code });
}
