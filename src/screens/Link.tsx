import { Link as RouterLink } from 'react-router-dom';
import { useSession } from '../app/session.tsx';

/** Pairing code (placeholder until T03). */
export function Link() {
  const { conn } = useSession();
  return (
    <main className="page page-narrow">
      {conn.mode === 'demo' && <div><span className="demo-badge" data-testid="demo-badge">Demo</span></div>}
      <h1>Link this device</h1>
      <p><RouterLink to="/parent">Parent sign-in</RouterLink></p>
    </main>
  );
}
