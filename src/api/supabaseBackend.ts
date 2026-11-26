// The real backend: Supabase. All data access goes through the SQL functions in
// db/migrations (called "RPC" by Supabase); this file adds nothing but sign-in.
//
// Two separate Supabase clients keep the two identities apart (see connection.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Backend } from './client.ts';
import type { AuthSession, Connection } from './connection.ts';
import { ApiError, toApiError } from './types.ts';

function rpcBackend(client: SupabaseClient): Backend {
  return {
    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      let res;
      try {
        res = await client.rpc(fn, args);
      } catch (e) {
        throw new ApiError('network', String((e as Error).message ?? e));
      }
      if (res.error) {
        // PostgREST reports failed fetches with an empty code and a "fetch" message.
        if (!res.error.code && /fetch|network/i.test(res.error.message)) throw new ApiError('network', res.error.message);
        throw toApiError(res.error);
      }
      return res.data as T;
    },
  };
}

export function createSupabaseConnection(url: string, publishableKey: string): Connection {
  const device = createClient(url, publishableKey, {
    auth: { storageKey: 'qb-device', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const parent = createClient(url, publishableKey, {
    auth: { storageKey: 'qb-parent', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return {
    mode: 'supabase',
    device: rpcBackend(device),
    parent: rpcBackend(parent),
    async ensureDeviceSession() {
      const { data } = await device.auth.getSession();
      if (data.session) return;
      const { error } = await device.auth.signInAnonymously();
      if (error) throw new ApiError('network', error.message);
    },
    async parentSession(): Promise<AuthSession | null> {
      const { data } = await parent.auth.getSession();
      const user = data.session?.user;
      return user ? { userId: user.id, email: user.email ?? null } : null;
    },
    async signInParent(returnPath = '/') {
      const { error } = await parent.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + returnPath },
      });
      if (error) throw new ApiError('network', error.message);
    },
    async signOutParent() {
      await parent.auth.signOut();
    },
  };
}
