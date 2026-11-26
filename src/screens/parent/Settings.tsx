import { useState } from 'react';
import { useSession } from '../../app/session.tsx';
import { useToast } from '../../components/Toast.tsx';

/** Parent: Settings (placeholder until T11; Sign out already works). */
export function Settings() {
  const { conn, refreshParent } = useSession();
  const { showError } = useToast();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await conn.signOutParent();
      await refreshParent();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Settings</h1>
      <div>
        <button type="button" className="btn" disabled={busy} onClick={() => void signOut()}>Sign out</button>
      </div>
    </>
  );
}
