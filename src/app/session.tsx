import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApi, type Api } from '../api/client.ts';
import type { Connection } from '../api/connection.ts';
import type { ChildSummary, WhoAmI } from '../api/types.ts';
import { getConnection } from './connection.ts';
import { errorText } from './errors.ts';
import { Link } from '../screens/Link.tsx';
import { Unlock } from '../screens/Unlock.tsx';
import { SignIn } from '../screens/parent/SignIn.tsx';

export interface Session {
  conn: Connection;
  /** Calls made as this device (his board, or a display). */
  api: Api;
  /** Calls made as the signed-in parent. */
  parentApi: Api;
  /** Who this device is; null until the first answer. */
  me: WhoAmI | null;
  /** Who the parent session is; null when signed out or not asked yet. */
  parentMe: WhoAmI | null;
  /** Creates the device session if needed, then asks the server who this device is. */
  refreshMe(): Promise<WhoAmI>;
  /** Asks the server who the parent session is, claiming the parent role when allowed. */
  refreshParent(): Promise<WhoAmI | null>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const conn = useMemo(() => getConnection(), []);
  const api = useMemo(() => createApi(conn.device), [conn]);
  const parentApi = useMemo(() => createApi(conn.parent), [conn]);
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [parentMe, setParentMe] = useState<WhoAmI | null>(null);

  const refreshMe = useCallback(async () => {
    await conn.ensureDeviceSession();
    const next = await api.whoami();
    setMe(next);
    return next;
  }, [conn, api]);

  const refreshParent = useCallback(async () => {
    if ((await conn.parentSession()) === null) {
      setParentMe(null);
      return null;
    }
    let next = await parentApi.whoami();
    if (next.role !== 'parent' && next.can_claim_parent) next = await parentApi.claimParent();
    setParentMe(next);
    return next;
  }, [conn, parentApi]);

  const value = useMemo<Session>(
    () => ({ conn, api, parentApi, me, parentMe, refreshMe, refreshParent }),
    [conn, api, parentApi, me, parentMe, refreshMe, refreshParent],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside <SessionProvider>');
  return s;
}

/** The child this device belongs to (his screens). Throws if used outside DeviceGate. */
export function useChild(): ChildSummary {
  const { me } = useSession();
  const child = me?.children[0];
  if (!child) throw new Error('useChild needs an unlocked device');
  return child;
}

/** The child a parent is looking at (parent screens). Throws if used outside ParentGate. */
export function useParentChild(): ChildSummary {
  const { parentMe } = useSession();
  const child = parentMe?.children[0];
  if (!child) throw new Error('useParentChild needs a signed-in parent');
  return child;
}

/** Runs `ask` once on mount (and again on "Try again"); reports loading and errors. */
function useAsk(ask: () => Promise<unknown>) {
  const [state, setState] = useState<{ done: boolean; error: unknown }>({ done: false, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ done: false, error: null });
    ask().then(
      () => { if (live) setState({ done: true, error: null }); },
      (error: unknown) => { if (live) setState({ done: true, error }); },
    );
    return () => { live = false; };
  }, [ask, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

function GateMessage({ children }: { children: ReactNode }) {
  return <main className="page page-narrow">{children}</main>;
}

function GateError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <GateMessage>
      <div className="panel page-actions">
        <p role="alert" className="page-error">{errorText(error)}</p>
        <button type="button" className="btn" onClick={retry}>Try again</button>
      </div>
    </GateMessage>
  );
}

/** His screens: link the device, unlock with the PIN, then the board. */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { me, refreshMe } = useSession();
  const { error, retry } = useAsk(refreshMe);

  if (me === null) {
    if (error) return <GateError error={error} retry={retry} />;
    return <GateMessage><p className="muted">Loading...</p></GateMessage>;
  }
  if (me.role === 'kid') return <>{children}</>;
  if (me.role === 'display') {
    return <GateMessage><div className="panel"><p>This screen is display only.</p></div></GateMessage>;
  }
  if (me.device?.status === 'approved') return <Unlock />;
  return <Link />;
}

/** Parent screens: sign in, then the parent side. Never creates a device session. */
export function ParentGate({ children }: { children: ReactNode }) {
  const { conn, parentMe, refreshParent } = useSession();
  const { done, error, retry } = useAsk(refreshParent);
  const [busy, setBusy] = useState(false);

  if (!done) return <GateMessage><p className="muted">Loading...</p></GateMessage>;
  if (error && parentMe === null) return <GateError error={error} retry={retry} />;
  if (parentMe === null) return <SignIn />;
  if (parentMe.role === 'parent') return <>{children}</>;

  const signOut = async () => {
    setBusy(true);
    try {
      await conn.signOutParent();
      await refreshParent();
    } finally {
      setBusy(false);
    }
  };
  return (
    <GateMessage>
      <div className="panel page-actions">
        <h1>Parents</h1>
        <p>This Google account is not on the parent list.</p>
        {parentMe.email && <p className="muted">{parentMe.email}</p>}
        <button type="button" className="btn" disabled={busy} onClick={() => void signOut()}>Sign out</button>
      </div>
    </GateMessage>
  );
}
