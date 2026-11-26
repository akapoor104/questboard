// What the app needs from "the place the data lives", in demo mode or for real.
//
// One browser can hold two identities at the same time:
//   device - an anonymous session that a parent links to a child (his board, or a display)
//   parent - a Google sign-in on the family's allowlist
// They never share a session, so a parent can sign in on his laptop without unlinking it.
import type { Backend } from './client.ts';

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
