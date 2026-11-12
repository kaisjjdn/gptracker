import type { EventType, PriceState, SaleInfo } from './types';

export type DetectedEvent = {
  type: EventType;
  oldPrice: number | null;
  newPrice: number | null;
  note: string;
};

export type DetectOptions = {
  sale?: SaleInfo | null; // campaign behind the new sale price, if the store says
  prevSaleId?: string | null; // campaign id behind the previous sale price
  locale?: string;
  currency?: string;
  timeZone?: string;
  retail?: boolean; // a shop's selling price: no regular price or campaigns to explain
};

export const effectivePrice = (s: PriceState) => s.salePrice ?? s.basePrice;

const sameState = (a: PriceState, b: PriceState) =>
  a.basePrice === b.basePrice && a.salePrice === b.salePrice && a.memberPrice === b.memberPrice;

// Compare the last stored price with the newly observed one and explain the
// difference. Returns no events when nothing changed. One observation can
// yield several events, in the order they logically happened.
export function detectChanges(
  prev: PriceState | null,
  next: PriceState,
  opts: DetectOptions = {},
): DetectedEvent[] {
  const { sale = null, prevSaleId = null, locale = 'ko-KR', currency = 'KRW', timeZone = 'Asia/Seoul' } = opts;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  const day = (d: Date) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone }).format(d).replaceAll('-', '.');
  const pct = (base: number, price: number) => Math.round((1 - price / base) * 100);
  const saleStart = (): DetectedEvent => ({
    type: 'sale_start',
    oldPrice: next.basePrice,
    newPrice: next.salePrice,
    note:
      `${pct(next.basePrice, next.salePrice!)}% 할인` +
      (sale?.endsAt ? `, ${day(sale.endsAt)}까지 진행돼요.` : '이 시작됐어요.'),
  });

  if (opts.retail) {
    // Shops only show what they charge today, so every change is a plain price move.
    const price = effectivePrice(next);
    if (!prev) {
      return [{ type: 'new_listing', oldPrice: null, newPrice: price, note: `판매가 ${money(price)}로 추적을 시작했어요.` }];
    }
    const old = effectivePrice(prev);
    if (old === price) return [];
    const note = `판매가가 ${money(old)}에서 ${money(price)}로 ${price > old ? '올랐어요' : '내렸어요'}.`;
    return [{ type: 'price_change', oldPrice: old, newPrice: price, note }];
  }

  if (!prev) {
    const note =
      next.salePrice === null
        ? `정가 ${money(next.basePrice)}로 추적을 시작했어요.`
        : `정가 ${money(next.basePrice)}, 할인가 ${money(next.salePrice)}로 추적을 시작했어요.`;
    return [{ type: 'new_listing', oldPrice: null, newPrice: effectivePrice(next), note }];
  }
  if (sameState(prev, next)) return [];

  const events: DetectedEvent[] = [];
  const wasOnSale = prev.salePrice !== null;
  const isOnSale = next.salePrice !== null;
  // Back-to-back campaigns: still discounted, but under a different campaign.
  const switchedSale = wasOnSale && isOnSale && !!sale && !!prevSaleId && sale.externalId !== prevSaleId;

  if (wasOnSale && (!isOnSale || switchedSale)) {
    events.push({
      type: 'sale_end',
      oldPrice: prev.salePrice,
      newPrice: prev.basePrice,
      note: '세일이 끝나 정가로 돌아왔어요.',
    });
  }
  if (next.basePrice !== prev.basePrice) {
    const up = next.basePrice > prev.basePrice;
    events.push({
      type: up ? 'base_price_up' : 'base_price_down',
      oldPrice: prev.basePrice,
      newPrice: next.basePrice,
      note: `정가가 ${money(prev.basePrice)}에서 ${money(next.basePrice)}로 ${up ? '올랐어요' : '내렸어요'}.`,
    });
  }
  if (isOnSale && (!wasOnSale || switchedSale)) {
    events.push(saleStart());
  } else if (isOnSale && wasOnSale && next.salePrice !== prev.salePrice) {
    events.push({
      type: 'price_change',
      oldPrice: prev.salePrice,
      newPrice: next.salePrice,
      note: `할인율이 ${pct(next.basePrice, next.salePrice!)}%로 바뀌었어요.`,
    });
  }
  if (next.memberPrice !== prev.memberPrice) {
    events.push({
      type: 'price_change',
      oldPrice: prev.memberPrice ?? effectivePrice(prev),
      newPrice: next.memberPrice ?? effectivePrice(next),
      note:
        next.memberPrice === null
          ? '회원 할인이 끝났어요.'
          : prev.memberPrice === null
            ? `회원 할인가 ${money(next.memberPrice)}가 생겼어요.`
            : `회원 할인가가 ${money(next.memberPrice)}로 바뀌었어요.`,
    });
  }
  return events;
}
