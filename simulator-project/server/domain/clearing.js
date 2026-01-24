import { getSimTimeMs } from './clock.js';

export function getClearingHours(db) {
  const rows = db.prepare('SELECT currency, openHour, closeHour FROM clearing_hours').all();
  return rows.map((r) => ({ currency: r.currency, openHour: r.openHour, closeHour: r.closeHour }));
}

export function isWithinClearingHours(db, currency) {
  const row = db.prepare('SELECT openHour, closeHour FROM clearing_hours WHERE currency = ?').get(currency);
  if (!row) throw new Error(`Missing clearing hours for ${currency}`);

  const simTimeMs = getSimTimeMs(db);
  const dt = new Date(simTimeMs);
  const hour = dt.getUTCHours();

  const open = row.openHour;
  const close = row.closeHour;

  if (open === close) return true;
  if (open < close) return hour >= open && hour < close;
  return hour >= open || hour < close;
}
