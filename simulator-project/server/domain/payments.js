import { getSimTimeMs } from './clock.js';
import { convert, fxLogEvent } from './fx.js';
import { d, toMoneyString } from './money.js';
import { applyRegularClientDelta, applyRegularClientDeltaClientOnly } from './balances.js';
import { findMinimumHopRoute } from './routing.js';
import { validateClientCurrencyAvailability, getBankAvailableCurrencies } from './invariants.js';
import { newId } from './ids.js';
import { getBank, getClientBalance } from './accounts.js';
import { getNostro, adjustNostroAndMirrorVostro } from './nostroVostro.js';

export function listPayments(db) {
  const rows = db.prepare('SELECT * FROM payments ORDER BY createdAtMs DESC').all();
  return rows.map((p) => {
    const route = JSON.parse(p.routeJson);
    const fxAtBankIds = [];
    if (p.debitCurrency !== p.settlementCurrency) fxAtBankIds.push(p.fromBankId);
    if (p.settlementCurrency !== p.creditCurrency) fxAtBankIds.push(p.toBankId);
    return {
      id: p.id,
      fromClientId: p.fromClientId,
      toClientId: p.toClientId,
      fromBankId: p.fromBankId,
      toBankId: p.toBankId,
      debitCurrency: p.debitCurrency,
      creditCurrency: p.creditCurrency,
      debitAmount: Number(p.debitAmount),
      creditAmount: Number(p.creditAmount),
      settlementCurrency: p.settlementCurrency,
      state: p.state,
      failReason: p.failReason,
      createdAtMs: p.createdAtMs,
      executedAtMs: p.executedAtMs,
      settledAtMs: p.settledAtMs,
      route,
      fxAtBankIds
    };
  });
}

