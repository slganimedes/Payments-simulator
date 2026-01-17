import { d, toMoneyString } from './money.js';
import { getBank, getOrCreateVostroClient, getClientBalance, setClientBalance } from './accounts.js';
import { newId } from './ids.js';

export function listNostros(db) {
  const rows = db.prepare(
    'SELECT id, ownerBankId, correspondentBankId, currency, balance, createdAtMs FROM nostros ORDER BY createdAtMs ASC'
  ).all();
  return rows.map((r) => ({
    id: r.id,
    ownerBankId: r.ownerBankId,
    correspondentBankId: r.correspondentBankId,
    currency: r.currency,
    balance: Number(r.balance),
    createdAtMs: r.createdAtMs
  }));
}

export function getNostro(db, ownerBankId, currency) {
  const row = db.prepare('SELECT id, correspondentBankId, currency, balance FROM nostros WHERE ownerBankId = ? AND currency = ?')
    .get(ownerBankId, currency);
  if (!row) return null;
  return {
    id: row.id,
    ownerBankId,
    correspondentBankId: row.correspondentBankId,
    currency: row.currency,
    balance: d(row.balance)
  };
}

export function createNostroWithMirrorVostro(db, { ownerBankId, correspondentBankId, createdAtMs }) {
  const owner = getBank(db, ownerBankId);
  const corr = getBank(db, correspondentBankId);
  if (!owner || !corr) throw new Error('Bank not found');

  const currency = corr.baseCurrency;
  if (currency === owner.baseCurrency) throw new Error('A bank cannot open a Nostro in its own base currency');

  const existing = db.prepare('SELECT 1 FROM nostros WHERE ownerBankId = ? AND currency = ?').get(ownerBankId, currency);
  if (existing) throw new Error(`Nostro already exists for ${currency}`);

  const vostroClient = getOrCreateVostroClient(db, { hostBankId: correspondentBankId, foreignBankId: ownerBankId, createdAtMs });

  const id = newId(db, 'nostro', 'NOS_');
  db.prepare(
    'INSERT INTO nostros(id, ownerBankId, correspondentBankId, currency, balance, createdAtMs) VALUES(?, ?, ?, ?, ?, ?)'
  ).run(id, ownerBankId, correspondentBankId, currency, '0.00', createdAtMs);

  // Mirror balance must exist and match (0.00)
  const vBal = getClientBalance(db, vostroClient.id, currency);
  if (!vBal.eq(0)) setClientBalance(db, vostroClient.id, currency, d(0));

  return { id, ownerBankId, correspondentBankId, currency };
}

export function adjustNostroAndMirrorVostro(db, { ownerBankId, correspondentBankId, currency, delta }) {
  const n = db.prepare(
    'SELECT id, balance FROM nostros WHERE ownerBankId = ? AND correspondentBankId = ? AND currency = ?'
  ).get(ownerBankId, correspondentBankId, currency);
  if (!n) throw new Error('Nostro not found for hop');

  const vostro = db.prepare(
    "SELECT id FROM clients WHERE bankId = ? AND type = 'VOSTRO' AND vostroForBankId = ?"
  ).get(correspondentBankId, ownerBankId);
  if (!vostro) throw new Error('Mirror Vostro client missing');

  const oldN = d(n.balance);
  const newN = oldN.add(delta);
  if (newN.lt(0)) throw new Error('Nostro balance cannot go negative');

  const vOld = getClientBalance(db, vostro.id, currency);
  const vNew = vOld.add(delta);
  if (vNew.lt(0)) throw new Error('Vostro balance cannot go negative');

  db.prepare('UPDATE nostros SET balance = ? WHERE id = ?').run(toMoneyString(newN), n.id);
  setClientBalance(db, vostro.id, currency, vNew);
}
