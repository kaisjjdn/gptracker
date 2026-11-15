import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { coverFromPage, koreanFromPage, parseNintendoPage, releaseDateFromPage } from './nintendo';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const opts = { currency: 'KRW' };

test('parses a discounted game with its sale period', () => {
  const [obs] = parseNintendoPage(fixture('nintendo-sale'), '70010000043097', opts);
  assert.equal(obs.title, '페르소나5 더 로열 (PERSONA5 THE ROYAL)');
  assert.equal(obs.platform, 'switch');
  assert.equal(obs.genre, 'RPG');
  assert.equal(obs.url, 'https://store.nintendo.co.kr/70010000043097');
  assert.deepEqual(obs.price, { basePrice: 69800, salePrice: 20940, memberPrice: null });
  // 2026/11/4 00:00 - 2026/11/22 23:59, Korean time
  assert.equal(obs.sale?.startsAt?.toISOString(), '2026-11-03T15:00:00.000Z');
  assert.equal(obs.sale?.endsAt?.toISOString(), '2026-11-22T14:59:00.000Z');
  assert.equal(obs.sale?.externalId, 'period:2026-11-03/2026-11-22');
});

test('parses a game at its regular price', () => {
  const [obs] = parseNintendoPage(fixture('nintendo-regular'), '70010000122820', opts);
  assert.equal(obs.title, '리듬 천국 미라클 스타즈');
  assert.equal(obs.publisher, 'Nintendo');
  assert.deepEqual(obs.price, { basePrice: 64800, salePrice: null, memberPrice: null });
  assert.equal(obs.sale, null);
});

test('a Switch 2 only game is filed under Switch 2', () => {
  const html = fixture('nintendo-regular').replace(/>\s*Nintendo Switch\s*</, '> Nintendo Switch 2 <');
  assert.equal(parseNintendoPage(html, '70010000122820', opts)[0].platform, 'switch2');
});

test('fails loudly when the price section is missing', () => {
  assert.throws(() => parseNintendoPage('<html></html>', '1', opts), /page structure may have changed/);
});

test('rejects prices in an unexpected currency', () => {
  assert.throws(() => parseNintendoPage(fixture('nintendo-regular'), '1', { currency: 'USD' }), /priced in KRW/);
});

test('takes the main gallery picture as the cover', () => {
  // Two gallery entries as the store embeds them (shortened file names).
  const gallery =
    String.raw`[{"thumb":"https:\/\/store.nintendo.co.kr\/media\/catalog\/product\/cache\/aa\/c\/a\/second.jpg","img":"https:\/\/store.nintendo.co.kr\/media\/catalog\/product\/cache\/bb\/c\/a\/second.jpg","full":"https:\/\/store.nintendo.co.kr\/media\/catalog\/product\/cache\/cc\/c\/a\/second.jpg","caption":"second.jpg","position":"2","isMain":false,"type":"image"},` +
    String.raw`{"thumb":"https:\/\/store.nintendo.co.kr\/media\/catalog\/product\/cache\/aa\/b\/6\/main.jpg","img":"https:\/\/store.nintendo.co.kr\/media\/catalog\/product\/cache\/bb\/b\/6\/main.jpg","full":"https:\/\/store.nintendo.co.kr\/media\/catalog\/product\/cache\/cc\/b\/6\/main.jpg","caption":"main.jpg","position":"1","isMain":true,"type":"image"}]`;
  assert.equal(coverFromPage(gallery), 'https://store.nintendo.co.kr/media/catalog/product/cache/bb/b/6/main.jpg');
  assert.equal(coverFromPage('<html></html>'), null);
});

test('reads the release date from the product details', () => {
  const html = `<div class="product-attribute release_date">
    <div class="product-attribute-title">발매일</div>
    <div class="product-attribute-val">2023/5/12</div>
  </div>`;
  assert.equal(releaseDateFromPage(html), '2023-05-12');
  assert.equal(releaseDateFromPage('<html></html>'), null);
});

test('Korean support comes from the supported languages entry', () => {
  const page = (langs: string) => `<div class="product-attribute supported_languages ">
    <div class="product-attribute-title">대응언어</div>
    <div class="product-attribute-val"><div class="attribute-item-val"> ${langs} </div></div></div>
    <div class="product-attribute publisher "></div>`;
  assert.equal(koreanFromPage(page('한국어, 영어, 일본어')), true);
  assert.equal(koreanFromPage(page('영어, 일본어')), false);
  assert.equal(koreanFromPage('<html></html>'), null);
});
