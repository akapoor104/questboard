// In-memory port of qb.export() and qb.load() (db/migrations/004_insights.sql),
// plus the test-only reset used by the contract tests.
import { isDate } from '../../lib/dates.ts';
import { type Ctx, type MemoryDb, type Row, type State, by, cmp, emptyState, fail, intOrKeep, isObject, iso, pinHash } from './core.ts';

const pick = (r: Row, keys: string[]): Row => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));

const CARD_COLS = ['id', 'child_id', 'title', 'category_id', 'minutes', 'kind', 'created_by', 'place', 'date',
  'start_min', 'week_start', 'due_date', 'status', 'pct', 'resolved_at', 'note', 'doing_since',
  'drop_requested_at', 'drop_reason', 'root_id', 'carried_from_id', 'library_item_id', 'goal_id', 'details',
  'sort', 'created_at', 'updated_at'];
const GOAL_COLS = ['id', 'child_id', 'scope', 'period_start', 'title', 'category_id', 'note', 'status', 'sort',
  'created_by', 'created_at'];

export function exportDoc(c: Ctx): Row {
  const s = c.s;
  const cfg = s.config;
  return {
    version: 1,
    exported_at: c.nowIso,
    tables: {
      app_config: [pick(cfg, ['family_name', 'timezone', 'day_start_min', 'day_end_min', 'unlock_minutes',
        'catchup_alert_threshold', 'structured_weekly_max_min'])],
      children: [...s.children].sort(by((x: Row) => x.created_at, (x: Row) => x.id))
        .map((x) => pick(x, ['id', 'name', 'avatar', 'theme'])),
      categories: [...s.categories].sort(by((x: Row) => x.sort, (x: Row) => x.id)).map((x) => ({ ...x })),
      library_items: [...s.library_items].sort(by((x: Row) => x.id)).map((x) => ({ ...x })),
      goals: [...s.goals].sort(by((x: Row) => x.seq)).map((x) => pick(x, GOAL_COLS)),
      cards: [...s.cards].sort(by((x: Row) => x.seq)).map((x) => pick(x, CARD_COLS)),
      day_marks: [...s.day_marks].sort(by((x: Row) => x.child_id, (x: Row) => x.date)).map((x) => ({ ...x })),
      closeouts: [...s.closeouts].sort(by((x: Row) => x.child_id, (x: Row) => x.date)).map((x) => ({ ...x })),
      words: [...s.words].sort(by((x: Row) => x.id)).map((x) => ({ ...x })),
      encouragements: [...s.encouragements].sort(by((x: Row) => x.id)).map((x) => ({ ...x })),
      word_uses: [...s.word_uses].sort(by((x: Row) => x.child_id, (x: Row) => x.date)).map((x) => ({ ...x })),
      parent_notes: [...s.parent_notes].sort(by((x: Row) => x.child_id, (x: Row) => x.date)).map((x) => ({ ...x })),
      reviews: [...s.reviews].sort(by((x: Row) => x.child_id, (x: Row) => x.week_start)).map((x) => ({ ...x })),
    },
  };
}

// ---- row checks (stand in for the table constraints) -----------------------------

const oneOf = (v: unknown, list: string[]) => typeof v === 'string' && list.includes(v);
const intIn = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const textLen = (v: unknown, lo: number, hi: number) => typeof v === 'string' && v.length >= lo && v.length <= hi;

export function checkCardRow(s: State, r: Row): void {
  const ok = textLen(r.title, 1, 120)
    && s.categories.some((x) => x.id === r.category_id)
    && s.children.some((x) => x.id === r.child_id)
    && intIn(r.minutes, 5, 480)
    && oneOf(r.kind, ['must', 'choice'])
    && oneOf(r.created_by, ['parent', 'kid', 'system'])
    && oneOf(r.place, ['day', 'week', 'tray'])
    && oneOf(r.status, ['open', 'resolved', 'dropped'])
    && (r.start_min == null || (intIn(r.start_min, 0, 1435) && r.start_min % 5 === 0))
    && (r.pct == null || intIn(r.pct, 0, 100))
    && (r.date == null || isDate(r.date)) && (r.week_start == null || isDate(r.week_start))
    && (r.due_date == null || isDate(r.due_date))
    && ((r.place === 'day' && r.date != null && r.week_start == null)
      || (r.place === 'week' && r.week_start != null && r.date == null && r.start_min == null)
      || (r.place === 'tray' && r.date == null && r.week_start == null && r.start_min == null))
    && ((r.status === 'resolved') === (r.pct != null))
    && (r.library_item_id == null || s.library_items.some((x) => x.id === r.library_item_id))
    && (r.goal_id == null || s.goals.some((x) => x.id === r.goal_id));
  if (!ok) fail('bad_input');
}

export function checkGoalRow(s: State, r: Row): void {
  const ok = s.children.some((x) => x.id === r.child_id)
    && oneOf(r.scope, ['week', 'month']) && isDate(r.period_start) && textLen(r.title, 1, 160)
    && (r.category_id == null || s.categories.some((x) => x.id === r.category_id))
    && oneOf(r.status, ['active', 'done', 'dropped']) && Number.isInteger(r.sort)
    && oneOf(r.created_by, ['parent', 'kid', 'system']);
  if (!ok) fail('bad_input');
}

