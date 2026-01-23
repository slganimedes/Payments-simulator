import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { apiGet, apiPost } from '../api.js';

function formatCETDateTime(ms) {
  const dt = new Date(ms);
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Europe/Paris',
    timeZoneName: 'short'
  }).format(dt);
}

export default function RootLayout() {
  const [clock, setClock] = useState(null);
  const [error, setError] = useState('');

  async function refreshClock() {
    try {
      const data = await apiGet('/api/clock');
      setClock(data);
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }

  useEffect(() => {
    refreshClock();
    const t = setInterval(refreshClock, 1000);
    return () => clearInterval(t);
  }, []);

  async function handleClockAction(endpoint) {
    setError('');
    try {
      const data = await apiPost(endpoint, {});
      setClock(data);
    } catch (e) {
      setError(String(e.message ?? e));
      await refreshClock();
    }
  }

  async function onPauseOrPlay() {
    if (clock?.isPaused) {
      await handleClockAction('/api/admin/clock/play');
    } else {
      await handleClockAction('/api/admin/clock/pause');
    }
  }

  async function onSlower() {
    await handleClockAction('/api/admin/clock/slower');
  }

  async function onFaster() {
    await handleClockAction('/api/admin/clock/faster');
  }

  async function onResetAll() {
    setError('');
    try {
      await apiPost('/api/admin/reset', {});
      await refreshClock();
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }

  async function onResetClock() {
    setError('');
    try {
      await apiPost('/api/admin/reset-clock', {});
      await refreshClock();
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }

  function onResetPositions() {
    localStorage.removeItem('bankNetworkPositions');
    localStorage.removeItem('bankNetworkZonePositions');
    window.location.reload();
  }

  const isPaused = clock?.isPaused ?? false;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Payment-simulator</div>

        <div className="card sidebar-clock">
          <div className="clock">
            <div>
              <div className="clock-label">Sim time</div>
              <div className="clock-value">{clock ? formatCETDateTime(clock.simTimeMs) : '—'}</div>
              <div className="clock-meta">x{clock ? clock.tick : '—'}</div>
            </div>
          </div>

          <div className="admin">
            <button className="btn" onClick={onPauseOrPlay}>
              {isPaused ? 'Play' : 'Pause'}
            </button>
            <button className="btn" onClick={onSlower} disabled={isPaused}>Slower</button>
            <button className="btn" onClick={onFaster} disabled={isPaused}>Faster</button>
          </div>
        </div>

        <nav className="nav">
          <NavLink className="nav-item" to="/dashboard">Dashboard</NavLink>
          <NavLink className="nav-item" to="/bank-details">Bank Details</NavLink>
          <NavLink className="nav-item" to="/payments">Payments</NavLink>
          <NavLink className="nav-item" to="/fx">FX</NavLink>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <button className="btn" onClick={onResetPositions} style={{ width: '100%' }}>Reset Positions</button>
            <button className="btn" onClick={onResetClock} style={{ width: '100%' }}>Reset Clock</button>
            <button className="btn btn-danger" onClick={onResetAll} style={{ width: '100%' }}>RESET ALL</button>
          </div>
        </div>
      </aside>

      <main className="main">
        {error ? <div className="error" style={{ margin: '16px' }}>{error}</div> : null}

        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
