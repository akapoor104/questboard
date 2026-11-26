// Chooses where the data lives: the family's Supabase project when both settings
// are present, otherwise demo mode in this browser.
//
// Browser only (it reads import.meta.env and window.localStorage): do not import this
// file from tests/unit. connectionMode() is covered through the browser tests.
import type { Connection } from '../api/connection.ts';
import { createDemoConnection } from '../api/demo.ts';
import { createSupabaseConnection } from '../api/supabaseBackend.ts';
import base from '../../seed/base.json';
import plan from '../../seed/starter-plan.json';

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

let current: Connection | null = null;

/** The one connection for this page. Safe to call from anywhere, any number of times. */
export function getConnection(): Connection {
  if (current) return current;
  const env: AppEnv = import.meta.env;
  current = connectionMode(env) === 'demo'
    ? createDemoConnection(window.localStorage, { base, plan })
    : createSupabaseConnection((env.VITE_SUPABASE_URL ?? '').trim(), (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim());
  return current;
}

/** Demo mode only: forget everything and start the demo family again. Reloads the page. */
export function resetDemo(): void {
  const conn = getConnection();
  if (conn.mode !== 'demo') return;
  (conn as Connection & { reset(): void }).reset();
  window.location.assign('/');
}