export function checkCategoryRow(r: Row): void {
  const ok = typeof r.id === 'string' && /^[a-z][a-z0-9_-]{1,23}$/.test(r.id)
    && typeof r.name === 'string' && typeof r.color === 'string' && typeof r.icon === 'string'
    && oneOf(r.kind, ['structured', 'free']) && Number.isInteger(r.sort) && typeof r.active === 'boolean';
  if (!ok) fail('bad_input');
}

export function checkLibraryRow(s: State, r: Row): void {
  const ok = typeof r.id === 'string' && textLen(r.title, 1, 120)
    && s.categories.some((x) => x.id === r.category_id) && intIn(r.minutes, 5, 480)
    && Array.isArray(r.tags) && oneOf(r.source, ['guide', 'parent', 'kid']) && typeof r.active === 'boolean';
  if (!ok) fail('bad_input');
}

const arr = (t: Row, k: string): Row[] => {
  const v = t[k];
  if (v == null) return [];
  if (!Array.isArray(v)) fail('bad_input');
  return v as Row[];
};

/** Loads a document in the export format. See qb.load() for the rules. */
export function load(c: Ctx, data: unknown, replace: boolean): Row {
  if (!isObject(data) || data.version !== 1) fail('bad_input');
  const t: Row = isObject(data.tables) ? data.tables : {};
  const s = c.s;
  const counts: Row = {};
  if (replace) {
    s.reviews = []; s.parent_notes = []; s.word_uses = []; s.closeouts = []; s.day_marks = []; s.cards = [];
    s.goals = []; s.library_items = []; s.categories = []; s.words = []; s.encouragements = [];
  }
  const cfgIn = arr(t, 'app_config')[0];
  if (cfgIn != null) {
    const cfg = s.config;
    if (cfgIn.family_name != null) cfg.family_name = String(cfgIn.family_name);
    if (cfgIn.timezone != null) cfg.timezone = String(cfgIn.timezone);
    for (const k of ['day_start_min', 'day_end_min', 'unlock_minutes', 'catchup_alert_threshold',
      'structured_weekly_max_min']) {
      const v = intOrKeep(cfgIn[k]);
      if (v !== undefined) cfg[k] = v;
    }
    cfg.updated_at = c.nowIso;
  }

  const kids = arr(t, 'children');
  if (replace && kids.length > 0) {
    const keep = new Set(kids.map((k) => k.id));
    s.children = s.children.filter((x) => keep.has(x.id));
    s.devices = s.devices.filter((d) => d.child_id == null || keep.has(d.child_id));
  }
  let n = 0;
  for (const r of kids) {
    const name = r.name;
    if (typeof r.id !== 'string' || !textLen(name, 1, 40)) fail('bad_input');
    const ex = s.children.find((x) => x.id === r.id);
    if (!ex) {
      s.children.push({
        id: r.id, name, avatar: r.avatar ?? 'd20', theme: r.theme ?? 'forest', pin_salt: null, pin_hash: null,
        pin_failed: 0, pin_locked_until: null, created_at: c.nowIso,
      });
      n++;
    } else if (replace) {
      Object.assign(ex, { name, avatar: r.avatar ?? 'd20', theme: r.theme ?? 'forest' });
      n++;
    }
  }
  counts.children = n;

  n = 0;
  for (const r of arr(t, 'categories')) {
    if (s.categories.some((x) => x.id === r.id)) continue;
    const row = { id: r.id, name: r.name, color: r.color, icon: r.icon, kind: r.kind ?? 'structured',
      sort: r.sort ?? 0, active: r.active ?? true };
    checkCategoryRow(row);
    s.categories.push(row);
    n++;
  }
  counts.categories = n;

  n = 0;
  for (const r of arr(t, 'library_items')) {
    if (s.library_items.some((x) => x.id === r.id)) continue;
    const row = { id: r.id, title: r.title, category_id: r.category_id, minutes: r.minutes,
      description: r.description ?? null, tags: r.tags ?? [], source: r.source ?? 'parent',
      plan_ref: r.plan_ref ?? null, active: r.active ?? true, created_at: c.nowIso };
    checkLibraryRow(s, row);
    s.library_items.push(row);
    n++;
  }
  counts.library_items = n;

  n = 0;
  for (const r of arr(t, 'words')) {
    if (s.words.some((x) => x.id === r.id)) continue;
    if (!Number.isInteger(r.id) || [r.word, r.part_of_speech, r.definition, r.example].some((x) => typeof x !== 'string')) {
      fail('bad_input');
    }
    s.words.push(pick(r, ['id', 'word', 'part_of_speech', 'definition', 'example']));
    n++;
  }
  counts.words = n;

  n = 0;
  for (const r of arr(t, 'encouragements')) {
    if (s.encouragements.some((x) => x.id === r.id)) continue;
    if (!Number.isInteger(r.id) || typeof r.text !== 'string') fail('bad_input');
    s.encouragements.push({ id: r.id, text: r.text });
    n++;
  }
  counts.encouragements = n;

  n = 0;
  for (const r of arr(t, 'goals')) {
    if (s.goals.some((x) => x.id === r.id)) continue;
    const row = { id: r.id, child_id: r.child_id, scope: r.scope, period_start: r.period_start, title: r.title,
      category_id: r.category_id ?? null, note: r.note ?? null, status: r.status ?? 'active', sort: r.sort ?? 0,
      created_by: r.created_by ?? 'parent', created_at: r.created_at ?? c.nowIso, seq: ++s.seq.goals };
    if (typeof row.id !== 'string') fail('bad_input');
    checkGoalRow(s, row);
    s.goals.push(row);
    n++;
  }
  counts.goals = n;

  n = 0;
  const cardsIn = arr(t, 'cards');
  for (const r of cardsIn) {
    if (s.cards.some((x) => x.id === r.id)) continue;
    const row: Row = pick(r, CARD_COLS);
    if (typeof row.id !== 'string') fail('bad_input');
    row.status = r.status ?? 'open';
    row.root_id = r.root_id ?? r.id;
    row.carried_from_id = null;
    row.sort = r.sort ?? 0;
    row.created_at = r.created_at ?? c.nowIso;
    row.updated_at = r.updated_at ?? c.nowIso;
    checkCardRow(s, row);
    row.seq = ++s.seq.cards;
    s.cards.push(row);
    n++;
  }
  counts.cards = n;
  for (const r of cardsIn) {
    if (r.carried_from_id == null) continue;
    const row = s.cards.find((x) => x.id === r.id);
    if (row && row.carried_from_id == null && s.cards.some((x) => x.id === r.carried_from_id)) {
      row.carried_from_id = r.carried_from_id;
    }
  }

  const kidOk = (id: unknown) => s.children.some((x) => x.id === id) || fail('bad_input');
  for (const r of arr(t, 'day_marks')) {
    if (s.day_marks.some((x) => x.child_id === r.child_id && x.date === r.date)) continue;
    kidOk(r.child_id);
    if (!isDate(r.date) || !oneOf(r.kind, ['away', 'rest'])) fail('bad_input');
    s.day_marks.push({ child_id: r.child_id, date: r.date, kind: r.kind, note: r.note ?? null });
  }
  for (const r of arr(t, 'closeouts')) {
    if (s.closeouts.some((x) => x.child_id === r.child_id && x.date === r.date)) continue;
    kidOk(r.child_id);
    if (!isDate(r.date) || !(r.mood == null || intIn(r.mood, 1, 5))) fail('bad_input');
    s.closeouts.push({ child_id: r.child_id, date: r.date, closed_at: r.closed_at ?? c.nowIso,
      mood: r.mood ?? null, note: r.note ?? null });
  }
  for (const r of arr(t, 'word_uses')) {
    if (s.word_uses.some((x) => x.child_id === r.child_id && x.date === r.date)) continue;
    kidOk(r.child_id);
    if (!isDate(r.date) || !s.words.some((w) => w.id === r.word_id)) fail('bad_input');
    s.word_uses.push({ child_id: r.child_id, date: r.date, word_id: r.word_id });
  }
  for (const r of arr(t, 'parent_notes')) {
    if (s.parent_notes.some((x) => x.child_id === r.child_id && x.date === r.date)) continue;
    kidOk(r.child_id);
    if (!isDate(r.date) || !textLen(r.text, 1, 500)) fail('bad_input');
    s.parent_notes.push({ child_id: r.child_id, date: r.date, text: r.text });
  }
  for (const r of arr(t, 'reviews')) {
    if (s.reviews.some((x) => x.child_id === r.child_id && x.week_start === r.week_start)) continue;
    kidOk(r.child_id);
    if (!isDate(r.week_start)) fail('bad_input');
    s.reviews.push({ child_id: r.child_id, week_start: r.week_start, keep: r.keep ?? null,
      change: r.change ?? null, stop: r.stop ?? null, start: r.start ?? null, notes: r.notes ?? null,
      updated_at: r.updated_at ?? c.nowIso });
  }
  return counts;
}

/** TEST ONLY: wipe everything and load a fixture (mirrors public.test_reset in db/test). */
export function testReset(db: MemoryDb, fixture: Row): void {
  const c0 = db.ctx(null);
  db.state = emptyState(c0.nowIso);
  const c = db.ctx(null);
  load(c, fixture, false);
  const t = isObject(fixture.test) ? fixture.test : {};
  db.state.config.parent_emails = Array.isArray(t.parent_emails)
    ? (t.parent_emails as string[]).map((x) => x.toLowerCase()) : [];
  for (const [childId, pin] of Object.entries(isObject(t.pins) ? t.pins : {})) {
    const ch = db.state.children.find((x) => x.id === childId);
    if (ch) Object.assign(ch, { pin_salt: 'testsalt', pin_hash: pinHash('testsalt', String(pin)) });
  }
}

export { cmp, iso };