export function createPaymentIntent(db, payload) {
  const fromClient = db.prepare('SELECT id, bankId, type FROM clients WHERE id = ?').get(payload.fromClientId);
  const toClient = db.prepare('SELECT id, bankId, type FROM clients WHERE id = ?').get(payload.toClientId);

  if (!fromClient || !toClient) throw new Error('Client not found');
  const allowedTypes = ['REGULAR', 'HOUSE'];
  if (!allowedTypes.includes(fromClient.type) || !allowedTypes.includes(toClient.type)) {
    throw new Error('Payments must be between regular or house clients');
  }

  // Validate: fromClient must have balance > 0 in debit currency
  const fromBalance = getClientBalance(db, fromClient.id, payload.debitCurrency);
  if (fromBalance.lte(0)) {
    throw new Error(`Client has no funds in ${payload.debitCurrency}. Current balance: ${toMoneyString(fromBalance)}`);
  }

  const toBank = db.prepare('SELECT id, baseCurrency FROM banks WHERE id = ?').get(toClient.bankId);
  if (!toBank) throw new Error('Beneficiary bank not found');

  // Validate: debit currency available at origin bank
  validateClientCurrencyAvailability(db, fromClient.id, payload.debitCurrency);

  // Validate: credit currency available at destination bank
  const toAvailableCurrencies = getBankAvailableCurrencies(db, toClient.bankId);
  if (!toAvailableCurrencies.currencies.includes(payload.creditCurrency)) {
    throw new Error(
      `Currency ${payload.creditCurrency} is not available at destination bank ${toClient.bankId}. ` +
      `Available currencies: ${toAvailableCurrencies.currencies.join(', ')}`
    );
  }

  validateClientCurrencyAvailability(db, toClient.id, payload.creditCurrency);

  const fromBank = getBank(db, fromClient.bankId);
  const toBank2 = getBank(db, toClient.bankId);
  if (!fromBank || !toBank2) throw new Error('Bank not found');

  const fromAvail = db.prepare('SELECT currency FROM nostros WHERE ownerBankId = ?').all(fromClient.bankId).map((r) => r.currency);
  const toAvail = db.prepare('SELECT currency FROM nostros WHERE ownerBankId = ?').all(toClient.bankId).map((r) => r.currency);
  const fromSet = new Set([fromBank.baseCurrency, ...fromAvail]);
  const toSet = new Set([toBank2.baseCurrency, ...toAvail]);

  const candidateCurrencies = [];
  if (fromSet.has(payload.creditCurrency) && toSet.has(payload.creditCurrency)) candidateCurrencies.push(payload.creditCurrency);
  if (fromSet.has('USD') && toSet.has('USD')) candidateCurrencies.push('USD');
  candidateCurrencies.push(payload.creditCurrency);

  let settlementCurrency = payload.creditCurrency;
  for (const c of candidateCurrencies) {
    // Originating client will temporarily receive settlementCurrency during origin FX.
    try {
      validateClientCurrencyAvailability(db, fromClient.id, c);
    } catch {
      continue;
    }
    const r = findMinimumHopRoute(db, fromClient.bankId, toClient.bankId, c);
    if (r) {
      settlementCurrency = c;
      break;
    }
  }

  // Originating client will temporarily receive settlementCurrency during origin FX.
  validateClientCurrencyAvailability(db, fromClient.id, settlementCurrency);

  const simNow = getSimTimeMs(db);

  const route = findMinimumHopRoute(db, fromClient.bankId, toClient.bankId, settlementCurrency);
  if (!route) throw new Error(`No route found in settlement currency ${settlementCurrency}`);

  const debitAmount = d(payload.debitAmount);
  const settlementAmount = payload.debitCurrency === settlementCurrency
    ? debitAmount
    : convert(db, payload.debitCurrency, settlementCurrency, debitAmount).toAmount;
  const creditAmount = settlementCurrency === payload.creditCurrency
    ? settlementAmount
    : convert(db, settlementCurrency, payload.creditCurrency, settlementAmount).toAmount;

  const id = newId(db, 'payment', 'PAY_');
  db.prepare(`
    INSERT INTO payments(
      id, fromClientId, toClientId, fromBankId, toBankId,
      debitCurrency, creditCurrency, debitAmount, creditAmount,
      settlementCurrency, state, failReason,
      createdAtMs, executedAtMs, settledAtMs, routeJson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    fromClient.id,
    toClient.id,
    fromClient.bankId,
    toClient.bankId,
    payload.debitCurrency,
    payload.creditCurrency,
    toMoneyString(debitAmount),
    toMoneyString(creditAmount),
    settlementCurrency,
    'QUEUED',
    null,
    simNow,
    null,
    null,
    JSON.stringify(route)
  );

  insertMessage(db, {
    paymentId: id,
    type: 'PAYMENT_INIT',
    createdAtMs: simNow,
    details: {
      route,
      debitCurrency: payload.debitCurrency,
      creditCurrency: payload.creditCurrency,
      settlementCurrency
    }
  });

  return { id };
}

export function insertMessage(db, { paymentId, type, createdAtMs, details }) {
  db.prepare('INSERT INTO payment_messages(id, paymentId, type, createdAtMs, detailsJson) VALUES(?, ?, ?, ?, ?)')
    .run(newId(db, 'payment_message', 'MSG_'), paymentId, type, createdAtMs, JSON.stringify(details ?? {}));
}

export function failPayment(db, paymentId, reason) {
  const simNow = getSimTimeMs(db);
  db.prepare('UPDATE payments SET state = ?, failReason = ?, executedAtMs = ? WHERE id = ?')
    .run('FAILED', reason, simNow, paymentId);
  insertMessage(db, { paymentId, type: 'FAILED', createdAtMs: simNow, details: { reason } });
}

export function executePayment(db, paymentId) {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.state !== 'QUEUED') return;

  const simNow = getSimTimeMs(db);

  const tx = db.transaction(() => {
    const debitAmount = d(payment.debitAmount);
    const creditAmount = d(payment.creditAmount);
    const settlementAmount = payment.debitCurrency === payment.settlementCurrency
      ? debitAmount
      : convert(db, payment.debitCurrency, payment.settlementCurrency, debitAmount).toAmount;

    // FX at originating bank if needed: debitCurrency -> settlementCurrency
    if (payment.debitCurrency !== payment.settlementCurrency) {
      applyRegularClientDelta(db, { clientId: payment.fromClientId, currency: payment.debitCurrency, delta: debitAmount.neg() });
      applyRegularClientDelta(db, { clientId: payment.fromClientId, currency: payment.settlementCurrency, delta: settlementAmount });

      const fromBank = db.prepare('SELECT name FROM banks WHERE id = ?').get(payment.fromBankId);
      fxLogEvent(db, {
        id: newId(db, 'fx_event', 'FX_'),
        paymentId,
        bankId: payment.fromBankId,
        fromCurrency: payment.debitCurrency,
        toCurrency: payment.settlementCurrency,
        fromAmount: debitAmount,
        toAmount: settlementAmount,
        rate: settlementAmount.div(debitAmount),
        createdAtMs: simNow,
        reason: 'Payment origin FX'
      });
      insertMessage(db, {
        paymentId,
        type: 'FX_CONVERSION',
        createdAtMs: simNow,
        details: {
          bankName: fromBank?.name ?? payment.fromBankId,
          fromCurrency: payment.debitCurrency,
          toCurrency: payment.settlementCurrency,
          fromAmount: debitAmount.toFixed(2),
          toAmount: settlementAmount.toFixed(2)
        }
      });
    }

    // 1) Move client balances without touching Nostro/Vostro
    // Debit originating client in settlement currency, credit beneficiary client in credit currency.
    applyRegularClientDeltaClientOnly(db, { clientId: payment.fromClientId, currency: payment.settlementCurrency, delta: settlementAmount.neg() });
    applyRegularClientDeltaClientOnly(db, { clientId: payment.toClientId, currency: payment.creditCurrency, delta: creditAmount });

    // 2) Interbank settlement in settlement currency
    settleInterbank(db, {
      fromBankId: payment.fromBankId,
      toBankId: payment.toBankId,
      currency: payment.settlementCurrency,
      amount: settlementAmount
    });

    // 3) FX at destination bank if needed: consume beneficiary Nostro in settlement currency
    // and record the conversion into the beneficiary base currency paid to the client.
    if (payment.settlementCurrency !== payment.creditCurrency) {
      const n = getNostro(db, payment.toBankId, payment.settlementCurrency);
      if (!n) throw new Error(`Missing Nostro for beneficiary bank in ${payment.settlementCurrency}`);

      adjustNostroAndMirrorVostro(db, {
        ownerBankId: payment.toBankId,
        correspondentBankId: n.correspondentBankId,
        currency: payment.settlementCurrency,
        delta: settlementAmount.neg()
      });

      const toBankRow = getBank(db, payment.toBankId);
      if (!toBankRow) throw new Error('Bank not found');
      if (payment.creditCurrency !== toBankRow.baseCurrency) {
        const n2 = getNostro(db, payment.toBankId, payment.creditCurrency);
        if (!n2) throw new Error(`Missing Nostro for beneficiary bank in ${payment.creditCurrency}`);
        adjustNostroAndMirrorVostro(db, {
          ownerBankId: payment.toBankId,
          correspondentBankId: n2.correspondentBankId,
          currency: payment.creditCurrency,
          delta: creditAmount
        });
      }

      const toBank = db.prepare('SELECT name FROM banks WHERE id = ?').get(payment.toBankId);
      fxLogEvent(db, {
        id: newId(db, 'fx_event', 'FX_'),
        paymentId,
        bankId: payment.toBankId,
        fromCurrency: payment.settlementCurrency,
        toCurrency: payment.creditCurrency,
        fromAmount: settlementAmount,
        toAmount: creditAmount,
        rate: creditAmount.div(settlementAmount),
        createdAtMs: simNow,
        reason: 'Payment destination FX'
      });
      insertMessage(db, {
        paymentId,
        type: 'FX_CONVERSION',
        createdAtMs: simNow,
        details: {
          bankName: toBank?.name ?? payment.toBankId,
          fromCurrency: payment.settlementCurrency,
          toCurrency: payment.creditCurrency,
          fromAmount: settlementAmount.toFixed(2),
          toAmount: creditAmount.toFixed(2)
        }
      });
    }

    insertMessage(db, {
      paymentId,
      type: 'LIQUIDATION',
      createdAtMs: simNow,
      details: {
        settlementCurrency: payment.settlementCurrency,
        amount: settlementAmount.toFixed(2),
        route: JSON.parse(payment.routeJson)
      }
    });

    db.prepare('UPDATE payments SET state = ?, executedAtMs = ? WHERE id = ?').run('EXECUTED', simNow, paymentId);
    insertMessage(db, { paymentId, type: 'EXECUTED', createdAtMs: simNow, details: {} });

    db.prepare('UPDATE payments SET state = ?, settledAtMs = ? WHERE id = ?').run('SETTLED', simNow, paymentId);
    insertMessage(db, { paymentId, type: 'SETTLED', createdAtMs: simNow, details: {} });
  });

  try {
    tx();
  } catch (e) {
    failPayment(db, paymentId, String(e.message ?? e));
  }
}

function settleInterbank(db, { fromBankId, toBankId, currency, amount }) {
  if (fromBankId === toBankId) return;

  const fromBank = getBank(db, fromBankId);
  const toBank = getBank(db, toBankId);
  if (!fromBank || !toBank) throw new Error('Bank not found');

  // Direct settlement when both banks share the same base currency (educational simplification: no central bank ledger)
  if (fromBank.baseCurrency === currency && toBank.baseCurrency === currency) return;

  const route = findMinimumHopRoute(db, fromBankId, toBankId, currency);
  if (!route || route.length < 2) throw new Error('No settlement route');

  const firstHop = route[1];
  const lastHop = route[route.length - 2];

  if (fromBank.baseCurrency !== currency) {
    const n = getNostro(db, fromBankId, currency);
    if (!n) throw new Error(`Missing Nostro for originating bank in ${currency}`);
    if (n.correspondentBankId !== firstHop) {
      throw new Error('Route mismatch for originating bank Nostro correspondent');
    }
    adjustNostroAndMirrorVostro(db, {
      ownerBankId: fromBankId,
      correspondentBankId: n.correspondentBankId,
      currency,
      delta: amount.neg()
    });
  }

  if (toBank.baseCurrency !== currency) {
    const n = getNostro(db, toBankId, currency);
    if (!n) throw new Error(`Missing Nostro for beneficiary bank in ${currency}`);
    if (n.correspondentBankId !== lastHop) {
      throw new Error('Route mismatch for beneficiary bank Nostro correspondent');
    }
    adjustNostroAndMirrorVostro(db, {
      ownerBankId: toBankId,
      correspondentBankId: n.correspondentBankId,
      currency,
      delta: amount
    });
  }
}
