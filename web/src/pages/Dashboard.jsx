import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api.js';
import BankNetworkGraph from '../components/BankNetworkGraph.jsx';

function currencyOrder(a, b) {
  return String(a).localeCompare(String(b));
}

function isOpen(openHour, closeHour, hour) {
  if (hour == null) return null;
  if (openHour === closeHour) return true;
  if (openHour < closeHour) return hour >= openHour && hour < closeHour;
  return hour >= openHour || hour < closeHour;
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

export default function Dashboard() {
  const [banks, setBanks] = useState([]);
  const [fx, setFx] = useState([]);
  const [clearing, setClearing] = useState([]);
  const [nostros, setNostros] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clock, setClock] = useState(null);
  const [form, setForm] = useState({ name: '', baseCurrency: 'USD' });
  const [error, setError] = useState('');

  async function refresh() {
    const [b, f, c, n, cl, p, ck] = await Promise.all([
      apiGet('/api/banks'),
      apiGet('/api/fx'),
      apiGet('/api/clearing-hours'),
      apiGet('/api/nostros'),
      apiGet('/api/clients'),
      apiGet('/api/payments'),
      apiGet('/api/clock')
    ]);
    setBanks(b);
    setFx(f);
    setClearing(c);
    setNostros(n);
    setClients(cl);
    setPayments(p);
    setClock(ck);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
    const t = setInterval(() => refresh().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, []);

  const currencies = useMemo(() => {
    const set = new Set();
    fx.forEach((r) => set.add(r.quoteCurrency));
    return Array.from(set).sort(currencyOrder);
  }, [fx]);

  const clientsAtBanks = useMemo(() => clients, [clients]);

  const nostrosByOwnerBankId = useMemo(() => {
    const m = new Map();
    for (const n of nostros) {
      if (!m.has(n.ownerBankId)) m.set(n.ownerBankId, []);
      m.get(n.ownerBankId).push(n);
    }
    return m;
  }, [nostros]);

  const nostroCurrenciesByBankId = useMemo(() => {
    const m = new Map();
    for (const n of nostros) {
      if (!m.has(n.ownerBankId)) m.set(n.ownerBankId, new Set());
      m.get(n.ownerBankId).add(n.currency);
    }
    return m;
  }, [nostros]);

  const bankTotals = useMemo(() => {
    const totals = new Map();
    for (const b of banks) {
      const currencySet = new Set([b.baseCurrency]);
      const nset = nostroCurrenciesByBankId.get(b.id);
      if (nset) for (const cur of nset) currencySet.add(cur);
      const nlist = nostrosByOwnerBankId.get(b.id);
      if (nlist) for (const x of nlist) currencySet.add(x.currency);

      for (const c of clientsAtBanks) {
        if (c.bankId !== b.id) continue;
        for (const bal of c.balances ?? []) currencySet.add(bal.currency);
      }

      const map = new Map();
      for (const cur of currencySet) map.set(cur, 0);

      for (const c of clientsAtBanks) {
        if (c.bankId !== b.id) continue;
        for (const bal of c.balances ?? []) {
          if (!map.has(bal.currency)) continue;
          map.set(bal.currency, (map.get(bal.currency) ?? 0) + Number(bal.amount));
        }
      }

      for (const n of nlist ?? []) {
        if (!map.has(n.currency)) map.set(n.currency, 0);
        map.set(n.currency, (map.get(n.currency) ?? 0) + Number(n.balance));
      }

      totals.set(b.id, {
        currencies: Array.from(currencySet).sort((a, b) => String(a).localeCompare(String(b))),
        totals: map
      });
    }
    return totals;
  }, [banks, nostroCurrenciesByBankId, nostrosByOwnerBankId, clientsAtBanks]);

  const simHourCET = useMemo(() => {
    if (!clock?.simTimeMs) return null;
    // Convertir a CET (UTC+1)
    const utcHours = new Date(clock.simTimeMs).getUTCHours();
    return (utcHours + 1) % 24;
  }, [clock]);

  const bankNameById = useMemo(() => {
    const m = new Map();
    for (const b of banks) m.set(b.id, b.name);
    return m;
  }, [banks]);

  const paymentsByCreditCurrency = useMemo(() => {
    const m = groupBy(payments, (p) => p.creditCurrency);
    const entries = Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, list] of entries) list.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return entries;
  }, [payments]);

  async function onCreateBank(e) {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/banks', form);
      setForm({ name: '', baseCurrency: form.baseCurrency });
      await refresh();
    } catch (err) {
      setError(String(err.message ?? err));
    }
  }

  return (
    <div className="dashboard">
      <section className="card">
        <h2>Correspondent network</h2>
        <BankNetworkGraph banks={banks} nostros={nostros} />
      </section>

      <div className="dashboard-bottom">
        <section className="card">
          <h2>Banks</h2>

          <div className="list">
            {banks.length === 0 ? <div className="muted">No banks yet.</div> : null}
            {banks.map((b) => (
              <div key={b.id} className="list-item bank-item">
                <div className="list-title">
                  {b.name} <span className="muted">({b.baseCurrency})</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {(bankTotals.get(b.id)?.currencies ?? [b.baseCurrency]).map((cur) => (
                    <div key={cur} className="badge" style={{ padding: '8px 12px', fontSize: '18px' }}>
                      <span style={{ fontWeight: '700' }}>{cur}</span>
                      {' '}
                      <span style={{ fontWeight: '650' }}>{Number(bankTotals.get(b.id)?.totals?.get(cur) ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <form className="form" onSubmit={onCreateBank} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
            <input
              placeholder="Bank name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={{ flex: '1' }}
            />
            <select value={form.baseCurrency} onChange={(e) => setForm((f) => ({ ...f, baseCurrency: e.target.value }))}>
              {['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button className="btn" type="submit">Create bank</button>
          </form>

          {error ? <div className="error">{error}</div> : null}
        </section>

        <section className="card">
          <div className="subgrid">
            <div>
              <h3>Clearing hours</h3>
              <div className="table">
                {clearing.map((c) => {
                  const open = isOpen(c.openHour, c.closeHour, simHourCET);
                  return (
                    <div className="row" key={c.currency}>
                      <div className="cell"><b>{c.currency}</b></div>
                      <div className="cell">
                        {String(c.openHour).padStart(2, '0')}:00 - {String(c.closeHour).padStart(2, '0')}:00 CET{' '}
                        {open == null ? <span className="badge">—</span> : open ? <span className="badge badge-open">ABIERTA</span> : <span className="badge badge-closed">CERRADA</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3>FX rates (USD pivot)</h3>
              <div className="table">
                {currencies.map((c) => {
                  const r = fx.find((x) => x.quoteCurrency === c);
                  if (!r) return null;
                  return (
                    <div className="row" key={c}>
                      <div className="cell"><b>USD/{c}</b></div>
                      <div className="cell">{r.rate}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <h3>Payments</h3>
          {paymentsByCreditCurrency.length === 0 ? <div className="muted">No payments yet.</div> : null}
          <div className="columns">
            {paymentsByCreditCurrency.map(([currency, list]) => (
              <div className="column" key={currency}>
                <div className="column-title">{currency}</div>
                {list.map((p) => (
                  <div className="payment" key={p.id}>
                    <div className="payment-top">
                      <div className={`state state-${p.state.toLowerCase()}`}>{p.state}</div>
                      <div className="muted">{new Date(p.createdAtMs).toLocaleTimeString()}</div>
                    </div>
                    <div className="payment-body">
                      <div><b>{p.creditAmount.toFixed(2)} {p.creditCurrency}</b></div>
                      <div className="muted">Debit: {p.debitAmount.toFixed(2)} {p.debitCurrency}</div>
                      <div className="muted">Settlement: {p.settlementCurrency}</div>
                      <div className="muted">Route: {p.route?.length ? p.route.map((id) => bankNameById.get(id) ?? id).join(' -> ') : '—'}</div>
                      {p.failReason ? <div className="error">{p.failReason}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
