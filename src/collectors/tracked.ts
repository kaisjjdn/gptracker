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
  { slug: 'final-fantasy-vii-rebirth', title: 'FINAL FANTASY VII REBIRTH', psConceptId: '10003999', eshopId: '70010000112486', xboxProductId: '9NP9F7WWKRP1',
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

  // Recent releases and priced pre-orders (added 2026-11).
  // Pre-order until 2026-11-19. The PS Store page leads with the Ultimate Edition.
  { slug: 'grand-theft-auto-vi', title: 'Grand Theft Auto VI', psConceptId: '10000730', xboxProductId: '9P3H4968GRSM' },
  // The PS Store keeps every Call of Duty on one shared page that leads with the
  // newest game. When the next one comes out, give this entry's PS id to that game.
  { slug: 'call-of-duty-modern-warfare-4', title: '콜 오브 듀티: 모던 워페어 4', psConceptId: '10001130', eshopId: '70070000038826', xboxProductId: '9P36PB4N42GW' },
  // Black Ops 7 is not listed on its own: both stores show it as an edition of the
  // Call of Duty page above, where it is recorded.
  { slug: 'battlefield-6', title: 'Battlefield 6', psConceptId: '10009568', xboxProductId: '9P2FF14JZLL3' },
  { slug: 'borderlands-4', title: '보더랜드 4', psConceptId: '10000819', xboxProductId: '9MX6HKF5647G' },
  { slug: 'resident-evil-requiem', title: 'BIOHAZARD requiem', psConceptId: '10015533', eshopId: '70010000101677', xboxProductId: '9NMFWR0NRLZS' },
  { slug: '007-first-light', title: '007 First Light', psConceptId: '10006560', xboxProductId: '9NPF9F0DCVKS' },
  { slug: 'marvels-wolverine', title: '마블 울버린', psConceptId: '10002861' },
  { slug: 'saros', title: '사로스', psConceptId: '10005069' },
  { slug: 'crimson-desert', title: '붉은사막', psConceptId: '10002363', xboxProductId: '9P6HVHDP2PGK' },
  { slug: 'nioh-3', title: 'Nioh 3', psConceptId: '10014010' },
  { slug: 'onimusha-way-of-the-sword', title: '귀무자 Way of the Sword', psConceptId: '10013248', eshopId: '70010000112824', xboxProductId: '9PJMHTRC9WKB' },
  { slug: 'pragmata', title: 'PRAGMATA', psConceptId: '10002075', xboxProductId: '9P5WNGBTL9X6' },
  { slug: 'phantom-blade-zero', title: 'Phantom Blade Zero', psConceptId: '10017620' },
  { slug: 'fable', title: 'Fable', psConceptId: '10015869', xboxProductId: '9NMVCQLV8BD4' },
  { slug: 'gears-of-war-e-day', title: 'Gears of War: E-Day', xboxProductId: '9N4PT8HGCDHQ' },
  { slug: 'forza-horizon-6', title: 'Forza Horizon 6', psConceptId: '10016335', xboxProductId: '9N431PX143P8' },
  { slug: 'halo-campaign-evolved', title: 'Halo: Campaign Evolved', psConceptId: '10013884', xboxProductId: '9N6J4RNFPKKL' },
  { slug: 'metal-gear-solid-delta', title: 'METAL GEAR SOLID Δ: SNAKE EATER', psConceptId: '10007293', xboxProductId: '9PJLN214RTKQ' },
  { slug: 'doom-the-dark-ages', title: 'DOOM: The Dark Ages', psConceptId: '10009984', xboxProductId: '9PH9X0760B0T' },
  // The PS Store page leads with the Royal Edition and shows no price for the base game.
  { slug: 'kingdom-come-deliverance-2', title: 'Kingdom Come: Deliverance II', xboxProductId: '9N4W31HSMVVD' },
  { slug: 'elden-ring-nightreign', title: 'ELDEN RING 밤의 통치자', psConceptId: '10010877', xboxProductId: '9PJ22QNVCZ3G' },
  { slug: 'mafia-the-old-country', title: '마피아: 올드 컨트리', psConceptId: '10007134', xboxProductId: '9P834N9S4LL0' },
  { slug: 'dying-light-the-beast', title: 'Dying Light: The Beast', psConceptId: '10011468', xboxProductId: '9P7ZG9MQKKLN' },
  { slug: 'ninja-gaiden-4', title: 'NINJA GAIDEN 4', psConceptId: '10012110', xboxProductId: '9N7358JZPX1Z' },
  { slug: 'the-outer-worlds-2', title: 'The Outer Worlds 2', psConceptId: '10011796', xboxProductId: '9P8RMKXRML7D' },
  { slug: 'arc-raiders', title: 'ARC Raiders', psConceptId: '10003610', xboxProductId: '9NDF1F263RZ4' },
  { slug: 'hades-2', title: 'Hades II', psConceptId: '10018449', eshopId: '70010000103277', xboxProductId: '9PCR3Z2MSM4T' },
  // Nintendo only sells the Complete Edition, so it is left out.
  { slug: 'lies-of-p', title: 'P의 거짓', psConceptId: '10006052', xboxProductId: '9PCM4CMTPPGC' },
  { slug: 'digimon-story-time-stranger', title: '디지몬 스토리 타임 스트레인저', psConceptId: '10011861', eshopId: '70010000084202', xboxProductId: '9P54L8DTLC55' },
  { slug: 'dragon-quest-vii-reimagined', title: '드래곤 퀘스트 VII Reimagined', psConceptId: '10008842', eshopId: '70010000090185', xboxProductId: '9N105N56MVGM' },
  { slug: 'monster-hunter-stories-3', title: '몬스터헌터 스토리즈 3 엇갈린 운명', psConceptId: '10013075', eshopId: '70010000097759', xboxProductId: '9NT1VLG29DG8' },
  { slug: 'persona-4-revival', title: '페르소나4 리바이벌', psConceptId: '10011107', xboxProductId: '9N0D1SHFFK31' },
  { slug: 'ea-sports-fc-27', title: 'EA SPORTS FC 27', psConceptId: '10017332', eshopId: '70010000110121', xboxProductId: '9NNFX161JGRJ' },
  { slug: 'nba-2k27', title: 'NBA 2K27', psConceptId: '10018502', eshopId: '70010000116957', xboxProductId: '9NB8Z7TGS7LB' },
  { slug: 'marathon', title: '마라톤', psConceptId: '10008864', xboxProductId: '9PB32DKQKZDQ' },
  { slug: 'control-resonant', title: 'CONTROL Resonant', psConceptId: '10017682', xboxProductId: '9P092299FSGW' },
  { slug: 'assassins-creed-black-flag-resynced', title: '어쌔신 크리드 블랙 플래그 리싱크드', psConceptId: '10013987', xboxProductId: '9MXQ1PFK7NC0' },
  { slug: 'ace-combat-8', title: '에이스 컴뱃 8: 시브의 날개', psConceptId: '10011942', xboxProductId: '9NT1N9ZVHXJK' },
  { slug: 'the-blood-of-dawnwalker', title: '더 블러드 오브 던워커', psConceptId: '10013855', xboxProductId: '9MVWT39J9R2C' },
  { slug: 'silent-hill-townfall', title: 'SILENT HILL: Townfall', psConceptId: '10016947' },
  { slug: 'minecraft-dungeons-2', title: 'Minecraft Dungeons II', psConceptId: '10008220', eshopId: '70010000067523', xboxProductId: '9PM3J18QM4Q3' },
  { slug: 'castlevania-belmonts-curse', title: "Castlevania: Belmont's Curse", psConceptId: '10018186', eshopId: '70010000116855', xboxProductId: '9NH6N2DNQ0H0' },
  { slug: 'star-wars-zero-company', title: '스타워즈 제로 컴퍼니', psConceptId: '10009029', xboxProductId: '9PPT228DZK4N' },
  { slug: 'lego-batman-legacy-of-the-dark-knight', title: 'LEGO Batman: 레거시 오브 더 다크나이트', psConceptId: '10008537', xboxProductId: '9PFKP8Z66G1J' },
  { slug: 'code-vein-2', title: '코드 베인 II', psConceptId: '10011448', xboxProductId: '9N851Q7SDGQW' },
  { slug: 'final-fantasy-resonance', title: 'FINAL FANTASY RESONANCE', psConceptId: '10015961', eshopId: '70010000117099', xboxProductId: '9N8JS091F5G0' },
  { slug: 'dragon-quest-monsters-4', title: '드래곤 퀘스트 몬스터즈 4', psConceptId: '10016414', eshopId: '70010000092411', xboxProductId: '9MSTNF9TKQMG' },
  { slug: 'marvel-tokon-fighting-souls', title: 'MARVEL Tōkon: Fighting Souls', psConceptId: '10008019' },
  { slug: 'metroid-prime-4-beyond', title: '메트로이드 프라임 4 비욘드', eshopId: '70010000095684' },
  { slug: 'kirby-air-riders', title: '커비의 에어 라이더', eshopId: '70010000103777' },
  { slug: 'hyrule-warriors-age-of-imprisonment', title: '젤다무쌍 봉인 전기', eshopId: '70010000103948' },
  { slug: 'mario-tennis-fever', title: '마리오 테니스 피버', eshopId: '70010000105871' },
  { slug: 'pokemon-pokopia', title: 'Pokémon Pokopia', eshopId: '70010000107423' },
  { slug: 'fire-emblem-fortunes-weave', title: '파이어 엠블렘 만자천홍', eshopId: '70010000126931' },
  { slug: 'tomodachi-life-living-the-dream', title: '친구모아 아일랜드 두근두근 라이프', eshopId: '70010000116665' },
  { slug: 'yoshi-and-the-mysterious-book', title: '요시와 신기한 도감', eshopId: '70010000119861' },
  { slug: 'splatoon-raiders', title: '스플래툰 레이더스', eshopId: '70010000122826' },
  { slug: 'super-mario-galaxy-1-2', title: '슈퍼 마리오 갤럭시 + 슈퍼 마리오 갤럭시 2', eshopId: '70070000030781' },
  { slug: 'zelda-ocarina-of-time', title: '젤다의 전설 시간의 오카리나', eshopId: '70010000130794' },
  { slug: 'star-fox', title: '스타폭스', eshopId: '70010000123169' },
  { slug: 'nintendo-switch-sports-resort', title: 'Nintendo Switch Sports Resort', eshopId: '70010000125147' },
  { slug: 'metroid-ravenous', title: '메트로이드 래버너스', eshopId: '70010000135073' },
];
