import { useEffect, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/session.tsx';
import { Icon } from './Icon.tsx';
import './ParentFrame.css';

/** The parent side: one centered column and the tab bar at the bottom (a layout piece). */
export function ParentFrame({ children }: { children: ReactNode }) {
  const { conn } = useSession();
  // Parent screens are always light, whatever his board uses.
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
  }, []);
  return (
    <div className="parentframe">
      {conn.mode === 'demo' && (
        <div className="parentframe-top">
          <span className="demo-badge" data-testid="demo-badge">Demo</span>
        </div>
      )}
      <main className="parentframe-main">{children}</main>
      <nav aria-label="Parent" className="parentframe-nav">
        <NavLink to="/parent" end className="parentframe-link"><Icon name="chart" />This week</NavLink>
        <NavLink to="/parent/plan" className="parentframe-link"><Icon name="pin" />Must-dos</NavLink>
        <NavLink to="/parent/settings" className="parentframe-link"><Icon name="gear" />Settings</NavLink>
      </nav>
    </div>
  );
}
