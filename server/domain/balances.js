import { getClientBalance, setClientBalance } from './accounts.js';
import { getNostro, adjustNostroAndMirrorVostro } from './nostroVostro.js';
import { validateClientCurrencyAvailability, validateForeignCurrencyInvariant } from './invariants.js';

export function applyRegularClientDelta(db, { clientId, currency, delta }) {
  validateClientCurrencyAvailability(db, clientId, currency);

  const c = db.prepare('SELECT bankId, type FROM clients WHERE id = ?').get(clientId);
  if (!c) throw new Error('Client not found');
  if (c.type !== 'REGULAR') throw new Error('Only regular clients supported here');

  const oldBal = getClientBalance(db, clientId, currency);
  const newBal = oldBal.add(delta);
  if (newBal.lt(0)) throw new Error('Insufficient funds');
  setClientBalance(db, clientId, currency, newBal);

  const bank = db.prepare('SELECT baseCurrency FROM banks WHERE id = ?').get(c.bankId);
  if (!bank) throw new Error('Bank not found');

  if (currency !== bank.baseCurrency) {
    const nostro = getNostro(db, c.bankId, currency);
    if (!nostro) throw new Error(`Missing Nostro for currency ${currency}`);

    adjustNostroAndMirrorVostro(db, {
      ownerBankId: c.bankId,
      correspondentBankId: nostro.correspondentBankId,
      currency,
      delta
    });
    validateForeignCurrencyInvariant(db, c.bankId, currency);
  }
}

export function applyRegularClientDeltaClientOnly(db, { clientId, currency, delta }) {
  validateClientCurrencyAvailability(db, clientId, currency);

  const c = db.prepare('SELECT bankId, type FROM clients WHERE id = ?').get(clientId);
  if (!c) throw new Error('Client not found');
  if (c.type !== 'REGULAR') throw new Error('Only regular clients supported here');

  const oldBal = getClientBalance(db, clientId, currency);
  const newBal = oldBal.add(delta);
  if (newBal.lt(0)) throw new Error('Insufficient funds');
  setClientBalance(db, clientId, currency, newBal);

  // NOTE: Intentionally does NOT adjust Nostro/Vostro.
}
