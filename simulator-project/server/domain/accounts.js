import { d, toMoneyString } from './money.js';
import { newId } from './ids.js';

export function listBanks(db) {
  return db.prepare('SELECT id, name, baseCurrency, createdAtMs FROM banks ORDER BY createdAtMs ASC').all();
}

export function getBank(db, bankId) {
  return db.prepare('SELECT id, name, baseCurrency, createdAtMs FROM banks WHERE id = ?').get(bankId) ?? null;
}

export function createBank(db, { id, name, baseCurrency, createdAtMs }) {
  db.prepare('INSERT INTO banks(id, name, baseCurrency, createdAtMs) VALUES(?, ?, ?, ?)')
    .run(id, name, baseCurrency, createdAtMs);
}

export function listClients(db) {
  const clients = db.prepare('SELECT id, bankId, name, type, vostroForBankId, createdAtMs FROM clients ORDER BY createdAtMs ASC').all();
  const balances = db.prepare('SELECT clientId, currency, amount FROM balances').all();
  const byClient = new Map();
  for (const b of balances) {
    if (!byClient.has(b.clientId)) byClient.set(b.clientId, []);
    byClient.get(b.clientId).push({ currency: b.currency, amount: Number(b.amount) });
  }
  for (const v of byClient.values()) v.sort((a, b) => a.currency.localeCompare(b.currency));
  return clients.map((c) => ({
    ...c,
    balances: byClient.get(c.id) ?? []
  }));
}

export function createRegularClient(db, { id, bankId, name, createdAtMs }) {
  db.prepare('INSERT INTO clients(id, bankId, name, type, vostroForBankId, createdAtMs) VALUES(?, ?, ?, ?, ?, ?)')
    .run(id, bankId, name, 'REGULAR', null, createdAtMs);
}

export function getOrCreateHouseClient(db, { bankId, createdAtMs }) {
  const existing = db.prepare(
    "SELECT id, bankId, name, type, vostroForBankId, createdAtMs FROM clients WHERE bankId = ? AND type = 'HOUSE'"
  ).get(bankId);

  if (existing) return existing;

  const id = newId(db, 'house_client', 'HOUSE_');
  const bank = db.prepare('SELECT name FROM banks WHERE id = ?').get(bankId);
  const name = `${bank?.name ?? bankId} (House)`;
  db.prepare('INSERT INTO clients(id, bankId, name, type, vostroForBankId, createdAtMs) VALUES(?, ?, ?, ?, ?, ?)')
    .run(id, bankId, name, 'HOUSE', null, createdAtMs);

  return db.prepare('SELECT id, bankId, name, type, vostroForBankId, createdAtMs FROM clients WHERE id = ?').get(id);
}

export function getOrCreateVostroClient(db, { hostBankId, foreignBankId, createdAtMs }) {
  const existing = db.prepare(
    "SELECT id, bankId, name, type, vostroForBankId, createdAtMs FROM clients WHERE bankId = ? AND type = 'VOSTRO' AND vostroForBankId = ?"
  ).get(hostBankId, foreignBankId);

  if (existing) return existing;

  const id = newId(db, 'vostro_client', 'VOSTRO_');
  const name = `Vostro for ${foreignBankId}`;
  db.prepare('INSERT INTO clients(id, bankId, name, type, vostroForBankId, createdAtMs) VALUES(?, ?, ?, ?, ?, ?)')
    .run(id, hostBankId, name, 'VOSTRO', foreignBankId, createdAtMs);

  return db.prepare('SELECT id, bankId, name, type, vostroForBankId, createdAtMs FROM clients WHERE id = ?').get(id);
}

export function getClientBalance(db, clientId, currency) {
  const row = db.prepare('SELECT amount FROM balances WHERE clientId = ? AND currency = ?').get(clientId, currency);
  return row ? d(row.amount) : d(0);
}

export function setClientBalance(db, clientId, currency, amount) {
  const id = newId(db, 'balance', 'BAL_');
  const exists = db.prepare('SELECT id FROM balances WHERE clientId = ? AND currency = ?').get(clientId, currency);
  if (exists) {
    db.prepare('UPDATE balances SET amount = ? WHERE clientId = ? AND currency = ?')
      .run(toMoneyString(amount), clientId, currency);
  } else {
    db.prepare('INSERT INTO balances(id, clientId, currency, amount) VALUES(?, ?, ?, ?)')
      .run(id, clientId, currency, toMoneyString(amount));
  }
}
