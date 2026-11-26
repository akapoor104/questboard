// In-memory port of db/migrations/004_insights.sql: daily content, stats, reviews,
// backup, automation and the starter plan.
import { addDays, dateRange, diffDays, firstOfMonth, isDate, monday } from '../../lib/dates.ts';
import {
  type Ctx, type MemoryDb, type Row, access, by, childJson, fail, isObject, requireParent, uuid, weakHash,
} from './core.ts';
import { checkCardRow, checkGoalRow, exportDoc, load } from './backup.ts';

// ---- streak ------------------------------------------------------------------------

/** Consecutive closed-out days. Away/rest days are skipped: they neither add nor break. */
export function streak(c: Ctx, childId: string): { cur: number; best: number } {
  const closed = new Set(c.s.closeouts.filter((x) => x.child_id === childId).map((x) => x.date));
  const marked = new Set(c.s.day_marks.filter((x) => x.child_id === childId).map((x) => x.date));
  let cur = 0;
  let best = 0;
  if (closed.size === 0) return { cur, best };
  const first = [...closed].sort()[0];
  let run = 0;
  for (let d = first; d <= c.today; d = addDays(d, 1)) {
    if (closed.has(d)) {
      run++;
      best = Math.max(best, run);
    } else if (!marked.has(d)) {
      run = 0;
    }
  }
  let d = c.today;
  if (!closed.has(d)) d = addDays(d, -1);
  for (; d >= first; d = addDays(d, -1)) {
    if (closed.has(d)) cur++;
    else if (!marked.has(d)) break;
  }
  return { cur, best };
}

// ---- daily content -------------------------------------------------------------------

/** Deterministic pick: day number since 2026-01-01, modulo the list length. */
export function dayIndex(date: string, count: number): number {
  if (count <= 0) return 0;
  return ((diffDays('2026-01-01', date) % count) + count) % count;
}

function wordOfDay(c: Ctx, date: string): Row | null {
  const words = [...c.s.words].sort(by<Row>((w) => w.id));
  return words.length === 0 ? null : words[dayIndex(date, words.length)];
}

function getToday(c: Ctx, a: Row): Row {
  const role = access(c, a.p_child_id);
  const today = c.today;
  const word = wordOfDay(c, today);
  const encs = [...c.s.encouragements].sort(by<Row>((e) => e.id));
  const enc = encs.length === 0 ? null : encs[dayIndex(today, encs.length)].text;
  const mine = c.s.cards.filter((x) => x.child_id === a.p_child_id);
  const alerts: Row[] = [];
  let n = mine.filter((x) => x.place === 'day' && x.status === 'open' && x.date < today).length;
  if (n > 0) alerts.push({ type: 'unconfirmed', count: n });
  const tray = mine.filter((x) => x.place === 'tray' && x.status === 'open');
  if (tray.length > 0) {
    alerts.push({ type: 'tray', count: tray.length, minutes: tray.reduce((s, x) => s + x.minutes, 0) });
  }
  const soon = addDays(today, 2);
  n = mine.filter((x) => x.status === 'open' && x.kind === 'must' && x.due_date != null && x.due_date <= soon
    && !(x.place === 'day' && x.date <= x.due_date)).length;
  if (n > 0) alerts.push({ type: 'due_soon', count: n });
  if (role === 'parent') {
    n = mine.filter((x) => x.status === 'open' && x.drop_requested_at != null).length;
    if (n > 0) alerts.push({ type: 'drop_requests', count: n });
  }
  const st = streak(c, a.p_child_id);
  return {
    date: today,
    encouragement: enc,
    parent_note: c.s.parent_notes.find((x) => x.child_id === a.p_child_id && x.date === today)?.text ?? null,
    word: word === null ? null : {
      id: word.id, word: word.word, part_of_speech: word.part_of_speech, definition: word.definition,
      example: word.example,
      used: c.s.word_uses.some((u) => u.child_id === a.p_child_id && u.date === today),
    },
    streak: { current: st.cur, best: st.best },
    alerts,
  };
}

function markWordUsed(c: Ctx, a: Row): Row {
  access(c, a.p_child_id, true);
  const word = wordOfDay(c, c.today);
  if (word === null) fail('not_found');
  const used = a.p_used ?? true;
  c.s.word_uses = c.s.word_uses.filter((u) => !(u.child_id === a.p_child_id && u.date === c.today));
  if (used) c.s.word_uses.push({ child_id: a.p_child_id, date: c.today, word_id: word.id });
  return { used };
}

