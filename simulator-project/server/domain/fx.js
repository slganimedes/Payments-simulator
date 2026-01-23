import { d, toMoneyString } from './money.js';

export function getFxRates(db) {
  const rows = db.prepare('SELECT quoteCurrency, rate FROM fx_rates').all();
  return rows.map((r) => ({ quoteCurrency: r.quoteCurrency, rate: Number(r.rate) }));
}

export function getUsdToQuote(db, quoteCurrency) {
  if (quoteCurrency === 'USD') return d(1);
  const row = db.prepare('SELECT rate FROM fx_rates WHERE quoteCurrency = ?').get(quoteCurrency);
  if (!row) throw new Error(`Missing FX rate for USD/${quoteCurrency}`);
  return d(row.rate);
}

export function getQuoteToUsd(db, quoteCurrency) {
  return d(1).div(getUsdToQuote(db, quoteCurrency));
}

export function convert(db, fromCurrency, toCurrency, fromAmount) {
  const amt = d(fromAmount);
  if (fromCurrency === toCurrency) {
    return { fromCurrency, toCurrency, fromAmount: amt, toAmount: amt, rate: d(1) };
  }

  const fromToUsd = fromCurrency === 'USD' ? d(1) : getQuoteToUsd(db, fromCurrency);
  const usdToTo = toCurrency === 'USD' ? d(1) : getUsdToQuote(db, toCurrency);

  const toAmount = amt.mul(fromToUsd).mul(usdToTo);
  const rate = toAmount.div(amt);

  return {
    fromCurrency,
    toCurrency,
    fromAmount: amt,
    toAmount,
    rate
  };
}

export function convertToExactToAmount(db, fromCurrency, toCurrency, desiredToAmount) {
  const toAmt = d(desiredToAmount);
  if (fromCurrency === toCurrency) {
    return { fromCurrency, toCurrency, fromAmount: toAmt, toAmount: toAmt, rate: d(1) };
  }

  const toToUsd = toCurrency === 'USD' ? d(1) : getQuoteToUsd(db, toCurrency);
  const usdToFrom = fromCurrency === 'USD' ? d(1) : getUsdToQuote(db, fromCurrency);

  // desiredToAmount = fromAmount * (from->USD) * (USD->to)
  // so fromAmount = desiredToAmount / ((from->USD) * (USD->to))
  const fromToUsd = fromCurrency === 'USD' ? d(1) : getQuoteToUsd(db, fromCurrency);
  const usdToTo = toCurrency === 'USD' ? d(1) : getUsdToQuote(db, toCurrency);
  const denom = fromToUsd.mul(usdToTo);
  const fromAmount = toAmt.div(denom);

  const rate = toAmt.div(fromAmount);

  return { fromCurrency, toCurrency, fromAmount, toAmount: toAmt, rate };
}

export function fxLogEvent(db, evt) {
  db.prepare(`
    INSERT INTO fx_history(
      id, paymentId, bankId, fromCurrency, toCurrency, fromAmount, toAmount, rate, createdAtMs, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    evt.id,
    evt.paymentId ?? null,
    evt.bankId,
    evt.fromCurrency,
    evt.toCurrency,
    toMoneyString(evt.fromAmount),
    toMoneyString(evt.toAmount),
    String(evt.rate),
    evt.createdAtMs,
    evt.reason
  );
}
