// Demo mode: the whole backend runs in this browser tab, with data kept in
// localStorage. No account, no network. It is for trying the app and for
// automated tests; it is not a secure or shared place for real data.
import type { Connection } from './connection.ts';
import {
  adminSetup, createMemoryDb, loadStarterPlan, MemoryBackend, type Claims, type MemoryDb, type State,
} from './memoryBackend.ts';
import { load } from './memory/backup.ts';
import { addDays, dateInZone, diffDays, monday } from '../lib/dates.ts';

export const DEMO_PIN = '1234';
export const DEMO_PARENT_EMAIL = 'parent@demo.local';
const DEMO_PARENT: Claims = {
  sub: '00000000-0000-4000-8000-00000000d0a1', email: DEMO_PARENT_EMAIL,
  app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Demo Parent' },
};
const DEMO_DEVICE: Claims = { sub: '00000000-0000-4000-8000-00000000d0d1', is_anonymous: true };

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DemoSeed {
  /** seed/base.json */
  base: object;
  /** seed/starter-plan.json */
  plan?: { goals?: object[]; cards?: object[] };
  childName?: string;
  timezone?: string;
}

type Plan = NonNullable<DemoSeed['plan']>;
const PLAN_DATE_KEYS = ['week_start', 'date', 'due_date', 'period_start'];

/**
 * Moves every date in a starter plan by a whole number of weeks, so that the plan's
 * first week becomes the week that contains `today`. The demo then always has a
 * full board, whenever it is opened. Month goals move to the month of `today`.
 */
export function alignPlan(plan: Plan, today: string): Plan {
  const rows = [...(plan.goals ?? []), ...(plan.cards ?? [])] as Record<string, unknown>[];
  const weeks = rows.filter((r) => r.scope !== 'month')
    .flatMap((r) => PLAN_DATE_KEYS.map((k) => r[k]).filter((v): v is string => typeof v === 'string'))
    .map((d) => monday(d)).sort();
  if (weeks.length === 0) return plan;
  const shift = diffDays(weeks[0], monday(today));
  const move = (row: object): object => {
    const out: Record<string, unknown> = { ...row };
    for (const k of PLAN_DATE_KEYS) {
      if (typeof out[k] === 'string') out[k] = out.scope === 'month' ? today : addDays(out[k] as string, shift);
    }
    return out;
  };
  return { goals: (plan.goals ?? []).map(move), cards: (plan.cards ?? []).map(move) };
}

/**
 * Makes the demo board look used: two earlier days closed out (a two-day campfire),
 * one leftover in the Catch-up tray, today partly planned with one card done and one
 * in progress, a must-do that is due soon, and a note from a parent.
 */
function liveIn(db: MemoryDb, childId: string, today: string): void {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const parent = (fn: string, args: Record<string, unknown>): any => db.call(DEMO_PARENT, fn, args);
  const add = (cards: object[]): { id: string }[] => parent('add_cards', { p_child_id: childId, p_cards: cards });
  for (const back of [2, 1]) {
    const date = addDays(today, -back);
    const made = add([
      { title: 'Math Academy lesson', category_id: 'academics', minutes: 30, kind: 'must', place: 'day', date, start_min: 540 },
      { title: 'Read for fun', category_id: 'rest', minutes: 30, kind: 'must', place: 'day', date },
      { title: 'Outside time', category_id: 'outdoors', minutes: 60, kind: 'choice', place: 'day', date, start_min: 780 },
      ...(back === 1
        ? [{ title: 'Mr Math problem set', category_id: 'academics', minutes: 60, kind: 'choice', place: 'day', date, start_min: 840 }]
        : []),
    ]);
    made.forEach((c, i) => parent('resolve_card', i === 3
      ? { p_card_id: c.id, p_pct: 50, p_note: 'Play date ran long' }
      : { p_card_id: c.id, p_pct: 100 }));
    parent('close_day', { p_child_id: childId, p_date: date, p_mood: 4 });
  }
  const now = add([
    { title: 'Math Academy lesson', category_id: 'academics', minutes: 30, kind: 'must', place: 'day', date: today, start_min: 540 },
    { title: 'Outline the winter one-shot', category_id: 'story', minutes: 45, kind: 'choice', place: 'day', date: today, start_min: 600 },
    { title: 'micro:bit: first programs', category_id: 'build', minutes: 30, kind: 'choice', place: 'day', date: today, start_min: 660 },
    { title: 'Outside time', category_id: 'outdoors', minutes: 60, kind: 'must', place: 'day', date: today, start_min: 780 },
    { title: 'Help cook dinner', category_id: 'home', minutes: 15, kind: 'choice', place: 'day', date: today },
  ]);
  parent('resolve_card', { p_card_id: now[0].id, p_pct: 100 });
  parent('start_card', { p_card_id: now[1].id });
  // Two of today's cards came "from the stack": take their copies out of this week's stack.
  const moved = new Set(['Outline the winter one-shot', 'micro:bit: first programs']);
  for (const c of db.state.cards.filter((x) => x.place === 'week' && moved.has(x.title))) {
    parent('delete_card', { p_card_id: c.id });
  }
  add([{ title: 'Pack for the trip', category_id: 'home', minutes: 15, kind: 'must', place: 'week', week_start: today, due_date: addDays(today, 2) }]);
  parent('set_parent_note', { p_child_id: childId, p_date: today, p_text: 'Proud of how you planned yesterday.' });
}