function setParentNote(c: Ctx, a: Row): Row {
  const raw = (a.p_text == null ? '' : String(a.p_text)).trim().slice(0, 500);
  const text = raw === '' ? null : raw;
  if (access(c, a.p_child_id, true) !== 'parent') fail('not_parent');
  const date = a.p_date ?? null;
  if (date === null || !isDate(date)) fail('bad_input');
  c.s.parent_notes = c.s.parent_notes.filter((x) => !(x.child_id === a.p_child_id && x.date === date));
  if (text !== null) c.s.parent_notes.push({ child_id: a.p_child_id, date, text });
  return { date, text };
}

// ---- stats -------------------------------------------------------------------------------

const spentOf = (x: Row): number => (x.status === 'resolved' ? Math.floor((x.minutes * x.pct + 50) / 100) : 0);

function tally(cards: Row[], today: string): Row {
  return {
    planned_min: cards.reduce((s, x) => s + x.minutes, 0),
    spent_min: cards.reduce((s, x) => s + spentOf(x), 0),
    done: cards.filter((x) => x.pct === 100).length,
    partial: cards.filter((x) => x.pct != null && x.pct >= 1 && x.pct <= 99).length,
    missed: cards.filter((x) => x.pct === 0).length,
    unconfirmed: cards.filter((x) => x.status === 'open' && x.date < today).length,
    open: cards.filter((x) => x.status === 'open' && x.date >= today).length,
  };
}

export function stats(c: Ctx, childId: string, from: string, to: string): Row {
  const today = c.today;
  const kindOf = new Map(c.s.categories.map((k) => [k.id, k]));
  const cards = c.s.cards.filter((x) => x.child_id === childId && x.place === 'day' && x.date >= from
    && x.date <= to && x.status !== 'dropped');
  const structured = cards.filter((x) => kindOf.get(x.category_id)?.kind === 'structured');
  const t = tally(cards, today);
  const totals = {
    planned_min: t.planned_min, spent_min: t.spent_min,
    structured_planned_min: structured.reduce((s, x) => s + x.minutes, 0),
    structured_spent_min: structured.reduce((s, x) => s + spentOf(x), 0),
    done: t.done, partial: t.partial, missed: t.missed, unconfirmed: t.unconfirmed, open: t.open,
    must_planned: cards.filter((x) => x.kind === 'must').length,
    must_done: cards.filter((x) => x.kind === 'must' && x.pct === 100).length,
  };
  const catIds = [...new Set(cards.map((x) => x.category_id))]
    .sort(by<string>((id) => kindOf.get(id)?.sort, (id) => id));
  const st = streak(c, childId);
  const tray = c.s.cards.filter((x) => x.child_id === childId && x.place === 'tray' && x.status === 'open');
  return {
    from, to, today, totals,
    by_category: catIds.map((id) => {
      const list = cards.filter((x) => x.category_id === id);
      return {
        category_id: id, planned_min: list.reduce((s, x) => s + x.minutes, 0),
        spent_min: list.reduce((s, x) => s + spentOf(x), 0),
      };
    }),
    by_day: dateRange(from, to).map((day) => ({
      date: day,
      ...tally(cards.filter((x) => x.date === day), today),
      closed: c.s.closeouts.some((x) => x.child_id === childId && x.date === day),
      mark: c.s.day_marks.find((m) => m.child_id === childId && m.date === day)?.kind ?? null,
    })),
    tray: { count: tray.length, minutes: tray.reduce((s, x) => s + x.minutes, 0) },
    streak: { current: st.cur, best: st.best },
    structured_weekly_max_min: c.s.config.structured_weekly_max_min,
  };
}

function checkRange(from: unknown, to: unknown, maxDays: number): void {
  if (!isDate(from) || !isDate(to) || to < from || diffDays(from, to) > maxDays) fail('bad_input');
}

function getStats(c: Ctx, a: Row): Row {
  access(c, a.p_child_id);
  checkRange(a.p_from, a.p_to, 400);
  return stats(c, a.p_child_id, a.p_from, a.p_to);
}

// ---- weekly review ---------------------------------------------------------------------------

function getReview(c: Ctx, a: Row): Row | null {
  access(c, a.p_child_id);
  if (a.p_week_start == null || !isDate(a.p_week_start)) fail('bad_input');
  const week = monday(a.p_week_start);
  return c.s.reviews.find((r) => r.child_id === a.p_child_id && r.week_start === week) ?? null;
}

function saveReview(c: Ctx, a: Row): Row {
  access(c, a.p_child_id, true);
  const p = a.p_review;
  if (a.p_week_start == null || !isDate(a.p_week_start) || !isObject(p)) fail('bad_input');
  const week = monday(a.p_week_start);
  const field = (v: unknown, n: number): string | null => {
    const t = (v == null ? '' : String(v)).slice(0, n);
    return t === '' ? null : t;
  };
  const row = {
    child_id: a.p_child_id, week_start: week, keep: field(p.keep, 2000), change: field(p.change, 2000),
    stop: field(p.stop, 2000), start: field(p.start, 2000), notes: field(p.notes, 4000), updated_at: c.nowIso,
  };
  c.s.reviews = c.s.reviews.filter((r) => !(r.child_id === a.p_child_id && r.week_start === week));
  c.s.reviews.push(row);
  return row;
}

