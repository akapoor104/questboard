import { useCallback, useEffect, useRef, useState } from 'react';
import { isLocked } from './errors.ts';
import { useSession } from './session.tsx';

export interface Loaded<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Loads data when the screen opens and whenever `deps` change; again when the window is
 * focused or becomes visible, and once a minute. Keeps the last good data while reloading.
 */
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]): Loaded<T> {
  const { refreshMe } = useSession();
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>(
    { data: null, error: null, loading: true });
  const latest = useRef(loader);
  latest.current = loader;
  const ticket = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++ticket.current;
    try {
      const data = await latest.current();
      if (mine === ticket.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (isLocked(error)) void refreshMe().catch(() => undefined);     // back to the PIN pad
      if (mine === ticket.current) setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, [refreshMe]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const again = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('focus', again);
    const timer = window.setInterval(again, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('focus', again);
      window.clearInterval(timer);
    };
  }, [reload]);

  return { ...state, reload };
}

/**
 * Runs one change, then reloads. `busy` disables buttons; `error` is what went wrong.
 * `run` resolves to the call's result, or undefined when it failed.
 */
export function useAction(reload: () => Promise<void>) {
  const { refreshMe } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(async <R>(change: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      const result = await change();
      await reload();
      return result;
    } catch (e) {
      setError(e);
      if (isLocked(e)) void refreshMe().catch(() => undefined);
      else await reload();
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [reload, refreshMe]);
  return { run, busy, error, clearError: () => setError(null) };
}
