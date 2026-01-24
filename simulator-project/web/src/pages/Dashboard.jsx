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
  const [paymentPage, setPaymentPage] = useState({});

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
      // Identificar divisas disponibles
      const currencySet = new Set([b.baseCurrency]);

      // Añadir divisas de Nostros (indica disponibilidad)
      const nlist = nostrosByOwnerBankId.get(b.id);
      if (nlist) {
        for (const n of nlist) currencySet.add(n.currency);
      }

      // Añadir divisas de clientes
      for (const c of clientsAtBanks) {
        if (c.bankId !== b.id) continue;
        for (const bal of c.balances ?? []) {
          currencySet.add(bal.currency);
        }
      }

      // Calcular balances totales SOLO de clientes (REGULAR + VOSTRO)
      const balanceMap = new Map();
      for (const cur of currencySet) {
        let total = 0;
        for (const c of clientsAtBanks) {
          if (c.bankId !== b.id) continue;
          // Suma TODOS los clientes del banco (REGULAR y VOSTRO)
          const balance = c.balances?.find(bal => bal.currency === cur);
          if (balance) total += Number(balance.amount);
        }
        balanceMap.set(cur, total);
      }

      totals.set(b.id, {
        currencies: Array.from(currencySet).sort((a, b) => String(a).localeCompare(String(b))),
        totals: balanceMap
      });
    }

    return totals;
  }, [banks, nostrosByOwnerBankId, clientsAtBanks]);

  const simHour = useMemo(() => {
    if (!clock?.simTimeMs) return null;
    return new Date(clock.simTimeMs).getUTCHours();
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
      <div className="dashboard-left">
        <section className="card">
          <h2>Correspondent network</h2>
          <BankNetworkGraph banks={banks} nostros={nostros} payments={payments} clock={clock} />
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
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {(bankTotals.get(b.id)?.currencies ?? [b.baseCurrency]).map((cur) => (
                      <div key={cur} className="badge" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        <span style={{ fontWeight: '700' }}>{cur}</span>
                        {' '}
                        <span style={{ fontWeight: '600' }}>{Number(bankTotals.get(b.id)?.totals?.get(cur) ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <form className="form" onSubmit={onCreateBank} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
              <input
                placeholder="Bank name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{ flex: '1' }}
              />
              <select value={form.baseCurrency} onChange={(e) => setForm((f) => ({ ...f, baseCurrency: e.target.value }))}>
                {['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN', 'HKD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button className="btn" type="submit">Create bank</button>
            </form>

            {error ? <div className="error">{error}</div> : null}
          </section>

          <section className="card">
            <h2>Payments</h2>
            {paymentsByCreditCurrency.length === 0 ? <div className="muted">No payments yet.</div> : null}
            <div className="columns">
              {paymentsByCreditCurrency.map(([currency, list]) => {
                const page = paymentPage[currency] ?? 0;
                const totalPages = Math.ceil(list.length / 10);
                const pageList = list.slice(page * 10, (page + 1) * 10);
                return (
                  <div className="column" key={currency}>
                    <div className="column-title">{currency}</div>
                    {pageList.map((p) => {
                      const dt = new Date(p.createdAtMs);
                      const dateStr = dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                      const timeStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div className="payment" key={p.id}>
                          <div className="payment-top">
                            <div className={`state state-${p.state.toLowerCase()}`}>{p.state}</div>
                            <div className="muted">{dateStr} {timeStr}</div>
                          </div>
                          <div className="payment-body">
                            <div className="muted">{p.fromClientName} ({p.fromBankName}) → {p.toClientName} ({p.toBankName})</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span className="muted">Debit: {Number(p.debitAmount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.debitCurrency}</span>
                              <b>{Number(p.creditAmount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.creditCurrency}</b>
                              <span className="muted">Settlement: {p.settlementCurrency}</span>
                            </div>
                            <div className="muted">Route: {p.route?.length ? p.route.map((id) => {
                              const name = bankNameById.get(id) ?? id;
                              return p.fxAtBankIds?.includes(id) ? `${name} (FX)` : name;
                            }).join(' → ') : '—'}</div>
                            {p.failReason ? <div className="error">{p.failReason}</div> : null}
                          </div>
                        </div>
                      );
                    })}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px' }}>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={page === 0} onClick={() => setPaymentPage((prev) => ({ ...prev, [currency]: page - 1 }))}>← Prev</button>
                        <span className="muted">{page + 1}/{totalPages}</span>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={page >= totalPages - 1} onClick={() => setPaymentPage((prev) => ({ ...prev, [currency]: page + 1 }))}>Next →</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="dashboard-right">
        <section className="card">
          <h2>Clearing hours</h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {clearing.map((c) => {
              const open = isOpen(c.openHour, c.closeHour, simHour);
              return (
                <div key={c.currency} style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '14px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(15, 23, 42, 0.4)'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', minWidth: '45px' }}>{c.currency}</div>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--muted)', flex: '1' }}>
                    {String(c.openHour).padStart(2, '0')}:00 - {String(c.closeHour).padStart(2, '0')}:00
                  </div>
                  <div>
                    {open == null ? <span className="badge">—</span> : open ? <span className="badge badge-open">ABIERTA</span> : <span className="badge badge-closed">CERRADA</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>FX rates</h2>
          <div style={{ display: 'grid', gap: '6px' }}>
            {currencies.map((c) => {
              const r = fx.find((x) => x.quoteCurrency === c);
              if (!r) return null;
              return (
                <div key={c} className="badge" style={{ padding: '8px 10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700' }}>USD/{c}</span>
                  <span style={{ fontWeight: '600' }}>{r.rate}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
