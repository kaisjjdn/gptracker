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
  { slug: 'elden-ring', title: 'ELDEN RING', psConceptId: '10000333', xboxProductId: '9P3J32CTXLRZ' },
  // Nintendo sells separate Switch and Switch 2 versions; the Switch one is tracked.
  { slug: 'hogwarts-legacy', title: '호그와트 레거시', psConceptId: '232447', eshopId: '70010000062279', xboxProductId: '9MT5NJ5W7B8Z' },
  // Nintendo only sells the Ultimate Edition, so it is left out.
  { slug: 'cyberpunk-2077', title: '사이버펑크 2077', psConceptId: '234567', xboxProductId: 'BX3M8L83BBRW' },
  { slug: 'monster-hunter-wilds', title: 'Monster Hunter Wilds', psConceptId: '10005176', xboxProductId: '9NMT6XFN0LVD' },
  { slug: 'baldurs-gate-3', title: '발더스 게이트 3', psConceptId: '10007460', xboxProductId: '9ND58LQTG09T' },
  { slug: 'persona-3-reload', title: '페르소나3 리로드', psConceptId: '10001555', xboxProductId: '9NKK6Z0K3RH2' },
  { slug: 'god-of-war-ragnarok', title: '갓 오브 워 라그나로크', psConceptId: '10001850' },
  { slug: 'marvels-spider-man-2', title: '마블 스파이더맨 2', psConceptId: '10002456' },
  { slug: 'ghost-of-yotei', title: '고스트 오브 요테이', psConceptId: '10003923' },
  { slug: 'stellar-blade', title: '스텔라 블레이드', psConceptId: '10006891' },
  { slug: 'zelda-tears-of-the-kingdom', title: '젤다의 전설 티어스 오브 더 킹덤', eshopId: '70010000063716' },
  { slug: 'mario-kart-world', title: '마리오 카트 월드', eshopId: '70010000094003' },
  { slug: 'animal-crossing-new-horizons', title: '모여봐요 동물의 숲', eshopId: '70010000027621' },
  { slug: 'super-mario-odyssey', title: '슈퍼 마리오 오디세이', eshopId: '70010000009372' },
  { slug: 'starfield', title: 'Starfield', xboxProductId: '9NCJSXWZTP88' },
  { slug: 'ea-sports-fc-26', title: 'EA SPORTS FC 26', psConceptId: '10011898', eshopId: '70010000091350', xboxProductId: '9MXZBTLG26VX' },
];
