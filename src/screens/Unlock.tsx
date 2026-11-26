import { Link as RouterLink } from 'react-router-dom';
import { useSession } from '../app/session.tsx';

/** The PIN pad (placeholder until T03). */
export function Unlock() {
  const { conn, me } = useSession();
  const name = me?.children[0]?.name ?? '';
  return (
    <main className="page page-narrow">
      {conn.mode === 'demo' && <div><span className="demo-badge" data-testid="demo-badge">Demo</span></div>}
      <h1>Hi, {name}</h1>
      <p className="muted">Enter your PIN to open your board.</p>
      <p><RouterLink to="/parent">Parent sign-in</RouterLink></p>
    </main>
  );
}
