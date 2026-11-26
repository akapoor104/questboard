// In-memory Questboard backend: shared state, helpers and the function registry.
//
// This is a line-by-line port of the SQL in db/migrations. The same contract
// tests (tests/contract) run against this code and against PostgreSQL, so the
// two stay in step. It powers demo mode and every automated test.
//
// It is NOT a security boundary: in demo mode all data lives in one browser.
import { dateInZone } from '../../lib/dates.ts';

export interface Claims {
  sub: string;
  email?: string;
  is_anonymous?: boolean;
  app_metadata?: { provider?: string };
  user_metadata?: { full_name?: string; name?: string };
}

export class QbError extends Error {
  code: string;
  constructor(code: string) {
    super('QB:' + code);
    this.code = code;
    this.name = 'QbError';
  }
}

export function fail(code: string): never {
  throw new QbError(code);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;

export interface State {
  config: Row;
  parents: Row[];
  children: Row[];
  devices: Row[];
  categories: Row[];
  library_items: Row[];
  goals: Row[];
  cards: Row[];
  day_marks: Row[];
  closeouts: Row[];
  words: Row[];
  encouragements: Row[];
  word_uses: Row[];
  parent_notes: Row[];
  reviews: Row[];
  seq: { cards: number; goals: number };
}

export function defaultConfig(nowIso: string): Row {
  return {
    family_name: 'Our family',
    timezone: 'America/Los_Angeles',
    day_start_min: 420,
    day_end_min: 1260,
    parent_emails: [],
    unlock_minutes: 720,
    catchup_alert_threshold: 5,
    structured_weekly_max_min: 540,
    automation_token_hash: null,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export function emptyState(nowIso: string): State {
  return {
    config: defaultConfig(nowIso),
    parents: [], children: [], devices: [], categories: [], library_items: [], goals: [], cards: [],
    day_marks: [], closeouts: [], words: [], encouragements: [], word_uses: [], parent_notes: [], reviews: [],
    seq: { cards: 0, goals: 0 },
  };
}

// ---- small helpers ----------------------------------------------------------

export const iso = (ms: number): string => new Date(ms).toISOString();
export const ms = (isoString: string | null | undefined): number =>
  isoString == null ? NaN : Date.parse(isoString);

export function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export function randomHex(): string {
  return (uuid() + uuid()).replace(/-/g, '');
}

/** Not cryptographic. Good enough for a demo PIN that never leaves this browser. */
export function weakHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export const pinHash = (salt: string, pin: string): string => weakHash(salt + ':' + pin);

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function isObject(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mirrors a SQL cast of JSON text to an integer: null/undefined -> undefined (keep the old value),
 * anything that is not a whole number -> 'bad_input'.
 */
export function intOrKeep(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : 'x';
  if (!/^[+-]?\d+$/.test(s)) fail('bad_input');
  return Number(s);
}

/** Plain code-unit comparison (PostgreSQL "C" collation for ASCII text). */
export function cmp(a: any, b: any): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Compare by several keys; each key is [value getter, nullsLast?]. */
export function by<T>(...keys: Array<(r: T) => any>): (a: T, b: T) => number {
  return (a, b) => {
    for (const k of keys) {
      const x = k(a);
      const y = k(b);
      if (x == null && y == null) continue;
      if (x == null) return 1;            // nulls last
      if (y == null) return -1;
      const c = cmp(x, y);
      if (c !== 0) return c;
    }
    return 0;
  };
}

// ---- call context -----------------------------------------------------------

export interface Ctx {
  db: MemoryDb;
  s: State;
  claims: Claims | null;
  uid: string | null;
  now: number;            // ms
  nowIso: string;
  today: string;          // date in the family's time zone
}

export type Fn = (c: Ctx, args: Row) => unknown;

export class MemoryDb {
  state: State;
  private clock: () => number;
  private fns = new Map<string, { fn: Fn; params: string[] }>();
  /** Called after every successful call that may have changed state (used to persist demo data). */
  onChange: (() => void) | null = null;

  constructor(opts: { now?: () => number; state?: State } = {}) {
    this.clock = opts.now ?? (() => Date.now());
    this.state = opts.state ?? emptyState(iso(this.clock()));
  }

  setClock(now: () => number): void {
    this.clock = now;
  }

  register(name: string, params: string[], fn: Fn): void {
    this.fns.set(name, { fn, params });
  }

  has(name: string): boolean {
    return this.fns.has(name);
  }

  ctx(claims: Claims | null): Ctx {
    const now = this.clock();
    return {
      db: this, s: this.state, claims, uid: claims?.sub ? claims.sub : null, now, nowIso: iso(now),
      today: dateInZone(now, this.state.config.timezone),
    };
  }

  /** Runs one API function as the given caller. Atomic: state is restored if the function throws. */
  call(claims: Claims | null, name: string, args: Row = {}): unknown {
    const entry = this.fns.get(name);
    if (!entry) fail('no_such_function');
    for (const k of Object.keys(args)) if (!entry.params.includes(k)) fail('unknown_argument');
    const snapshot = structuredClone(this.state);
    try {
      const out = entry.fn(this.ctx(claims), args);
      const result = out === undefined ? null : structuredClone(out);
      this.onChange?.();
      return result;
    } catch (e) {
      this.state = snapshot;
      throw e;
    }
  }
}

// ---- identity helpers (mirror qb.* in 002_core.sql) ----------------------------

export function isParent(c: Ctx): boolean {
  return c.uid !== null && c.s.parents.some((p) => p.user_id === c.uid);
}

export function requireParent(c: Ctx): void {
  if (c.uid === null) fail('not_signed_in');
  if (!isParent(c)) fail('not_parent');
}

export function canClaim(c: Ctx): boolean {
  const cl = c.claims;
  if (!cl) return false;
  const email = cl.email ?? '';
  return (cl.is_anonymous ?? false) === false
    && (cl.app_metadata?.provider ?? '') === 'google'
    && email !== ''
    && c.s.config.parent_emails.includes(email.toLowerCase());
}

export function isUnlocked(c: Ctx, d: Row): boolean {
  return d.unlocked_until != null && ms(d.unlocked_until) > c.now;
}

export function viewer(c: Ctx): { role: 'parent' | 'kid' | 'display' | 'none'; child_id: string | null } {
  if (c.uid === null) return { role: 'none', child_id: null };
  if (isParent(c)) return { role: 'parent', child_id: null };
  const d = c.s.devices.find((x) => x.user_id === c.uid && x.status === 'approved');
  if (!d) return { role: 'none', child_id: null };
  if (d.kind === 'display') return { role: 'display', child_id: d.child_id };
  if (isUnlocked(c, d)) return { role: 'kid', child_id: d.child_id };
  return { role: 'none', child_id: null };
}

/** Access check for one child. Returns the caller's role or throws. */
export function access(c: Ctx, childId: unknown, write = false): 'parent' | 'kid' | 'display' {
  if (c.uid === null) fail('not_signed_in');
  if (childId == null || !c.s.children.some((x) => x.id === childId)) fail('not_found');
  if (isParent(c)) return 'parent';
  const d = c.s.devices.find((x) => x.user_id === c.uid && x.status === 'approved' && x.child_id === childId);
  if (!d) fail('not_allowed');
  if (d.kind === 'display') {
    if (write) fail('not_allowed');
    return 'display';
  }
  if (!isUnlocked(c, d)) fail('locked');
  return 'kid';
}

export function childJson(ch: Row, withPin = false): Row {
  const out: Row = { id: ch.id, name: ch.name, avatar: ch.avatar, theme: ch.theme };
  if (withPin) out.pin_set = ch.pin_hash != null;
  return out;
}

export function deviceJson(c: Ctx, d: Row): Row {
  return {
    user_id: d.user_id, label: d.label, kind: d.kind, status: d.status, child_id: d.child_id,
    approved_at: d.approved_at, created_at: d.created_at, unlocked: isUnlocked(c, d),
  };
}

export function cleanLabel(v: unknown): string | null {
  const t = (typeof v === 'string' ? v : '').trim().slice(0, 40);
  return t === '' ? null : t;
}
