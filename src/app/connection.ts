// Chooses where the data lives: the family's Supabase project when both settings
// are present, otherwise demo mode in this browser.
//
// Each backend is loaded only when its mode is chosen (a dynamic import): a browser in
// demo mode never downloads the Supabase client, and the family's real app never
// downloads the demo backend and its seed data (T12: this kept the app under 700 kB).
//
// Browser only (it reads import.meta.env and window.localStorage): do not import this
// file from tests/unit. connectionMode() is covered through the browser tests.
import { lazyConnection, type Connection } from '../api/connection.ts';

export interface AppEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_FORCE_DEMO?: string;
}

/** 'demo' unless both Supabase settings are filled in and demo mode is not forced. */
export function connectionMode(env: AppEnv): 'demo' | 'supabase' {
  const url = (env.VITE_SUPABASE_URL ?? '').trim();
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  return env.VITE_FORCE_DEMO === '1' || url === '' || key === '' ? 'demo' : 'supabase';
}

let current: ReturnType<typeof lazyConnection> | null = null;

function connection(): ReturnType<typeof lazyConnection> {
  if (current) return current;
  const env: AppEnv = import.meta.env;
  current = connectionMode(env) === 'demo'
    ? lazyConnection('demo', async () => {
      const [{ createDemoConnection }, base, plan] = await Promise.all([
        import('../api/demo.ts'),
        import('../../seed/base.json'),
        import('../../seed/starter-plan.json'),
      ]);
      return createDemoConnection(window.localStorage, { base: base.default, plan: plan.default });
    })
    : lazyConnection('supabase', async () => {
      const { createSupabaseConnection } = await import('../api/supabaseBackend.ts');
      return createSupabaseConnection((env.VITE_SUPABASE_URL ?? '').trim(), (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim());
    });
  return current;
}

/** The one connection for this page. Safe to call from anywhere, any number of times. */
export function getConnection(): Connection {
  return connection();
}

/** Demo mode only: forget everything and start the demo family again. Reloads the page. */
export async function resetDemo(): Promise<void> {
  const conn = connection();
  if (conn.mode !== 'demo') return;
  ((await conn.ready()) as Connection & { reset(): void }).reset();
  window.location.assign('/');
}
