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

  // Obtener hora en CET (UTC+1)
  // Nota: esto no considera el horario de verano (CEST = UTC+2)
  // Para una implementación más precisa, se podría usar una librería de zonas horarias
  const utcHours = dt.getUTCHours();
  const cetHour = (utcHours + 1) % 24;

  // Model: opening hour inclusive, closing hour exclusive.
  // If closeHour < openHour, treat as overnight window.
  const open = row.openHour;
  const close = row.closeHour;

  if (open === close) return true;
  if (open < close) return cetHour >= open && cetHour < close;
  return cetHour >= open || cetHour < close;
}