const STATE_KEY = 'qb-demo-state';
const PARENT_KEY = 'qb-demo-parent';
/**
 * Set this localStorage key to 'unlinked' before the first visit and the demo starts with
 * this browser NOT yet linked, so the "Link this device" screen can be seen and tested.
 */
export const DEMO_START_KEY = 'qb-demo-start';

/**
 * Builds the demo connection. On first use it creates a family (one parent, one
 * child with PIN 1234, this browser already linked as his device) and loads the
 * seed data, with the starter plan moved to start this week (see alignPlan) and
 * a few days of made-up activity so that every part of the screen has something to show.
 * Later visits pick up where the last one stopped.
 */
export function createDemoConnection(
  storage: KeyValueStore, seed: DemoSeed,
  opts: { now?: () => number; alignPlanToToday?: boolean; livedIn?: boolean } = {},
): Connection & { reset(): void } {
  const saved = storage.getItem(STATE_KEY);
  let state: State | undefined;
  try {
    state = saved ? (JSON.parse(saved) as State) : undefined;
  } catch {
    state = undefined;
  }
  const db = createMemoryDb({ now: opts.now, state });
  const save = () => storage.setItem(STATE_KEY, JSON.stringify(db.state));

  if (!state) {
    adminSetup(db, {
      familyName: 'Demo family', timezone: seed.timezone ?? 'America/Los_Angeles',
      parentEmails: [DEMO_PARENT_EMAIL], childName: seed.childName ?? 'Anush',
    });
    load(db.ctx(null), seed.base, false);
    const childId: string = db.state.children[0].id;
    if (seed.plan) {
      const today = dateInZone((opts.now ?? Date.now)(), db.state.config.timezone);
      loadStarterPlan(db, childId, opts.alignPlanToToday === false ? seed.plan : alignPlan(seed.plan, today));
    }
    db.call(DEMO_PARENT, 'claim_parent');
    db.call(DEMO_PARENT, 'set_child_pin', { p_child_id: childId, p_pin: DEMO_PIN });
    if (storage.getItem(DEMO_START_KEY) !== 'unlinked') {
      const pairing = db.call(DEMO_DEVICE, 'device_start_pairing', { p_label: 'This browser' }) as { pair_code: string };
      db.call(DEMO_PARENT, 'device_approve', { p_code: pairing.pair_code, p_child_id: childId });
    }
    if (opts.livedIn !== false) {
      liveIn(db, childId, dateInZone((opts.now ?? Date.now)(), db.state.config.timezone));
    }
    save();
  }
  db.onChange = save;

  const device = new MemoryBackend(db, DEMO_DEVICE);
  const parent = new MemoryBackend(db, storage.getItem(PARENT_KEY) === '1' ? DEMO_PARENT : null);
  return {
    mode: 'demo',
    device,
    parent,
    async ensureDeviceSession() { /* the demo device always exists */ },
    async parentSession() {
      return parent.claims ? { userId: parent.claims.sub, email: DEMO_PARENT_EMAIL } : null;
    },
    async signInParent() {
      parent.claims = DEMO_PARENT;
      storage.setItem(PARENT_KEY, '1');
    },
    async signOutParent() {
      parent.claims = null;
      storage.removeItem(PARENT_KEY);
    },
    /** Forget all demo data. The next createDemoConnection() starts fresh. */
    reset() {
      db.onChange = null;
      storage.removeItem(STATE_KEY);
      storage.removeItem(PARENT_KEY);
    },
  };
}
