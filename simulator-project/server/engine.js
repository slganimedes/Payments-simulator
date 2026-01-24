import { isWithinClearingHours } from './domain/clearing.js';
import { executePayment } from './domain/payments.js';

export function startEngine(db) {
  const timer = setInterval(() => {
    try {
      processQueued(db);
    } catch {
      // ignore engine loop errors (deterministic state preserved by transactions)
    }
  }, 1000);

  return () => clearInterval(timer);
}

function processQueued(db) {
  const queued = db.prepare(
    "SELECT id, settlementCurrency, fromBankId, toBankId FROM payments WHERE state = 'QUEUED' ORDER BY createdAtMs ASC"
  ).all();

  for (const p of queued) {
    const isIntraBank = p.fromBankId === p.toBankId;
    if (isIntraBank || isWithinClearingHours(db, p.settlementCurrency)) {
      executePayment(db, p.id);
      break; // FIFO: 1 payment per second
    }
  }
}