// ---- backup -----------------------------------------------------------------------------------

function exportData(c: Ctx): Row {
  requireParent(c);
  return exportDoc(c);
}

function importData(c: Ctx, a: Row): Row {
  requireParent(c);
  return load(c, a.p_data, true);
}

// ---- automation (token instead of a signed-in user) -----------------------------------------------

function checkToken(c: Ctx, token: unknown): void {
  const hash = c.s.config.automation_token_hash;
  if (hash == null || typeof token !== 'string' || token.length < 32 || weakHash(token) !== hash) {
    fail('bad_token');
  }
}

function automationExport(c: Ctx, a: Row): Row {
  checkToken(c, a.p_token);
  return exportDoc(c);
}

function goalsInRange(c: Ctx, childId: string, from: string, to: string): Row[] {
  const wFrom = monday(from);
  const mFrom = firstOfMonth(from);
  return c.s.goals.filter((g) => g.child_id === childId && g.status !== 'dropped'
    && ((g.scope === 'week' && g.period_start >= wFrom && g.period_start <= to)
      || (g.scope === 'month' && g.period_start >= mFrom && g.period_start <= to)));
}

function automationSummary(c: Ctx, a: Row): Row {
  checkToken(c, a.p_token);
  checkRange(a.p_from, a.p_to, 62);
  const from: string = a.p_from;
  const to: string = a.p_to;
  const cfg = c.s.config;
  return {
    family_name: cfg.family_name, timezone: cfg.timezone, parent_emails: [...cfg.parent_emails],
    catchup_alert_threshold: cfg.catchup_alert_threshold,
    generated_at: c.nowIso, today: c.today, from, to,
    categories: [...c.s.categories].sort(by<Row>((k) => k.sort, (k) => k.id))
      .map((k) => ({ id: k.id, name: k.name, icon: k.icon })),
    children: [...c.s.children].sort(by<Row>((x) => x.created_at, (x) => x.id)).map((ch) => {
      const mine = c.s.cards.filter((x) => x.child_id === ch.id);
      const bySeq = by<Row>((x) => x.seq);
      return {
        child: childJson(ch),
        stats: stats(c, ch.id, from, to),
        tray: mine.filter((x) => x.place === 'tray' && x.status === 'open').sort(bySeq)
          .map((x) => ({ title: x.title, minutes: x.minutes, kind: x.kind, category_id: x.category_id })),
        drop_requests: mine.filter((x) => x.status === 'open' && x.drop_requested_at != null).sort(bySeq)
          .map((x) => ({ title: x.title, reason: x.drop_reason })),
        must_open: mine.filter((x) => x.status === 'open' && x.kind === 'must')
          .sort(by<Row>((x) => x.due_date, (x) => x.seq))
          .map((x) => ({ title: x.title, due_date: x.due_date, place: x.place, date: x.date })),
        goals: goalsInRange(c, ch.id, from, to).sort(by<Row>((g) => g.scope, (g) => g.sort, (g) => g.seq))
          .map((g) => ({ title: g.title, scope: g.scope, status: g.status, category_id: g.category_id })),
        closeouts: c.s.closeouts.filter((x) => x.child_id === ch.id && x.date >= from && x.date <= to)
          .sort(by<Row>((x) => x.date)).map((x) => ({ date: x.date, mood: x.mood, note: x.note })),
        partial_notes: mine.filter((x) => x.place === 'day' && x.status === 'resolved' && x.pct < 100
          && x.date >= from && x.date <= to).sort(by<Row>((x) => x.date, (x) => x.seq))
          .map((x) => ({ date: x.date, title: x.title, pct: x.pct, note: x.note })),
        review: c.s.reviews.find((r) => r.child_id === ch.id && r.week_start === monday(from)) ?? null,
      };
    }),
  };
}

