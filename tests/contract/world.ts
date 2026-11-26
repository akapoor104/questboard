// Runs the same calls against either backend:
//   memory   - src/api/memoryBackend.ts (default; no setup needed)
//   postgres - the real SQL in db/migrations, through psql (see docs/06-testing.md)
// Choose with QB_BACKEND=memory | postgres | both.
import { spawnSync } from 'node:child_process';
import { createMemoryDb, loadStarterPlan, testReset, type Claims, type MemoryDb } from '../../src/api/memoryBackend.ts';

export type { Claims };
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface World {
  name: string;
  reset(fixture: object): void;
  setNow(iso: string): void;
  call(claims: Claims | null, fn: string, args?: Record<string, unknown>): any;
  /** Loads a starter plan the way the seed script does (not part of the app API). */
  starterPlan(childId: string, plan: object): any;
}

class MemoryWorld implements World {
  name = 'memory';
  private now = Date.parse('2026-12-21T17:00:00Z');
  private db: MemoryDb = createMemoryDb({ now: () => this.now });
  reset(fixture: object): void {
    this.db = createMemoryDb({ now: () => this.now });
    testReset(this.db, fixture as Record<string, unknown>);
  }
  setNow(iso: string): void {
    this.now = Date.parse(iso);
  }
  call(claims: Claims | null, fn: string, args: Record<string, unknown> = {}): any {
    return this.db.call(claims, fn, JSON.parse(JSON.stringify(args)));
  }
  starterPlan(childId: string, plan: object): any {
    return loadStarterPlan(this.db, childId, JSON.parse(JSON.stringify(plan)));
  }
}

const q = (s: string) => "'" + s.replace(/'/g, "''") + "'";

class PostgresWorld implements World {
  name = 'postgres';
  private now = '2026-12-21T17:00:00Z';
  private url = process.env.QB_PG_URL ?? 'postgresql://postgres@127.0.0.1:5432/qb_test';
  private psql = process.env.QB_PSQL ?? 'psql';

  private run(sql: string): string {
    const r = spawnSync(this.psql, ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', this.url],
      { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw r.error;
    if (r.status !== 0) {
      const m = /QB:([a-z_]+)/.exec(r.stderr);
      throw new Error(m ? 'QB:' + m[1] : 'pg: ' + r.stderr.trim());
    }
    return r.stdout;
  }
  reset(fixture: object): void {
    this.run(`set app.test_now = ${q(this.now)}; select test_reset(${q(JSON.stringify(fixture))}::jsonb);`);
  }
  setNow(iso: string): void {
    this.now = iso;
  }
  call(claims: Claims | null, fn: string, args: Record<string, unknown> = {}): any {
    const out = this.run([
      `set app.test_now = ${q(this.now)};`,
      `set request.jwt.claims = ${q(claims ? JSON.stringify(claims) : '')};`,
      `set role ${claims ? 'authenticated' : 'anon'};`,
      `select test_rpc(${q(fn)}, ${q(JSON.stringify(args))}::jsonb);`,
    ].join('\n'));
    const line = out.trim().split('\n').pop() ?? '';
    return line === '' ? null : JSON.parse(line);
  }
  starterPlan(childId: string, plan: object): any {
    const out = this.run(`set app.test_now = ${q(this.now)}; select qb.load_starter_plan(${q(childId)}::uuid, ${q(JSON.stringify(plan))}::jsonb);`);
    return JSON.parse(out.trim().split('\n').pop() ?? 'null');
  }
}

export function worlds(): World[] {
  const which = process.env.QB_BACKEND ?? 'memory';
  const out: World[] = [];
  if (which === 'memory' || which === 'both') out.push(new MemoryWorld());
  if (which === 'postgres' || which === 'both') out.push(new PostgresWorld());
  if (out.length === 0) throw new Error('QB_BACKEND must be memory, postgres or both');
  return out;
}

// ---- callers ------------------------------------------------------------------

export const MOM: Claims = {
  sub: '00000000-0000-4000-8000-0000000000a1', email: 'Mom@Example.com',
  app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Mom K' },
};
export const DAD: Claims = {
  sub: '00000000-0000-4000-8000-0000000000a2', email: 'dad@example.com',
  app_metadata: { provider: 'google' }, user_metadata: { name: 'Dad K' },
};
export const STRANGER: Claims = {
  sub: '00000000-0000-4000-8000-0000000000a3', email: 'stranger@example.com', app_metadata: { provider: 'google' },
};
/** Right e-mail, wrong sign-in method: must not become a parent. */
export const EMAIL_LOGIN: Claims = {
  sub: '00000000-0000-4000-8000-0000000000a4', email: 'mom@example.com', app_metadata: { provider: 'email' },
};
export const LAPTOP: Claims = { sub: '00000000-0000-4000-8000-0000000000d1', is_anonymous: true };
export const TABLET: Claims = { sub: '00000000-0000-4000-8000-0000000000d2', is_anonymous: true };
export const KITCHEN: Claims = { sub: '00000000-0000-4000-8000-0000000000d3', is_anonymous: true };

export const KID = '00000000-0000-4000-8000-00000000c001';
export const PIN = '2468';

export function failsWith(fn: () => unknown, code: string): void {
  let err: unknown = null;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  if (err === null) throw new Error(`expected QB:${code}, but the call succeeded`);
  const msg = String((err as Error).message);
  if (!msg.includes('QB:' + code)) throw new Error(`expected QB:${code}, got: ${msg}`);
}

/** True when two ISO timestamps are the same instant (formats differ between backends). */
export const sameInstant = (a: string, b: string): boolean => Date.parse(a) === Date.parse(b);
