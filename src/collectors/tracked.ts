// The games GPtracker follows. Each entry ties one game to its id on every
// store, so prices from different stores land on the same game. Leave out the
// ids of stores that don't sell the game.
//
// psConceptId:   the number in the game's PS Store address,
//                https://store.playstation.com/ko-kr/concept/<psConceptId>
// eshopId:       the number in the game's My Nintendo Store address (when a game has
//                separate Switch and Switch 2 versions, the Switch one),
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
  { slug: 'tekken-8', title: 'TEKKEN 8', psConceptId: '10006270', xboxProductId: '9PPSM14VKCLW',
    discs: [{ platform: 'ps5', query: 'PS5 철권 8', names: ['철권 8', 'TEKKEN 8'] }] },
  { slug: 'red-dead-redemption-2', title: 'Red Dead Redemption 2', psConceptId: '209441', xboxProductId: '9N2ZDN7NWQKV',
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
  { slug: 'clair-obscur-expedition-33', title: '클레르 옵스퀴르: 33 원정대', psConceptId: '10008503', xboxProductId: '9PPT8K6GQHRZ' },
  { slug: 'black-myth-wukong', title: '검은 신화: 오공', psConceptId: '10007144', xboxProductId: '9NWQ1Q1FR0C9' },
  { slug: 'resident-evil-4', title: 'BIOHAZARD RE:4', psConceptId: '10004473', xboxProductId: '9N7JCPPCPN37' },
  { slug: 'final-fantasy-xvi', title: 'FINAL FANTASY XVI', psConceptId: '10002100', xboxProductId: '9PNN223H8MLZ' },
  { slug: 'metaphor-refantazio', title: '메타포: 리판타지오', psConceptId: '10001029', xboxProductId: '9N5DV8310XP7' },
  { slug: 'death-stranding-2', title: 'DEATH STRANDING 2: ON THE BEACH', psConceptId: '10001538' },
  { slug: 'the-last-of-us-part-2-remastered', title: 'The Last of Us Part II Remastered', psConceptId: '230079' },
  // The PS Store page for GTA V leads with GTA Online, so only Xbox is tracked.
  { slug: 'grand-theft-auto-v', title: 'Grand Theft Auto V', xboxProductId: '9P8RQH67TTT1' },
  { slug: 'assassins-creed-shadows', title: '어쌔신 크리드 섀도우스', psConceptId: '10009909', xboxProductId: '9P42LWGMC7K4' },
  // Every store only sells the edition that includes both expansions.
  { slug: 'the-witcher-3', title: 'The Witcher 3: Wild Hunt', psConceptId: '204794', eshopId: '70010000020989', xboxProductId: 'C261457LCNMJ' },
  { slug: 'sekiro', title: 'SEKIRO: SHADOWS DIE TWICE', psConceptId: '232898', xboxProductId: 'BQD5WRRP2D6Q' },
  { slug: 'it-takes-two', title: 'It Takes Two', psConceptId: '234689', eshopId: '70070000014923', xboxProductId: '9NXVC0482QS5' },
  { slug: 'split-fiction', title: 'Split Fiction', psConceptId: '10005449', eshopId: '70010000097436', xboxProductId: '9N1WXXD1RL8D' },
  { slug: 'hades', title: 'Hades', psConceptId: '10002648', eshopId: '70010000033128', xboxProductId: '9P8DL6W0JBB8' },
  { slug: 'hollow-knight-silksong', title: 'Hollow Knight: Silksong', psConceptId: '10005908', eshopId: '70010000100203', xboxProductId: '9N116V0599HB' },
  // Not sold on the Korean PS Store.
  { slug: 'stardew-valley', title: 'Stardew Valley', eshopId: '70010000104430', xboxProductId: 'C3D891Z6TNQM' },
  { slug: 'minecraft', title: 'Minecraft', psConceptId: '212779', eshopId: '70010000024523', xboxProductId: '9MVXMVT8ZKWC' },
  { slug: 'silent-hill-2', title: 'SILENT HILL 2', psConceptId: '10005529', xboxProductId: '9PNVDQKPJRQV' },
  { slug: 'indiana-jones-great-circle', title: '인디아나 존스: 그레이트 서클', psConceptId: '10012238', xboxProductId: '9N8FQ28Z6QX3' },
  { slug: 'halo-infinite', title: 'Halo Infinite', xboxProductId: '9NP1P1WFS0LB' },
  { slug: 'zelda-breath-of-the-wild', title: '젤다의 전설 브레스 오브 더 와일드', eshopId: '70010000009367' },
  { slug: 'super-mario-bros-wonder', title: '슈퍼 마리오브라더스 원더', eshopId: '70010000068690' },
  { slug: 'super-smash-bros-ultimate', title: '슈퍼 스매시브라더스 얼티밋', eshopId: '70010000012908' },
  { slug: 'pokemon-legends-z-a', title: 'Pokémon LEGENDS Z-A', eshopId: '70010000094236' },
  { slug: 'donkey-kong-bananza', title: '동키콩 바난자', eshopId: '70010000096811' },
  { slug: 'splatoon-3', title: '스플래툰 3', eshopId: '70010000046397' },
  { slug: 'kirby-and-the-forgotten-land', title: '별의 커비 디스커버리', eshopId: '70010000046407' },
  { slug: 'mario-kart-8-deluxe', title: '마리오 카트 8 디럭스', eshopId: '70010000009373' },
  { slug: 'pikmin-4', title: '피크민 4', eshopId: '70010000063718' },
];
