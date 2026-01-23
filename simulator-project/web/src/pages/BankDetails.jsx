import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api.js';

export default function BankDetails() {
  const [banks, setBanks] = useState([]);
  const [nostros, setNostros] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [error, setError] = useState('');
  const [clientName, setClientName] = useState('');
  const [correspondentBankId, setCorrespondentBankId] = useState('');

  async function refresh() {
    const [b, n, c] = await Promise.all([
      apiGet('/api/banks'),
      apiGet('/api/nostros'),
      apiGet('/api/clients')
    ]);
    setBanks(b);
    setNostros(n);
    setClients(c);
    if (!selectedBankId && b[0]) setSelectedBankId(b[0].id);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
  }, []);

  const bank = useMemo(() => banks.find((b) => b.id === selectedBankId) ?? null, [banks, selectedBankId]);

  const bankClients = useMemo(() => clients.filter((c) => c.bankId === selectedBankId), [clients, selectedBankId]);

  const bankNostros = useMemo(() => nostros.filter((n) => n.ownerBankId === selectedBankId), [nostros, selectedBankId]);

  const bankTotals = useMemo(() => {
    const totals = new Map();
    for (const c of bankClients) {
      if (!c.balances) continue;
      for (const b of c.balances) {
        totals.set(b.currency, (totals.get(b.currency) ?? 0) + b.amount);
      }
    }
    return Array.from(totals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [bankClients]);

  async function onCreateClient(e) {
    e.preventDefault();
    setError('');
    try {
      await apiPost(`/api/banks/${selectedBankId}/clients`, { name: clientName });
      setClientName('');
      await refresh();
    } catch (err) {
      setError(String(err.message ?? err));
    }
  }

  async function onCreateNostro(e) {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/correspondents/nostro', { ownerBankId: selectedBankId, correspondentBankId });
      setCorrespondentBankId('');
      await refresh();
    } catch (err) {
      setError(String(err.message ?? err));
    }
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Fila superior con 3 cajas horizontales */}
      <div style={{ display: 'grid', gridTemplateColumns: '20% 30% 50%', gap: '16px' }}>
        {/* Selector de bancos - 20% */}
        <section className="card">
          <h2>Bank selector</h2>

          <label>
            Selected bank
            <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}>
              <option value="" disabled>Select…</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.baseCurrency})</option>
              ))}
            </select>
          </label>

          {bank ? (
            <div className="muted" style={{ marginTop: '8px' }}>Base currency: <b>{bank.baseCurrency}</b></div>
          ) : null}
        </section>

        {/* Totales de balances de clientes - 30% */}
        <section className="card">
          <h2>Totals (client balances)</h2>
          {bankTotals.length === 0 ? <div className="muted">No balances yet.</div> : null}
          {bankTotals.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {bankTotals.map(([currency, amount]) => (
                <div key={currency} className="badge" style={{ padding: '8px 12px', fontSize: '16px' }}>
                  <span style={{ fontWeight: '700' }}>{currency}</span>
                  {' '}
                  <span style={{ fontWeight: '650' }}>{Number(amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Nostro accounts - 50% */}
        <section className="card">
          <h2>Nostro accounts</h2>
          {bankNostros.length === 0 ? <div className="muted">No Nostro accounts yet.</div> : null}
          {bankNostros.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {bankNostros.map((n) => (
                <div key={n.id} className="badge" style={{ padding: '8px 12px', fontSize: '16px' }}>
                  <span style={{ fontWeight: '700' }}>{n.currency}</span>
                  {' '}
                  <span style={{ fontWeight: '650' }}>{Number(n.balance).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {' '}
                  <span className="muted" style={{ fontSize: '16px' }}>({banks.find((b) => b.id === n.correspondentBankId)?.name ?? n.correspondentBankId})</span>
                </div>
              ))}
            </div>
          )}

          <h3>Create Nostro (and mirror Vostro)</h3>
          <form className="form" onSubmit={onCreateNostro}>
            <label>
              Correspondent bank
              <select value={correspondentBankId} onChange={(e) => setCorrespondentBankId(e.target.value)}>
                <option value="">Select…</option>
                {banks
                  .filter((b) => b.id !== selectedBankId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.baseCurrency})</option>
                  ))}
              </select>
            </label>
            <button className="btn" type="submit" disabled={!selectedBankId || !correspondentBankId}>Create</button>
          </form>
        </section>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {/* Lista de clientes abajo */}
      <section className="card">
        <h2>Clients</h2>

        <div className="list">
          {bankClients.length === 0 ? <div className="muted">No clients yet.</div> : null}
          {bankClients.map((c) => (
            <div className="list-item bank-item" key={c.id}>
              <div className="list-title">
                {c.name}
                <span className={c.type === 'VOSTRO' ? 'badge badge-vostro' : 'badge'}>
                  {c.type}
                </span>
                {c.type === 'VOSTRO' ? (
                  <span className="muted"> · Vostro for: {banks.find((b) => b.id === c.vostroForBankId)?.name ?? c.vostroForBankId}</span>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {c.balances?.length ? (
                  c.balances.map((b) => (
                    <div key={b.currency} className="badge" style={{ padding: '8px 12px', fontSize: '18px' }}>
                      <span style={{ fontWeight: '700' }}>{b.currency}</span>
                      {' '}
                      <span style={{ fontWeight: '650' }}>{Number(b.amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))
                ) : (
                  <span className="muted">No balances</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <h3>Create regular client</h3>
        <form className="form" onSubmit={onCreateClient}>
          <label>
            Name
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={!selectedBankId || !clientName.trim()}>Create</button>
        </form>
      </section>
    </div>
  );
}
