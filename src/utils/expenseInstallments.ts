/**
 * Divide um valor total em N parcelas em centavos (última parcela absorve centavos restantes).
 */
export function splitTotalIntoParts(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(count) || count < 1) {
    return [];
  }
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const extra = i >= count - remainder ? 1 : 0;
    out.push((base + extra) / 100);
  }
  return out;
}

export function sumMoneyParts(parts: number[]): number {
  return Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
}
