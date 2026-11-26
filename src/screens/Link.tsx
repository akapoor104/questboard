import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { WhoAmI } from '../api/types.ts';
import { useSession } from '../app/session.tsx';
import { useToast } from '../components/Toast.tsx';
import { formatPairCode } from '../lib/pin.ts';
import './Link.css';

const POLL_MS = 4000;

/** True when this device has no code it can show: never asked, removed, or the code ran out. */
function needsCode(me: WhoAmI | null): boolean {
  if (me === null) return false;
  const d = me.device;
  if (d === null || d.status === 'revoked') return true;
  if (d.status !== 'pending') return false;
  if (!d.pair_code || !d.pair_expires_at) return true;
  return Date.parse(d.pair_expires_at) <= Date.parse(me.now);
}

/**
 * Shows a pairing code and waits for a parent to type it in Settings. Once the device is
 * approved, DeviceGate shows the PIN pad by itself.
 */
export function Link() {
  const { conn, api, me, refreshMe } = useSession();
  const { showError } = useToast();
  const [wasRevoked] = useState(() => me?.device?.status === 'revoked');
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);
  const working = useRef(false);

  const newCode = useCallback(async () => {
    working.current = true;
    setBusy(true);
    try {
      await api.deviceStartPairing();
      await refreshMe();
    } catch (e) {
      showError(e);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, [api, refreshMe, showError]);

  // First visit: ask for a code once (the ref survives React's development double-mount).
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (needsCode(me)) void newCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every few seconds: has a parent typed the code in? Has it run out?
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (working.current) return;
      working.current = true;
      void (async () => {
        try {
          const next = await refreshMe();
          working.current = false;
          if (needsCode(next)) await newCode();
        } catch (e) {
          showError(e);
        } finally {
          working.current = false;
        }
      })();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshMe, newCode, showError]);

  const code = me?.device?.status === 'pending' && !needsCode(me) ? me.device.pair_code : null;
  return (
    <main className="page page-narrow link">
      {conn.mode === 'demo' && <div><span className="demo-badge" data-testid="demo-badge">Demo</span></div>}
      <h1 className="link-title">Link this device</h1>
      {wasRevoked && (
        <p className="link-removed">This device was removed. A parent can link it again.</p>
      )}
      <p>Ask a parent to open Questboard on their phone, go to Settings, and type this code:</p>
      <p className="link-code" data-testid="pair-code" aria-live="polite">
        {code ? formatPairCode(code) : '...'}
      </p>
      <p className="link-note">This code works for 15 minutes.</p>
      <div className="page-actions">
        <button type="button" className="btn" disabled={busy} onClick={() => void newCode()}>New code</button>
        <RouterLink to="/parent" className="link-parent">Parent sign-in</RouterLink>
      </div>
    </main>
  );
}
