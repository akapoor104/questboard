// The in-memory backend: demo mode in the browser, and the default backend for tests.
// The logic lives in src/api/memory/*.ts, one file per SQL migration.
import type { Backend } from './client.ts';
import { type Claims, MemoryDb, type State } from './memory/core.ts';
import { registerSession } from './memory/session.ts';
import { registerBoard } from './memory/board.ts';
import { registerInsights } from './memory/insights.ts';

export { MemoryDb, QbError } from './memory/core.ts';
export type { Claims, State } from './memory/core.ts';
export { testReset } from './memory/backup.ts';
export { adminSetup, loadStarterPlan } from './memory/insights.ts';

export function createMemoryDb(opts: { now?: () => number; state?: State } = {}): MemoryDb {
  const db = new MemoryDb(opts);
  registerSession(db);
  registerBoard(db);
  registerInsights(db);
  return db;
}

/** One signed-in identity talking to a MemoryDb. `claims` may change (sign-in, sign-out). */
export class MemoryBackend implements Backend {
  db: MemoryDb;
  claims: Claims | null;

  constructor(db: MemoryDb, claims: Claims | null = null) {
    this.db = db;
    this.claims = claims;
  }

  async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.db.call(this.claims, fn, args) as T;
  }
}
