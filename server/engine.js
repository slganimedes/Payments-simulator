import { isWithinClearingHours } from './domain/clearing.js';
import { executePayment } from './domain/payments.js';

export function startEngine(db) {
  const timer = setInterval(() => {
    try {
      processQueued(db);
    } catch {
      // ignore engine loop errors (deterministic state preserved by transactions)
    }
  }, 500);

  return () => clearInterval(timer);
}

function processQueued(db) {
  const queued = db.prepare(
    "SELECT id, settlementCurrency FROM payments WHERE state = 'QUEUED' ORDER BY createdAtMs ASC"
  ).all();

  for (const p of queued) {
    if (isWithinClearingHours(db, p.settlementCurrency)) {
      executePayment(db, p.id);
    }
  }
}