function automationSchedule(c: Ctx, a: Row): Row[] {
  checkToken(c, a.p_token);
  checkRange(a.p_from, a.p_to, 62);
  const kids = new Map(c.s.children.map((x) => [x.id, x]));
  const cats = new Map(c.s.categories.map((x) => [x.id, x]));
  return c.s.cards.filter((x) => x.place === 'day' && x.start_min != null && x.status !== 'dropped'
    && x.date >= a.p_from && x.date <= a.p_to)
    .sort(by<Row>((x) => x.date, (x) => x.start_min, (x) => x.seq))
    .map((x) => ({
      card_id: x.id, child_id: x.child_id, child_name: kids.get(x.child_id)?.name, title: x.title,
      category_id: x.category_id, category_name: cats.get(x.category_id)?.name, icon: cats.get(x.category_id)?.icon,
      kind: x.kind, date: x.date, start_min: x.start_min, minutes: x.minutes, status: x.status, pct: x.pct,
    }));
}

// ---- starter plan and first-time setup (not part of the app API) ------------------------------------

/** Mirrors qb.load_starter_plan(): goals and cards for one child; skipped if he already has any. */
export function loadStarterPlan(db: MemoryDb, childId: string, plan: Row): Row {
  const c = db.ctx(null);
  if (c.s.cards.some((x) => x.child_id === childId) || c.s.goals.some((g) => g.child_id === childId)) {
    return { skipped: true, goals: 0, cards: 0 };
  }
  let goals = 0;
  let cards = 0;
  for (const g of (plan.goals ?? []) as Row[]) {
    const row: Row = {
      id: uuid(), child_id: childId, scope: g.scope,
      period_start: g.scope === 'week' ? monday(g.period_start) : firstOfMonth(g.period_start),
      title: g.title, category_id: g.category_id ?? null, note: g.note ?? null, status: 'active', sort: 0,
      created_by: 'system', created_at: c.nowIso, seq: 0,
    };
    checkGoalRow(c.s, row);
    row.seq = ++c.s.seq.goals;
    c.s.goals.push(row);
    goals++;
  }
  for (const it of (plan.cards ?? []) as Row[]) {
    for (let i = 0; i < (it.count ?? 1); i++) {
      const id = uuid();
      const kind = it.kind ?? 'choice';
      const row: Row = {
        id, child_id: childId, title: it.title, category_id: it.category_id, minutes: it.minutes, kind,
        created_by: kind === 'must' ? 'parent' : 'system', place: it.place,
        date: it.place === 'day' ? it.date ?? null : null,
        start_min: it.place === 'day' ? it.start_min ?? null : null,
        week_start: it.place === 'week' ? monday(it.week_start) : null,
        due_date: it.due_date ?? null, status: 'open', pct: null, resolved_at: null, note: null, doing_since: null,
        drop_requested_at: null, drop_reason: null, root_id: id, carried_from_id: null,
        library_item_id: it.library_item_id ?? null, goal_id: null, details: it.details ?? null, sort: 0,
        created_at: c.nowIso, updated_at: c.nowIso, seq: 0,
      };
      checkCardRow(c.s, row);
      row.seq = ++c.s.seq.cards;
      c.s.cards.push(row);
      cards++;
    }
  }
  db.onChange?.();
  return { skipped: false, goals, cards };
}

/** Mirrors public.admin_setup(): family name, time zone, parent allowlist, first child. */
export function adminSetup(
  db: MemoryDb, o: { familyName: string; timezone: string; parentEmails: string[]; childName: string },
): void {
  const c = db.ctx(null);
  const emails = [...new Set(o.parentEmails.map((e) => e.trim().toLowerCase()).filter((e) => e !== ''))].sort();
  if (emails.length === 0) throw new Error('Give at least one parent e-mail address.');
  Object.assign(c.s.config, {
    family_name: o.familyName.trim(), timezone: o.timezone, parent_emails: emails, updated_at: c.nowIso,
  });
  if (c.s.children.length === 0) {
    c.s.children.push({
      id: uuid(), name: o.childName.trim(), avatar: 'd20', theme: 'forest', pin_salt: null, pin_hash: null,
      pin_failed: 0, pin_locked_until: null, created_at: c.nowIso,
    });
  }
  db.onChange?.();
}

export function registerInsights(db: MemoryDb): void {
  db.register('get_today', ['p_child_id'], getToday);
  db.register('mark_word_used', ['p_child_id', 'p_used'], markWordUsed);
  db.register('set_parent_note', ['p_child_id', 'p_date', 'p_text'], setParentNote);
  db.register('get_stats', ['p_child_id', 'p_from', 'p_to'], getStats);
  db.register('get_review', ['p_child_id', 'p_week_start'], getReview);
  db.register('save_review', ['p_child_id', 'p_week_start', 'p_review'], saveReview);
  db.register('export_data', [], exportData);
  db.register('import_data', ['p_data'], importData);
  db.register('automation_export', ['p_token'], automationExport);
  db.register('automation_summary', ['p_token', 'p_from', 'p_to'], automationSummary);
  db.register('automation_schedule', ['p_token', 'p_from', 'p_to'], automationSchedule);
}
