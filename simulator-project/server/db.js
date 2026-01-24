import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import { CLEARING_HOURS, DB_FILE_PATH, FX_USD_PIVOT_RATES, SIM_EPOCH_MS, SUPPORTED_CURRENCIES } from './config.js';

let _db;

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function getDb() {
  if (_db) return _db;
  ensureDirForFile(DB_FILE_PATH);
  _db = new Database(DB_FILE_PATH);
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  seedGlobals(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS counters (
      key TEXT PRIMARY KEY,
      next INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      baseCurrency TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      bankId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      vostroForBankId TEXT,
      createdAtMs INTEGER NOT NULL,
      FOREIGN KEY (bankId) REFERENCES banks(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_vostro_unique
      ON clients(bankId, type, vostroForBankId)
      WHERE type = 'VOSTRO';

    CREATE TABLE IF NOT EXISTS balances (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount TEXT NOT NULL,
      FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_balances_unique
      ON balances(clientId, currency);

    CREATE TABLE IF NOT EXISTS nostros (
      id TEXT PRIMARY KEY,
      ownerBankId TEXT NOT NULL,
      correspondentBankId TEXT NOT NULL,
      currency TEXT NOT NULL,
      balance TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL,
      FOREIGN KEY (ownerBankId) REFERENCES banks(id) ON DELETE CASCADE,
      FOREIGN KEY (correspondentBankId) REFERENCES banks(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_nostros_unique
      ON nostros(ownerBankId, currency);

    CREATE TABLE IF NOT EXISTS fx_rates (
      quoteCurrency TEXT PRIMARY KEY,
      rate TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clearing_hours (
      currency TEXT PRIMARY KEY,
      openHour INTEGER NOT NULL,
      closeHour INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sim_clock (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      simTimeMs INTEGER NOT NULL,
      tick INTEGER NOT NULL,
      pausedTick INTEGER NOT NULL,
      lastUpdateMs INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      fromClientId TEXT NOT NULL,
      toClientId TEXT NOT NULL,
      fromBankId TEXT NOT NULL,
      toBankId TEXT NOT NULL,
      debitCurrency TEXT NOT NULL,
      creditCurrency TEXT NOT NULL,
      debitAmount TEXT NOT NULL,
      creditAmount TEXT NOT NULL,
      settlementCurrency TEXT NOT NULL,
      state TEXT NOT NULL,
      failReason TEXT,
      createdAtMs INTEGER NOT NULL,
      executedAtMs INTEGER,
      settledAtMs INTEGER,
      routeJson TEXT NOT NULL,
      FOREIGN KEY (fromClientId) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (toClientId) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (fromBankId) REFERENCES banks(id) ON DELETE CASCADE,
      FOREIGN KEY (toBankId) REFERENCES banks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_messages (
      id TEXT PRIMARY KEY,
      paymentId TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL,
      detailsJson TEXT NOT NULL,
      FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fx_history (
      id TEXT PRIMARY KEY,
      paymentId TEXT,
      bankId TEXT NOT NULL,
      fromCurrency TEXT NOT NULL,
      toCurrency TEXT NOT NULL,
      fromAmount TEXT NOT NULL,
      toAmount TEXT NOT NULL,
      rate TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE SET NULL,
      FOREIGN KEY (bankId) REFERENCES banks(id) ON DELETE CASCADE
    );
  `);
}

function seedGlobals(db) {
  const insertFx = db.prepare('INSERT OR REPLACE INTO fx_rates(quoteCurrency, rate) VALUES(?, ?)');
  for (const [quoteCurrency, rate] of Object.entries(FX_USD_PIVOT_RATES)) {
    insertFx.run(quoteCurrency, rate);
  }

  const insertClearing = db.prepare('INSERT OR REPLACE INTO clearing_hours(currency, openHour, closeHour) VALUES(?, ?, ?)');
  for (const currency of SUPPORTED_CURRENCIES) {
    const h = CLEARING_HOURS[currency];
    insertClearing.run(currency, h.openHour, h.closeHour);
  }

  const existingClock = db.prepare('SELECT 1 FROM sim_clock WHERE id = 1').get();
  if (!existingClock) {
    db.prepare('INSERT INTO sim_clock(id, simTimeMs, tick, pausedTick, lastUpdateMs) VALUES(1, ?, ?, ?, ?)')
      .run(SIM_EPOCH_MS, 60, 60, Date.now());
  }
}

export function resetAll(db) {
  const tx = db.transaction(() => {
    db.exec(`
      DELETE FROM fx_history;
      DELETE FROM payment_messages;
      DELETE FROM payments;
      DELETE FROM balances;
      DELETE FROM clients;
      DELETE FROM nostros;
      DELETE FROM banks;
      DELETE FROM counters;
    `);

    db.prepare('DELETE FROM sim_clock WHERE id = 1').run();

    seedGlobals(db);
  });
  tx();
}

export function resetPayments(db) {
  const tx = db.transaction(() => {
    db.exec(`
      DELETE FROM fx_history;
      DELETE FROM payment_messages;
      DELETE FROM payments;
    `);
  });
  tx();
}

export function resetClock(db) {
  db.prepare('UPDATE sim_clock SET simTimeMs = ?, tick = ?, pausedTick = ?, lastUpdateMs = ? WHERE id = 1')
    .run(SIM_EPOCH_MS, 60, 60, Date.now());
}

export function nextId(db, key, prefix) {
  const tx = db.transaction(() => {
    const row = db.prepare('SELECT next FROM counters WHERE key = ?').get(key);
    const current = row ? row.next : 1;
    if (row) db.prepare('UPDATE counters SET next = ? WHERE key = ?').run(current + 1, key);
    else db.prepare('INSERT INTO counters(key, next) VALUES(?, ?)').run(key, 2);
    return `${prefix}${String(current).padStart(4, '0')}`;
  });
  return tx();
}
