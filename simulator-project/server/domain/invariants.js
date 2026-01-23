import { d } from './money.js';

export function getBankAvailableCurrencies(db, bankId) {
  const bank = db.prepare('SELECT baseCurrency FROM banks WHERE id = ?').get(bankId);
  if (!bank) throw new Error('Bank not found');

  const rows = db.prepare('SELECT currency FROM nostros WHERE ownerBankId = ?').all(bankId);
  const set = new Set([bank.baseCurrency]);
  for (const r of rows) set.add(r.currency);
  return { baseCurrency: bank.baseCurrency, currencies: Array.from(set).sort() };
}

export function validateClientCurrencyAvailability(db, clientId, currency) {
  const c = db.prepare('SELECT bankId, type FROM clients WHERE id = ?').get(clientId);
  if (!c) throw new Error('Client not found');

  if (c.type === 'VOSTRO') {
    const bank = db.prepare('SELECT baseCurrency FROM banks WHERE id = ?').get(c.bankId);
    if (!bank) throw new Error('Bank not found');
    if (currency !== bank.baseCurrency) throw new Error('Vostro accounts can only hold the host bank base currency');
    return;
  }

  const avail = getBankAvailableCurrencies(db, c.bankId);
  if (!avail.currencies.includes(currency)) {
    throw new Error(`Currency ${currency} is not available to this bank`);
  }
}

export function validateForeignCurrencyInvariant(db, bankId, currency) {
  const bank = db.prepare('SELECT baseCurrency FROM banks WHERE id = ?').get(bankId);
  if (!bank) throw new Error('Bank not found');
  if (currency === bank.baseCurrency) return;

  const n = db.prepare('SELECT balance FROM nostros WHERE ownerBankId = ? AND currency = ?').get(bankId, currency);
  const nostroBal = n ? d(n.balance) : d(0);

  const sum = db.prepare(`
    SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS total
    FROM balances b
    JOIN clients c ON c.id = b.clientId
    WHERE c.bankId = ? AND c.type IN ('REGULAR', 'HOUSE') AND b.currency = ?
  `).get(bankId, currency);

  const total = d(sum.total);
  if (!total.eq(nostroBal)) {
    throw new Error(`Invariant violated for bank ${bankId} currency ${currency}: clients=${total.toFixed(2)} nostro=${nostroBal.toFixed(2)}`);
  }
}
