import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/session.tsx';
import { Icon } from './Icon.tsx';
import { useToast } from './Toast.tsx';
import './TopBar.css';

/** His top bar (a layout piece, so it reads the session itself). */
export function TopBar() {
  const { conn, api, refreshMe } = useSession();
  const { showError } = useToast();
  const [busy, setBusy] = useState(false);

  const lock = async () => {
    setBusy(true);
    try {
      await api.kidLock();
      await refreshMe();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Icon name="d20" size={24} />
        <span>Questboard</span>
      </div>
      <nav aria-label="Main" className="topbar-nav">
        <NavLink to="/" end className="topbar-link">Today</NavLink>
        <NavLink to="/week" className="topbar-link">Week</NavLink>
        <NavLink to="/month" className="topbar-link">Month</NavLink>
      </nav>
      <div className="topbar-end">
        {conn.mode === 'demo' && <span className="demo-badge" data-testid="demo-badge">Demo</span>}
        <button type="button" className="topbar-lock" aria-label="Lock my board" disabled={busy} onClick={() => void lock()}>
          <Icon name="lock" />
        </button>
      </div>
    </header>
  );
}
