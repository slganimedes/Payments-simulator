import express from 'express';
import { z } from 'zod';

import { getSimTimeMs, getClock, pause, play, faster, slower } from './domain/clock.js';
import { getClearingHours } from './domain/clearing.js';
import { getFxRates } from './domain/fx.js';
import { newId } from './domain/ids.js';
import { listBanks, createBank, listClients, createRegularClient, getOrCreateHouseClient } from './domain/accounts.js';
import { applyRegularClientDelta } from './domain/balances.js';
import { d } from './domain/money.js';
import { listNostros, createNostroWithMirrorVostro } from './domain/nostroVostro.js';
import { listPayments, createPaymentIntent } from './domain/payments.js';
import { resetAll, resetClock } from './db.js';

export function buildApiRouter(db) {
  const r = express.Router();

  r.get('/clock', (req, res) => {
    const c = getClock(db);
    res.json({
      simTimeMs: getSimTimeMs(db),
      tick: c.tick,
      isPaused: c.tick === 0
    });
  });

  r.get('/fx', (req, res) => {
    res.json(getFxRates(db));
  });

  r.get('/fx-history', (req, res) => {
    const rows = db.prepare(`
      SELECT h.*, b.name AS bankName
      FROM fx_history h
      JOIN banks b ON b.id = h.bankId
      ORDER BY h.createdAtMs DESC
    `).all();
    res.json(rows.map((x) => ({
      id: x.id,
      paymentId: x.paymentId,
      bankId: x.bankId,
      bankName: x.bankName,
      fromCurrency: x.fromCurrency,
      toCurrency: x.toCurrency,
      fromAmount: Number(x.fromAmount),
      toAmount: Number(x.toAmount),
      rate: Number(x.rate),
      createdAtMs: x.createdAtMs,
      reason: x.reason
    })));
  });

  r.get('/clearing-hours', (req, res) => {
    res.json(getClearingHours(db));
  });

  r.get('/banks', (req, res) => {
    res.json(listBanks(db));
  });

  r.post('/banks', (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      baseCurrency: z.string().min(3).max(3)
    });
    const body = schema.parse(req.body);

    const now = getSimTimeMs(db);
    const id = newId(db, 'bank', 'B_');

    createBank(db, { id, name: body.name, baseCurrency: body.baseCurrency, createdAtMs: now });
    getOrCreateHouseClient(db, { bankId: id, createdAtMs: now });

    res.json({ id });
  });

  r.get('/clients', (req, res) => {
    res.json(listClients(db));
  });

  r.post('/clients/:clientId/deposit', (req, res) => {
    const schema = z.object({
      currency: z.string().min(3).max(3),
      amount: z.number().positive()
    });
    const body = schema.parse(req.body);

    const clientId = req.params.clientId;

    const c = db.prepare('SELECT type FROM clients WHERE id = ?').get(clientId);
    if (!c) throw new Error('Client not found');
    if (c.type !== 'REGULAR' && c.type !== 'HOUSE') throw new Error('Deposits are only allowed for regular or house clients');

    const tx = db.transaction(() => {
      applyRegularClientDelta(db, {
        clientId,
        currency: body.currency,
        delta: d(body.amount)
      });
    });

    tx();
    res.json({ ok: true });
  });

  r.post('/banks/:bankId/clients', (req, res) => {
    const schema = z.object({ name: z.string().min(1) });
    const body = schema.parse(req.body);

    const now = getSimTimeMs(db);
    const id = newId(db, 'client', 'C_');
    createRegularClient(db, { id, bankId: req.params.bankId, name: body.name, createdAtMs: now });

    res.json({ id });
  });

  r.get('/nostros', (req, res) => {
    res.json(listNostros(db));
  });

  r.post('/correspondents/nostro', (req, res) => {
    const schema = z.object({
      ownerBankId: z.string().min(1),
      correspondentBankId: z.string().min(1)
    });
    const body = schema.parse(req.body);

    const now = getSimTimeMs(db);
    const created = createNostroWithMirrorVostro(db, {
      ownerBankId: body.ownerBankId,
      correspondentBankId: body.correspondentBankId,
      createdAtMs: now
    });

    res.json(created);
  });

  r.get('/payments', (req, res) => {
    res.json(listPayments(db));
  });

  r.post('/payments', (req, res) => {
    const schema = z.object({
      fromClientId: z.string().min(1),
      toClientId: z.string().min(1),
      debitCurrency: z.string().min(3).max(3),
      creditCurrency: z.string().min(3).max(3),
      debitAmount: z.number().positive()
    });
    const body = schema.parse(req.body);

    const out = createPaymentIntent(db, body);
    res.json(out);
  });

  r.post('/admin/reset', (req, res) => {
    resetAll(db);
    res.json({ ok: true });
  });

  r.post('/admin/reset-clock', (req, res) => {
    resetClock(db);
    res.json({ ok: true });
  });

  r.post('/admin/clock/pause', (req, res) => {
    pause(db);
    const c = getClock(db);
    res.json({
      simTimeMs: getSimTimeMs(db),
      tick: c.tick,
      isPaused: true
    });
  });

  r.post('/admin/clock/play', (req, res) => {
    play(db);
    const c = getClock(db);
    res.json({
      simTimeMs: getSimTimeMs(db),
      tick: c.tick,
      isPaused: false
    });
  });

  r.post('/admin/clock/faster', (req, res) => {
    faster(db);
    const c = getClock(db);
    res.json({
      simTimeMs: getSimTimeMs(db),
      tick: c.tick,
      isPaused: c.tick === 0
    });
  });

  r.post('/admin/clock/slower', (req, res) => {
    slower(db);
    const c = getClock(db);
    res.json({
      simTimeMs: getSimTimeMs(db),
      tick: c.tick,
      isPaused: c.tick === 0
    });
  });

  return r;
}
