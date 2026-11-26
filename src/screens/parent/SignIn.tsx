import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session.tsx';
import { errorText } from '../../app/errors.ts';
import { usePageTitle } from '../../components/usePageTitle.ts';

/** Parent sign-in: Google for real, one button in demo mode. */
export function SignIn() {
  usePageTitle('Parent sign-in');
  const { conn, refreshParent } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await conn.signInParent('/parent');
      await refreshParent();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page page-narrow">
      {conn.mode === 'demo' && <div><span className="demo-badge" data-testid="demo-badge">Demo</span></div>}
      <h1>Parents</h1>
      <div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void signIn()}>
          {conn.mode === 'demo' ? 'Enter as demo parent' : 'Sign in with Google'}
        </button>
      </div>
      {error !== null && <p role="alert">{errorText(error)}</p>}
      <p><Link to="/">Back to the board</Link></p>
    </main>
  );
}
