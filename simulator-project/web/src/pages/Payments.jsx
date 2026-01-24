import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api.js';

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

export default function Payments() {
  const [banks, setBanks] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [nostros, setNostros] = useState([]);
  const [error, setError] = useState('');

  const [depositForm, setDepositForm] = useState({
    clientId: '',
    currency: 'USD',
    amount: '100.00'
  });

  const [form, setForm] = useState({
    fromClientId: '',
    toClientId: '',
    debitCurrency: 'USD',
    creditCurrency: 'USD',
    debitAmount: '100.00'
  });

  async function refresh() {
    const [b, c, p, n] = await Promise.all([
      apiGet('/api/banks'),
      apiGet('/api/clients'),
      apiGet('/api/payments'),
      apiGet('/api/nostros')
    ]);
    setBanks(b);
    setClients(c);
    setPayments(p);
    setNostros(n);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
    const t = setInterval(() => refresh().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, []);

  const regularClients = useMemo(() => clients.filter((c) => c.type === 'REGULAR' || c.type === 'HOUSE'), [clients]);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);

  const nostroCurrenciesByBankId = useMemo(() => {
    const m = new Map();
    for (const n of nostros) {
      if (!m.has(n.ownerBankId)) m.set(n.ownerBankId, new Set());
      m.get(n.ownerBankId).add(n.currency);
    }
    return m;
  }, [nostros]);

  const availableCurrenciesForClient = useMemo(() => {
    const m = new Map();
    for (const c of regularClients) {
      const bank = bankById.get(c.bankId);
      const set = new Set();
      if (bank?.baseCurrency) set.add(bank.baseCurrency);
      const nset = nostroCurrenciesByBankId.get(c.bankId);
      if (nset) for (const cur of nset) set.add(cur);
      const arr = Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
      m.set(c.id, arr.length ? arr : ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN']);
    }
    return m;
  }, [regularClients, bankById, nostroCurrenciesByBankId]);

  const byCreditCurrency = useMemo(() => {
    const m = groupBy(payments, (p) => p.creditCurrency);
    const entries = Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, list] of entries) list.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return entries;
  }, [payments]);

  const bankNameById = useMemo(() => {
    const m = new Map();
    for (const b of banks) m.set(b.id, b.name);
    return m;
  }, [banks]);

  const selectedFrom = useMemo(() => regularClients.find((c) => c.id === form.fromClientId) ?? null, [regularClients, form.fromClientId]);
  const selectedTo = useMemo(() => regularClients.find((c) => c.id === form.toClientId) ?? null, [regularClients, form.toClientId]);

  const fromCurrencies = useMemo(() => {
    if (!selectedFrom) return [];
    return (selectedFrom.balances ?? [])
      .filter((b) => Number(b.amount) > 0)
      .map((b) => b.currency);
  }, [selectedFrom]);

  const toCurrencies = useMemo(() => {
    if (!selectedTo) return ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN'];
    return availableCurrenciesForClient.get(selectedTo.id) ?? ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN'];
  }, [selectedTo, availableCurrenciesForClient]);

  useEffect(() => {
    if (!selectedFrom) return;
    if (!form.debitCurrency || !fromCurrencies.includes(form.debitCurrency)) {
      const next = fromCurrencies[0] ?? '';
      if (form.debitCurrency !== next) setForm((f) => ({ ...f, debitCurrency: next }));
    }
  }, [selectedFrom, fromCurrencies, form.debitCurrency]);

  useEffect(() => {
    if (!selectedTo) return;
    if (!form.creditCurrency || !toCurrencies.includes(form.creditCurrency)) {
      const next = toCurrencies[0] ?? 'USD';
      if (form.creditCurrency !== next) setForm((f) => ({ ...f, creditCurrency: next }));
    }
  }, [selectedTo, toCurrencies, form.creditCurrency]);

  async function onCreatePayment(e) {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/payments', {
        ...form,
        debitAmount: Number(form.debitAmount)
      });
      await refresh();
    } catch (err) {
      setError(String(err.message ?? err));
    }
  }

  const selectedDepositClient = useMemo(
    () => regularClients.find((c) => c.id === depositForm.clientId) ?? null,
    [regularClients, depositForm.clientId]
  );

  const depositCurrencies = useMemo(() => {
    if (!selectedDepositClient) return ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN'];
    return availableCurrenciesForClient.get(selectedDepositClient.id) ?? ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN'];
  }, [selectedDepositClient, availableCurrenciesForClient]);

  useEffect(() => {
    if (!selectedDepositClient) return;
    if (!depositCurrencies.includes(depositForm.currency)) {
      setDepositForm((f) => ({ ...f, currency: depositCurrencies[0] ?? 'USD' }));
    }
  }, [selectedDepositClient, depositCurrencies, depositForm.currency]);

  async function onDeposit(e) {
    e.preventDefault();
    setError('');
    try {
      if (!depositForm.clientId) throw new Error('Select a client');
      await apiPost(`/api/clients/${depositForm.clientId}/deposit`, {
        currency: depositForm.currency,
        amount: Number(depositForm.amount)
      });
      await refresh();
      setDepositForm((f) => ({ ...f, amount: '100.00' }));
    } catch (err) {
      setError(String(err.message ?? err));
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Create payment</h2>

        {error ? <div className="error">{error}</div> : null}

        <form className="form" onSubmit={onCreatePayment}>
          <label>
            From
            <select value={form.fromClientId} onChange={(e) => setForm((f) => ({ ...f, fromClientId: e.target.value }))}>
              <option value="">Select…</option>
              {regularClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {banks.find((b) => b.id === c.bankId)?.name ?? c.bankId} · {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            To
            <select value={form.toClientId} onChange={(e) => setForm((f) => ({ ...f, toClientId: e.target.value }))}>
              <option value="">Select…</option>
              {regularClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {banks.find((b) => b.id === c.bankId)?.name ?? c.bankId} · {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Debit currency
            <select
              value={form.debitCurrency}
              onChange={(e) => setForm((f) => ({ ...f, debitCurrency: e.target.value }))}
              disabled={!form.fromClientId || fromCurrencies.length === 0}
            >
              {fromCurrencies.length === 0 ? <option value="">No funds</option> : null}
              {fromCurrencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            Credit currency
            <select
              value={form.creditCurrency}
              onChange={(e) => setForm((f) => ({ ...f, creditCurrency: e.target.value }))}
              disabled={!form.toClientId}
            >
              {toCurrencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            Debit amount
            <input value={form.debitAmount} onChange={(e) => setForm((f) => ({ ...f, debitAmount: e.target.value }))} />
          </label>

          <button
            className="btn"
            type="submit"
            disabled={
              !form.fromClientId ||
              !form.toClientId ||
              !form.debitCurrency ||
              !form.creditCurrency ||
              fromCurrencies.length === 0
            }
          >
            Create
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Deposit</h2>
        <form className="form" onSubmit={onDeposit}>
          <label>
            Bank · client
            <select
              value={depositForm.clientId}
              onChange={(e) => setDepositForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Select…</option>
              {regularClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {bankById.get(c.bankId)?.name ?? c.bankId} · {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Currency
            <select
              value={depositForm.currency}
              onChange={(e) => setDepositForm((f) => ({ ...f, currency: e.target.value }))}
            >
              {depositCurrencies.map((cur) => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </select>
          </label>

          <label>
            Amount
            <input
              value={depositForm.amount}
              onChange={(e) => setDepositForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>

          <button className="btn" type="submit" disabled={!depositForm.clientId}>Deposit</button>
        </form>
      </section>

      <section className="card">
        <h2>Clients</h2>
        {regularClients.length === 0 ? <div className="muted">No regular clients yet.</div> : null}

        <div className="list">
          {regularClients.map((c) => {
            const bank = bankById.get(c.bankId);
            const currencies = availableCurrenciesForClient.get(c.id) ?? ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN'];
            const balances = new Map((c.balances ?? []).map((b) => [b.currency, Number(b.amount)]));
            return (
              <div className="list-item" key={c.id}>
                <div className="list-title">{bank?.name ?? c.bankId} · {c.name}</div>
                <div className="list-meta">Base: {bank?.baseCurrency ?? '—'}</div>

                <div className="table">
                  {currencies.map((cur) => (
                    <div className="row" key={cur}>
                      <div className="cell"><b>{cur}</b></div>
                      <div className="cell">{Number(balances.get(cur) ?? 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Payments</h2>
        {byCreditCurrency.length === 0 ? <div className="muted">No payments yet.</div> : null}

        <div className="columns">
          {byCreditCurrency.map(([currency, list]) => (
            <div className="column" key={currency}>
              <div className="column-title">{currency}</div>
              {list.map((p) => (
                <div className="payment" key={p.id}>
                  <div className="payment-top">
                    <div className={`state state-${p.state.toLowerCase()}`}>{p.state}</div>
                    <div className="muted">{new Date(p.createdAtMs).toLocaleTimeString()}</div>
                  </div>
                  <div className="payment-body">
                    <div className="muted">{p.fromClientName} ({p.fromBankName}) → {p.toClientName} ({p.toBankName})</div>
                    <div><b>{p.creditAmount.toFixed(2)} {p.creditCurrency}</b></div>
                    <div className="muted">Debit: {p.debitAmount.toFixed(2)} {p.debitCurrency}</div>
                    <div className="muted">Settlement: {p.settlementCurrency}</div>
                    <div className="muted">Route: {p.route?.length ? p.route.map((id) => {
                      const name = bankNameById.get(id) ?? id;
                      return p.fxAtBankIds?.includes(id) ? `${name} (FX)` : name;
                    }).join(' → ') : '—'}</div>
                    {p.failReason ? <div className="error">{p.failReason}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
