import type { SalePaymentMethod } from '../components/sales/SaleCheckoutFields';

export type CartLine = {
  id: string;
  price: number;
  quantity: number;
  /** Desconto em R$ sobre a linha (price × qty). */
  discount?: number;
};

export type PaymentSplitLine = {
  id: string;
  method: SalePaymentMethod;
  amount: number;
};

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function lineGross(item: CartLine): number {
  return roundMoney(item.price * item.quantity);
}

export function lineNet(item: CartLine): number {
  const disc = Math.max(0, Number(item.discount) || 0);
  return roundMoney(Math.max(0, lineGross(item) - disc));
}

export function cartSubtotal(items: CartLine[]): number {
  return roundMoney(items.reduce((s, i) => s + lineNet(i), 0));
}

/** Desconto no total: valor fixo (R$) ou percentual sobre o subtotal. */
export function resolveCartDiscount(
  subtotal: number,
  discountInput: number,
  type: 'value' | 'percent',
): number {
  const raw = Math.max(0, Number(discountInput) || 0);
  if (type === 'percent') {
    return roundMoney(Math.min(subtotal, (subtotal * raw) / 100));
  }
  return roundMoney(Math.min(subtotal, raw));
}

/** Acréscimo % sobre o valor vendido (subtotal − desconto). Ex.: 10 → +10%. */
export function resolveCartSurcharge(base: number, percent: number): number {
  const p = Math.max(0, Number(percent) || 0);
  const b = Math.max(0, Number(base) || 0);
  if (p <= 0 || b <= 0) return 0;
  return roundMoney((b * p) / 100);
}

export function cartFinalTotal(
  items: CartLine[],
  cartDiscountInput: number,
  cartDiscountType: 'value' | 'percent',
  surchargePercent = 0,
): {
  subtotal: number;
  cartDiscount: number;
  surcharge: number;
  surchargePercent: number;
  total: number;
} {
  const subtotal = cartSubtotal(items);
  const cartDiscount = resolveCartDiscount(subtotal, cartDiscountInput, cartDiscountType);
  const afterDiscount = roundMoney(Math.max(0, subtotal - cartDiscount));
  const pct = Math.max(0, Number(surchargePercent) || 0);
  const surcharge = resolveCartSurcharge(afterDiscount, pct);
  return {
    subtotal,
    cartDiscount,
    surcharge,
    surchargePercent: pct,
    total: roundMoney(afterDiscount + surcharge),
  };
}

/** Itens com preço unitário efetivo (desconto e acréscimo rateados) — NFC-e / NF-e. */
export function buildPricedSaleItems<T extends CartLine & { name: string }>(
  items: T[],
  cartDiscount: number,
  cartSurcharge = 0,
): Array<{ productId: string; name: string; price: number; quantity: number; discount: number }> {
  const lines = items.map((i) => ({
    productId: i.id,
    name: i.name,
    quantity: i.quantity,
    discount: roundMoney(Math.max(0, Number(i.discount) || 0)),
    net: lineNet(i),
  }));
  const subtotal = roundMoney(lines.reduce((s, l) => s + l.net, 0));
  let discLeft = roundMoney(Math.max(0, cartDiscount));

  const afterDiscount = lines.map((line, idx) => {
    const isLast = idx === lines.length - 1;
    const share =
      subtotal > 0 && !isLast
        ? roundMoney((line.net / subtotal) * cartDiscount)
        : discLeft;
    const applied = Math.min(line.net, Math.max(0, share));
    discLeft = roundMoney(discLeft - applied);
    return {
      ...line,
      discount: roundMoney(line.discount + applied),
      net: roundMoney(Math.max(0, line.net - applied)),
    };
  });

  const discSubtotal = roundMoney(afterDiscount.reduce((s, l) => s + l.net, 0));
  let surLeft = roundMoney(Math.max(0, cartSurcharge));

  return afterDiscount.map((line, idx) => {
    const isLast = idx === afterDiscount.length - 1;
    const share =
      discSubtotal > 0 && !isLast
        ? roundMoney((line.net / discSubtotal) * cartSurcharge)
        : surLeft;
    const applied = Math.max(0, share);
    surLeft = roundMoney(surLeft - applied);
    const net = roundMoney(line.net + applied);
    const price = line.quantity > 0 ? roundMoney(net / line.quantity) : 0;
    return {
      productId: line.productId,
      name: line.name,
      quantity: line.quantity,
      price,
      discount: line.discount,
    };
  });
}

export function paymentsSum(lines: PaymentSplitLine[]): number {
  return roundMoney(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
}

export function moneyPortion(lines: PaymentSplitLine[]): number {
  return roundMoney(
    lines.filter((l) => l.method === 'money').reduce((s, l) => s + (Number(l.amount) || 0), 0),
  );
}

export function cashDrawerPortion(lines: PaymentSplitLine[]): number {
  return roundMoney(
    lines
      .filter((l) => l.method === 'money' || l.method === 'pix')
      .reduce((s, l) => s + (Number(l.amount) || 0), 0),
  );
}

export function receivablePortion(lines: PaymentSplitLine[]): number {
  return roundMoney(
    lines
      .filter((l) => l.method === 'fiado' || l.method === 'boleto')
      .reduce((s, l) => s + (Number(l.amount) || 0), 0),
  );
}

export function newPaymentLineId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
