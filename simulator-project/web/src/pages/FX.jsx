import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api.js';

export default function FX() {
  const [fx, setFx] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  async function refresh() {
    const [rates, hist] = await Promise.all([
      apiGet('/api/fx'),
      apiGet('/api/fx-history')
    ]);
    setFx(rates);
    setEvents(hist);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
  }, []);

  const sortedRates = useMemo(() => {
    return [...fx].sort((a, b) => a.quoteCurrency.localeCompare(b.quoteCurrency));
  }, [fx]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [events]);

  return (
    <div className="grid">
      <section className="card">
        <h2>FX rates (USD pivot)</h2>
        {error ? <div className="error">{error}</div> : null}

        <div className="table">
          {sortedRates.map((r) => (
            <div className="row" key={r.quoteCurrency}>
              <div className="cell"><b>USD/{r.quoteCurrency}</b></div>
              <div className="cell">{r.rate}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>FX execution history</h2>
        {sortedEvents.length === 0 ? <div className="muted">No FX executed yet.</div> : null}
        <div className="list">
          {sortedEvents.map((e) => (
            <div className="list-item" key={e.id}>
              <div className="list-title">{e.fromAmount.toFixed(2)} {e.fromCurrency}{' -> '}{e.toAmount.toFixed(2)} {e.toCurrency}</div>
              <div className="list-meta">Bank: {e.bankName}</div>
              <div className="list-meta">Rate: {e.rate}</div>
              <div className="list-meta">Time: {new Date(e.createdAtMs).toLocaleString()}</div>
              <div className="list-meta">Reason: {e.reason}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
