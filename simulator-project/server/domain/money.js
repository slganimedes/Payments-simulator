import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function d(x) {
  if (x instanceof Decimal) return x;
  if (typeof x === 'number') return new Decimal(String(x));
  return new Decimal(String(x));
}

export function toMoneyString(dec) {
  return d(dec).toFixed(2);
}

export function toMoneyNumber(dec) {
  return Number(d(dec).toFixed(2));
}

export function assertNonNegative(dec, msg) {
  if (d(dec).lt(0)) throw new Error(msg);
}
