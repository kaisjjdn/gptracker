// Decides which shop offers are the boxed (disc / cartridge) standard edition
// of a tracked game. Shop titles are free text written by sellers, so the rules
// are strict: a doubtful offer is dropped rather than shown as a price.
import type { Observation, Platform } from '../types';

export type DiscSpec = {
  platform: Platform;
  query: string; // what to type into the shop's search
  names: string[]; // spellings of the game's name; an offer must contain one
  exclude?: string[]; // extra words that rule an offer out for this game
};

export type Offer = {
  id: string; // the shop's product id
  title: string;
  price: number;
  seller: string | null;
  url: string;
};

// Lowercase, no markup, no spaces or punctuation: "PS5 <b>아스트로 봇</b>" -> "ps5아스트로봇".
export function normalize(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// Which consoles a title names. A title can name several ("PS4/PS5").
export function platformsIn(title: string): Set<Platform> {
  let t = title.replace(/<[^>]+>/g, '').normalize('NFKC').toLowerCase();
  const found = new Set<Platform>();
  const take = (re: RegExp, ...platforms: Platform[]) => {
    if (!re.test(t)) return;
    platforms.forEach((p) => found.add(p));
    t = t.replace(new RegExp(re.source, 'g'), ' ');
  };
  take(/(ps|플스|플레이스테이션|playstation)\s?5/, 'ps5');
  take(/(ps|플스|플레이스테이션|playstation)\s?4/, 'ps4');
  // "스위치 2인용" is a two-player Switch game, not a Switch 2 game.
  take(/(스위치|switch)\s?2(?![인종개명p])/, 'switch2');
  take(/스위치|switch/, 'switch');
  take(/xbox|엑스박스|엑박/, 'xbox_series', 'xbox_one'); // discs rarely say which
  return found;
}

// Words that mean the offer is not a new, boxed, Korean-market standard edition.
const EXCLUDE = [
  // not new, or not a physical copy
  '중고', '대여', '렌탈', '코드', '디지털', '다운로드', 'dlc', '시즌패스', '확장팩',
  // not the game itself
  '아미보', 'amiibo', '케이스', '가이드', '공략', 'ost', '사운드트랙', '피규어', '컨트롤러', '패드', '스틸북', '포스터',
  // bundled with something else
  '본체', '번들', '동봉', '세트', '합본', '패키지구성',
  // other editions
  '디럭스', 'deluxe', '얼티밋', '얼티메이트', 'ultimate', '컬렉터', 'collector', '한정판', '리미티드', 'limited', '프리미엄', 'premium', '골드에디션',
  // imports
  '북미판', '일본판', '일어판', '해외판', '유럽판', '영문판',
];

export function rejectReason(title: string, spec: DiscSpec): string | null {
  const flat = normalize(title);
  const name = spec.names.map(normalize).find((n) => n.length > 0 && flat.includes(n));
  if (!name) return 'game name not in title';
  if (!platformsIn(title).has(spec.platform)) return 'platform not in title';
  // The game's own name may contain a ruled-out word ("... 디럭스"), so look past it.
  const rest = flat.replace(name, ' ');
  const word = [...EXCLUDE, ...(spec.exclude ?? [])].map(normalize).find((w) => rest.includes(w));
  return word ? `excluded word: ${word}` : null;
}

const median = (sorted: number[]) => sorted[Math.floor((sorted.length - 1) / 2)];

// The offers worth showing: matching ones, without suspiciously cheap outliers
// (usually a mislabelled accessory or code), one per seller, cheapest first.
export function pickOffers(offers: Offer[], spec: DiscSpec, max = 5): Offer[] {
  const matched = offers
    .filter((o) => Number.isFinite(o.price) && o.price > 0 && rejectReason(o.title, spec) === null)
    .sort((a, b) => a.price - b.price);
  if (matched.length === 0) return [];
  const floor = matched.length >= 3 ? median(matched.map((o) => o.price)) * 0.5 : 0;
  const picked: Offer[] = [];
  const sellers = new Set<string>();
  for (const o of matched) {
    if (o.price < floor) continue;
    const key = o.seller ?? o.id;
    if (sellers.has(key)) continue;
    sellers.add(key);
    picked.push(o);
    if (picked.length === max) break;
  }
  return picked;
}

export const toObservation = (offer: Offer, spec: DiscSpec): Observation => ({
  storeProductId: offer.id,
  title: offer.title,
  edition: 'standard',
  platform: spec.platform,
  url: offer.url,
  coverUrl: null, // shop photos are not used as the game's cover
  publisher: null,
  genre: null,
  price: { basePrice: offer.price, salePrice: null, memberPrice: null },
  sale: null,
  format: 'disc',
  sellerName: offer.seller,
});
