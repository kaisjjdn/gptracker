import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeTracked } from '../all-tracked';
import {
  cleanTitle,
  conceptFromGamePage,
  gamesFromNintendoList,
  gamesFromXboxBrowse,
  gameSlugsFromSitemap,
  slugFromTitle,
  titleKeys,
} from './sources';

test('sitemap: game pages only, each once', () => {
  const xml =
    '<urlset><url><loc>https://www.playstation.com/ko-kr/games/astro-bot/</loc></url>' +
    '<url><loc>https://www.playstation.com/ko-kr/support/games/share-play/</loc></url>' +
    '<url><loc>https://www.playstation.com/ko-kr/games/gris/</loc></url>' +
    '<url><loc>https://www.playstation.com/ko-kr/games/astro-bot/</loc></url></urlset>';
  assert.deepEqual(gameSlugsFromSitemap(xml), ['astro-bot', 'gris']);
});

test('PS game page: the concept it names most, and the game name from the title', () => {
  const html =
    '<title>Gris - PS5 and PS4 Games | PlayStation (한국)</title>' +
    '{"conceptId":"234650"} conceptId="234650" {&quot;conceptId&quot;:&quot;234650&quot;} {"conceptId":"999999"}';
  assert.deepEqual(conceptFromGamePage(html), { conceptId: '234650', title: 'Gris' });
  assert.equal(conceptFromGamePage('<title>x</title>{"conceptId":"111111"}').conceptId, null); // a stray mention
});

test('Xbox browse: priced console games in page order', () => {
  const state = {
    core2: {
      channels: { channelData: { BROWSE: { data: { products: [{ productId: 'A' }, { productId: 'B' }, { productId: 'C' }, { productId: 'D' }] } } } },
      products: {
        productSummaries: {
          A: { title: 'Paid', productKind: 'Game', availableOn: ['XboxSeriesX'], specificPrices: { purchaseable: [{ msrp: 39900 }] } },
          B: { title: 'Free', productKind: 'Game', availableOn: ['XboxSeriesX'], specificPrices: { purchaseable: [{ msrp: 0 }] } },
          C: { title: 'PC only', productKind: 'Game', availableOn: ['PC'], specificPrices: { purchaseable: [{ msrp: 9900 }] } },
          D: { title: 'Add-on', productKind: 'Durable', availableOn: ['XboxOne'], specificPrices: { purchaseable: [{ msrp: 9900 }] } },
        },
      },
    },
  };
  const html = `<script>window.__PRELOADED_STATE__ = ${JSON.stringify(state)};</script>`;
  assert.deepEqual(gamesFromXboxBrowse(html), [{ key: 'A', id: 'A', title: 'Paid' }]);
});

test('Nintendo list: priced games, not add-ons or free ones', () => {
  const item = (id: string, name: string, price: number) =>
    `<li class="item product product-item"><a class="product-item-link" href="https://store.nintendo.co.kr/${id}">${name}</a>` +
    `<span data-price-amount="${price}" data-price-type="finalPrice"></span></li>`;
  const html = item('70010000105919', '메타포: 리판타지오', 32000) + item('70010000053250', 'Fall Guys', 0) + item('70050000005706', '확장팩', 3300);
  assert.deepEqual(gamesFromNintendoList(html), [{ key: '70010000105919', id: '70010000105919', title: '메타포: 리판타지오' }]);
});

test('titles: language lists and English names in brackets are dropped', () => {
  assert.equal(cleanTitle('Kingdom Come: Deliverance (중국어(간체자), 한국어, 영어)'), 'Kingdom Come: Deliverance');
  assert.equal(cleanTitle('메타포: 리판타지오（Metaphor: ReFantazio）'), '메타포: 리판타지오');
  assert.equal(cleanTitle('LEGO® DC Super-Villains'), 'LEGO DC Super-Villains');
});

test('title keys: the same game under each store\'s name', () => {
  const same = (a: string, b: string) => titleKeys(a).some((k) => titleKeys(b).includes(k));
  assert.ok(same('데이브 더 다이버 (DAVE THE DIVER) Nintendo Switch 2 Edition', '데이브 더 다이버'));
  assert.ok(same('에이스 컴뱃 7: 스카이즈 언노운 디럭스 에디션（ACE COMBAT™7: SKIES UNKNOWN DELUXE EDITION）', 'ACE COMBAT 7: SKIES UNKNOWN'));
  assert.ok(same('Hades II Nintendo Switch 2 Edition', 'Hades II'));
  assert.ok(!same('Hades', 'Hades II'));
  assert.ok(!same('Dying Light', 'Dying Light 2'));
});

test('slugs: Latin letters, preferring a bracketed English name', () => {
  assert.equal(slugFromTitle('메타포: 리판타지오（Metaphor: ReFantazio）'), 'metaphor-refantazio');
  assert.equal(slugFromTitle('ACE COMBAT™7: SKIES UNKNOWN'), 'ace-combat7-skies-unknown');
  assert.equal(slugFromTitle('데이브 더 다이버'), null);
});

test('merge: discovered rows add games and fill in missing store ids only', () => {
  const merged = mergeTracked(
    [{ slug: 'metaphor', title: 'Metaphor', psConceptId: '1', eshopId: undefined }],
    [
      { slug: 'metaphor', title: 'Metaphor', psConceptId: '999', eshopId: '7001', xboxProductId: null },
      { slug: 'grounded', title: 'Grounded', psConceptId: null, eshopId: null, xboxProductId: 'X' },
    ],
  );
  assert.deepEqual(merged, [
    { slug: 'metaphor', title: 'Metaphor', psConceptId: '1', eshopId: '7001', xboxProductId: undefined },
    { slug: 'grounded', title: 'Grounded', psConceptId: undefined, eshopId: undefined, xboxProductId: 'X' },
  ]);
});
