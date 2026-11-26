import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useChild, useSession } from '../app/session.tsx';
import { useTodayData } from '../app/TodayProvider.tsx';
import { CampfireChip } from './CampfireChip.tsx';
import { Icon } from './Icon.tsx';
import { ProfileSheet } from './ProfileSheet.tsx';
import { SkipLink } from './SkipLink.tsx';
import { useToast } from './Toast.tsx';
import './TopBar.css';

/** His top bar (a layout piece, so it reads the session itself). It also sets his theme. */
export function TopBar() {
  const { conn, api, refreshMe } = useSession();
  const child = useChild();
  const { showError } = useToast();
  const today = useTodayData();
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(false);
  const theme = child.theme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
    <>
    <SkipLink />
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
        {today.data && <CampfireChip current={today.data.streak.current} />}
        {conn.mode === 'demo' && <span className="demo-badge" data-testid="demo-badge">Demo</span>}
        <button type="button" className="topbar-profile" onClick={() => setProfile(true)}>
          <span className="topbar-avatar cat-violet"><Icon name={child.avatar} size={20} /></span>
          <span>{child.name}</span>
        </button>
        <button type="button" className="topbar-lock" aria-label="Lock my board" disabled={busy} onClick={() => void lock()}>
          <Icon name="lock" />
        </button>
      </div>
      {profile && (
        <ProfileSheet api={api} child={child} reload={async () => { await refreshMe(); }} onClose={() => setProfile(false)} />
      )}
    </header>
    </>
  );
}
