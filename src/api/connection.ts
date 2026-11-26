// What the app needs from "the place the data lives", in demo mode or for real.
//
// One browser can hold two identities at the same time:
//   device - an anonymous session that a parent links to a child (his board, or a display)
//   parent - a Google sign-in on the family's allowlist
// They never share a session, so a parent can sign in on his laptop without unlinking it.
import type { Backend } from './client.ts';
import { ApiError } from './types.ts';

export interface AuthSession {
  userId: string;
  email: string | null;
}

export interface Connection {
  mode: 'demo' | 'supabase';
  /** Calls made as this device (kid or display). Call ensureDeviceSession() first. */
  device: Backend;
  /** Calls made as the signed-in parent. Only valid while parentSession() is not null. */
  parent: Backend;
  /** Creates the anonymous device session if this browser does not have one yet. */
  ensureDeviceSession(): Promise<void>;
  parentSession(): Promise<AuthSession | null>;
  /** Demo: signs in at once. Supabase: redirects to Google and comes back to `returnPath`. */
  signInParent(returnPath?: string): Promise<void>;
  signOutParent(): Promise<void>;
}

/**
 * A Connection whose real one is loaded and created on first use (T12: each backend is
 * a separate download, so a browser only fetches the one its mode needs). Every method
 * of a Connection is async already, so callers cannot tell the difference. A failed
 * download rejects with ApiError('network') and is tried again on the next call.
 */
export function lazyConnection(mode: Connection['mode'], load: () => Promise<Connection>): Connection & { ready(): Promise<Connection> } {
  let pending: Promise<Connection> | null = null;
  const ready = (): Promise<Connection> => {
    pending ??= load().catch((e: unknown) => {
      pending = null;
      throw new ApiError('network', String((e as Error)?.message ?? e));
    });
    return pending;
  };
  const backend = (which: 'device' | 'parent'): Backend => ({
    async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
      return (await ready())[which].rpc<T>(fn, args);
    },
  });
  return {
    mode,
    device: backend('device'),
    parent: backend('parent'),
    ready,
    async ensureDeviceSession() { return (await ready()).ensureDeviceSession(); },
    async parentSession() { return (await ready()).parentSession(); },
    async signInParent(returnPath?: string) { return (await ready()).signInParent(returnPath); },
    async signOutParent() { return (await ready()).signOutParent(); },
  };
}
