// The games GPtracker follows. Each entry ties one game to its id on every
// store, so prices from different stores land on the same game. Leave out the
// ids of stores that don't sell the game.
//
// psConceptId:   the number in the game's PS Store address,
//                https://store.playstation.com/ko-kr/concept/<psConceptId>
// eshopId:       the number in the game's My Nintendo Store address,
//                https://store.nintendo.co.kr/<eshopId>
// xboxProductId: the last part of the game's Xbox Store address, for the
//                standard edition, https://www.xbox.com/ko-KR/games/store/<name>/<xboxProductId>
//
// discs: the boxed editions to look up on shopping sites, one per console.
//        `query` is typed into the shop's search; an offer only counts when its
//        title contains one of `names` and the console (see retail/match.ts).
import type { DiscSpec } from './retail/match';

export type TrackedGame = {
  slug: string; // address of the game's page on GPtracker
  title: string;
  psConceptId?: string;
  eshopId?: string;
  xboxProductId?: string;
  discs?: DiscSpec[];
};

export const TRACKED: TrackedGame[] = [
  { slug: 'astro-bot', title: '아스트로봇', psConceptId: '10002684',
    discs: [{ platform: 'ps5', query: 'PS5 아스트로봇', names: ['아스트로봇', 'ASTRO BOT'] }] },
  { slug: 'tekken-8', title: 'TEKKEN 8', psConceptId: '10006270',
    discs: [{ platform: 'ps5', query: 'PS5 철권 8', names: ['철권 8', 'TEKKEN 8'] }] },
  { slug: 'red-dead-redemption-2', title: 'Red Dead Redemption 2', psConceptId: '209441',
    discs: [{ platform: 'ps4', query: 'PS4 레드 데드 리뎀션 2', names: ['레드 데드 리뎀션 2', '레데리 2', 'Red Dead Redemption 2'] }] },
  { slug: 'final-fantasy-vii-rebirth', title: 'FINAL FANTASY VII REBIRTH', psConceptId: '10003999',
    discs: [{ platform: 'ps5', query: 'PS5 파이널 판타지 7 리버스', names: ['파이널 판타지 7 리버스', '파이널판타지 VII 리버스', '파판7 리버스', 'FF7 리버스'] }] },
  { slug: 'silent-hill-f', title: 'SILENT HILL f', psConceptId: '10010242',
    discs: [{ platform: 'ps5', query: 'PS5 사일런트 힐 f', names: ['사일런트 힐 f', 'SILENT HILL f'] }] },
  { slug: 'persona-5-royal', title: '페르소나5 더 로열', eshopId: '70010000043097',
    discs: [{ platform: 'switch', query: '스위치 페르소나5 더 로열', names: ['페르소나5 더 로열', '페르소나 5 로열', 'P5R'] }] },
  { slug: 'persona-4-golden', title: '페르소나4 더 골든', eshopId: '70010000060322' },
  { slug: 'rhythm-heaven-miracle-stars', title: '리듬 천국 미라클 스타즈', eshopId: '70010000122820' },
  { slug: 'forza-horizon-5', title: 'Forza Horizon 5', xboxProductId: '9NKX70BBCDRN',
    discs: [{ platform: 'xbox_series', query: 'XBOX 포르자 호라이즌 5', names: ['포르자 호라이즌 5', 'Forza Horizon 5'] }] },
];
