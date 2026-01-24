import { createPaymentIntent } from './domain/payments.js';

let domesticInterval = null;
let crossCurrencyInterval = null;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roundTwo(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Domestic auto-exchange: for each base currency with 2+ banks,
 * pick two random clients (with balance) from different banks and
 * create a payment in the base currency (~100 units).
 */
function runDomestic(db) {
  try {
    const banks = db.prepare('SELECT id, baseCurrency FROM banks').all();

    // Group banks by baseCurrency
    const byBase = new Map();
    for (const b of banks) {
      if (!byBase.has(b.baseCurrency)) byBase.set(b.baseCurrency, []);
      byBase.get(b.baseCurrency).push(b.id);
    }

    for (const [currency, bankIds] of byBase) {
      if (bankIds.length < 2) continue;

      // Find clients with balance > 0 in this currency, grouped by bank
      const clientsByBank = new Map();
      for (const bankId of bankIds) {
        const clients = db.prepare(`
          SELECT c.id, b.amount
          FROM clients c
          JOIN balances b ON b.clientId = c.id AND b.currency = ?
          WHERE c.bankId = ? AND c.type IN ('REGULAR', 'HOUSE') AND CAST(b.amount AS REAL) > 0
        `).all(currency, bankId);
        if (clients.length > 0) clientsByBank.set(bankId, clients);
      }

      // Need clients in at least 2 different banks
      const availableBanks = Array.from(clientsByBank.keys());
      if (availableBanks.length < 2) continue;

      // Pick two different banks
      const fromBankId = pick(availableBanks);
      const remainingBanks = availableBanks.filter((id) => id !== fromBankId);
      const toBankId = pick(remainingBanks);

      const fromClient = pick(clientsByBank.get(fromBankId));
      const toClient = pick(clientsByBank.get(toBankId));

      const maxAmount = Math.min(Number(fromClient.amount), 150);
      const amount = roundTwo(rand(Math.min(50, maxAmount * 0.5), maxAmount));
      if (amount <= 0) continue;

      createPaymentIntent(db, {
        fromClientId: fromClient.id,
        toClientId: toClient.id,
        debitCurrency: currency,
        creditCurrency: currency,
        debitAmount: amount
      });
    }
  } catch (e) {
    console.log('[AUTO-DOMESTIC] Error:', e.message ?? e);
  }
}

/**
 * Cross-currency auto-exchange: pick a random client with balance,
 * find a directly connected bank (1 hop via nostro) and send in a
 * different currency than the debit currency.
 */
function runCrossCurrency(db) {
  try {
    // Find all clients with positive balance (REGULAR or HOUSE)
    const clientsWithBalance = db.prepare(`
      SELECT c.id AS clientId, c.bankId, b.currency, b.amount
      FROM clients c
      JOIN balances b ON b.clientId = c.id
      WHERE c.type IN ('REGULAR', 'HOUSE') AND CAST(b.amount AS REAL) > 0
    `).all();

    if (clientsWithBalance.length === 0) return;

    // Shuffle and try to find a valid pair
    const shuffled = clientsWithBalance.sort(() => Math.random() - 0.5);

    for (const from of shuffled) {
      // Find banks directly connected via nostro FROM the sender's bank
      const nostros = db.prepare(`
        SELECT correspondentBankId, currency
        FROM nostros
        WHERE ownerBankId = ?
      `).all(from.bankId);

      if (nostros.length === 0) continue;

      // Pick a nostro that gives us a different currency
      const crossNostros = nostros.filter((n) => n.currency !== from.currency);
      if (crossNostros.length === 0) continue;

      const chosenNostro = pick(crossNostros);
      const creditCurrency = chosenNostro.currency;
      const toBankId = chosenNostro.correspondentBankId;

      // Find a client in the destination bank
      const toClients = db.prepare(`
        SELECT id FROM clients
        WHERE bankId = ? AND type IN ('REGULAR', 'HOUSE')
      `).all(toBankId);

      if (toClients.length === 0) continue;

      const toClient = pick(toClients);

      const maxAmount = Math.min(Number(from.amount), 150);
      const amount = roundTwo(rand(Math.min(50, maxAmount * 0.5), maxAmount));
      if (amount <= 0) continue;

      createPaymentIntent(db, {
        fromClientId: from.clientId,
        toClientId: toClient.id,
        debitCurrency: from.currency,
        creditCurrency: creditCurrency,
        debitAmount: amount
      });
      return; // One payment per tick
    }
  } catch (e) {
    console.log('[AUTO-CROSS] Error:', e.message ?? e);
  }
}

export function startDomestic(db) {
  if (domesticInterval) return;
  domesticInterval = setInterval(() => runDomestic(db), 5000);
  console.log('[AUTO] Domestic exchange started');
}

export function stopDomestic() {
  if (domesticInterval) {
    clearInterval(domesticInterval);
    domesticInterval = null;
    console.log('[AUTO] Domestic exchange stopped');
  }
}

export function isDomesticRunning() {
  return domesticInterval !== null;
}

export function startCrossCurrency(db) {
  if (crossCurrencyInterval) return;
  crossCurrencyInterval = setInterval(() => runCrossCurrency(db), 5000);
  console.log('[AUTO] Cross-currency exchange started');
}

export function stopCrossCurrency() {
  if (crossCurrencyInterval) {
    clearInterval(crossCurrencyInterval);
    crossCurrencyInterval = null;
    console.log('[AUTO] Cross-currency exchange stopped');
  }
}

export function isCrossCurrencyRunning() {
  return crossCurrencyInterval !== null;
}
