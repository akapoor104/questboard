// In-memory port of db/migrations/003_board.sql: cards, placement, resolving with
// carry-over, day close-out, goals, the library and categories.
import { addDays, firstOfMonth, isDate, monday } from '../../lib/dates.ts';
import {
  type Ctx, type MemoryDb, type Row, access, by, fail, intOrKeep, isObject, requireParent, uuid, viewer,
} from './core.ts';
import { checkCardRow, checkCategoryRow, checkGoalRow, checkLibraryRow } from './backup.ts';

// ---- small shared pieces -------------------------------------------------------

function getCard(c: Ctx, id: unknown): Row {
  const card = c.s.cards.find((x) => x.id === id);
  if (!card) fail('not_found');
  return card;
}

/** Minutes left over when pct of a card was done: nearest 5, at least 5. */
export function carryMinutes(minutes: number, pct: number): number {
  return Math.max(5, Math.floor((minutes * (100 - pct) + 250) / 500) * 5);
}

/** null/undefined -> null; a 'YYYY-MM-DD' string -> itself; anything else -> bad_input. */
function dateOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (!isDate(v)) fail('bad_input');
  return v;
}

function numOrKeep(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) fail('bad_input');
  return n;
}

function textOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

/** nullif(left(trim(coalesce(v, '')), n), '') */
function cleanText(v: unknown, n: number, trim = true): string | null {
  let t = v === null || v === undefined ? '' : String(v);
  if (trim) t = t.trim();
  t = t.slice(0, n);
  return t === '' ? null : t;
}

function badStart(v: number | null): boolean {
  return v !== null && (!Number.isInteger(v) || v < 0 || v > 1435 || v % 5 !== 0);
}

function goalBelongs(c: Ctx, goalId: unknown, childId: string): boolean {
  return c.s.goals.some((g) => g.id === goalId && g.child_id === childId);
}

function newCard(c: Ctx, fields: Row): Row {
  const id = uuid();
  const row: Row = {
    id, child_id: null, title: null, category_id: null, minutes: null, kind: null, created_by: null,
    place: null, date: null, start_min: null, week_start: null, due_date: null, status: 'open', pct: null,
    resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null,
    root_id: id, carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0,
    created_at: c.nowIso, updated_at: c.nowIso, seq: 0,
    ...fields,
  };
  checkCardRow(c.s, row);
  row.seq = ++c.s.seq.cards;
  c.s.cards.push(row);
  return row;
}

const dayOrder = by<Row>((x) => x.date, (x) => x.start_min, (x) => x.sort, (x) => x.seq);

// ---- reading -------------------------------------------------------------------

function getBoard(c: Ctx, a: Row): Row {
  access(c, a.p_child_id);
  const from = a.p_from;
  const to = a.p_to;
  if (!isDate(from) || !isDate(to) || to < from || Date.parse(to) - Date.parse(from) > 62 * 86_400_000) {
    fail('bad_input');
  }
  const wFrom = monday(from);
  const mFrom = firstOfMonth(from);
  const mine = c.s.cards.filter((x) => x.child_id === a.p_child_id);
  return {
    from, to, today: c.today, now: c.nowIso,
    cards: mine.filter((x) => x.place === 'day' && x.date >= from && x.date <= to && x.status !== 'dropped')
      .sort(dayOrder),
    pool: mine.filter((x) => x.place === 'week' && x.week_start >= wFrom && x.week_start <= to && x.status === 'open')
      .sort(by<Row>((x) => x.week_start, (x) => x.sort, (x) => x.seq)),
    tray: mine.filter((x) => x.place === 'tray' && x.status === 'open').sort(by<Row>((x) => x.seq)),
    unconfirmed: mine.filter((x) => x.place === 'day' && x.status === 'open' && x.date < c.today).sort(dayOrder),
    drop_requests: mine.filter((x) => x.status === 'open' && x.drop_requested_at != null).sort(by<Row>((x) => x.seq)),
    goals: c.s.goals.filter((g) => g.child_id === a.p_child_id && g.status !== 'dropped'
      && ((g.scope === 'week' && g.period_start >= wFrom && g.period_start <= to)
        || (g.scope === 'month' && g.period_start >= mFrom && g.period_start <= to)))
      .sort(by<Row>((g) => g.scope, (g) => g.period_start, (g) => g.sort, (g) => g.seq)),
    day_marks: c.s.day_marks.filter((m) => m.child_id === a.p_child_id && m.date >= from && m.date <= to)
      .sort(by<Row>((m) => m.date)),
    closeouts: c.s.closeouts.filter((x) => x.child_id === a.p_child_id && x.date >= from && x.date <= to)
      .sort(by<Row>((x) => x.date)),
  };
}

// ---- creating and editing --------------------------------------------------------

function addCards(c: Ctx, a: Row): Row[] {
  const role = access(c, a.p_child_id, true);
  const list = a.p_cards;
  if (!Array.isArray(list) || list.length < 1 || list.length > 60) fail('bad_input');
  const out: Row[] = [];
  for (const raw of list) {
    const item: Row = isObject(raw) ? raw : {};
    let date: string | null = null;
    let week: string | null = null;
    let start: number | null = null;
    if (item.place === 'day') {
      date = dateOrNull(item.date);
      start = intOrKeep(item.start_min) ?? null;
      if (date === null) fail('bad_input');
    } else if (item.place === 'week') {
      week = monday(dateOrNull(item.week_start) ?? c.today);
    } else {
      fail('bad_input');
    }
    if (role === 'kid' && ((date !== null && date < c.today) || (week !== null && week < monday(c.today)))) {
      fail('past_date');
    }
    const kind = role === 'kid' ? 'choice' : item.kind ?? 'must';
    if (item.goal_id != null && !goalBelongs(c, item.goal_id, a.p_child_id)) fail('bad_input');
    if (item.title == null) fail('bad_input');
    const minutes = intOrKeep(item.minutes);
    if (minutes === undefined) fail('bad_input');
    out.push(newCard(c, {
      child_id: a.p_child_id, title: String(item.title).trim(), category_id: textOrNull(item.category_id),
      minutes, kind, created_by: role === 'kid' ? 'kid' : 'parent', place: item.place, date, start_min: start,
      week_start: week, due_date: dateOrNull(item.due_date), library_item_id: textOrNull(item.library_item_id),
      goal_id: item.goal_id ?? null, details: cleanText(item.details, 2000, false),
      sort: numOrKeep(item.sort) ?? 0,
    }));
  }
  return out;
}

function updateCard(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  const role = access(c, card.child_id, true);
  const p = a.p_patch;
  if (!isObject(p)) fail('bad_input');
  if (card.status !== 'open') fail('not_open');
  if (role === 'kid' && (card.kind === 'must' || 'kind' in p)) fail('not_allowed');
  if (p.goal_id != null && !goalBelongs(c, p.goal_id, card.child_id)) fail('bad_input');
  const next: Row = { ...card };
  if (p.title != null) next.title = String(p.title).trim();
  if (p.category_id != null) next.category_id = String(p.category_id);
  const minutes = intOrKeep(p.minutes);
  if (minutes !== undefined) next.minutes = minutes;
  if (p.kind != null) next.kind = p.kind;
  if ('details' in p) next.details = cleanText(p.details, 2000, false);
  if ('due_date' in p) next.due_date = dateOrNull(p.due_date);
  if ('goal_id' in p) next.goal_id = p.goal_id ?? null;
  next.updated_at = c.nowIso;
  checkCardRow(c.s, next);
  Object.assign(card, next);
  return card;
}

function placeCard(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  const role = access(c, card.child_id, true);
  if (card.status !== 'open') fail('not_open');
  const sort = a.p_sort ?? card.sort;
  if (a.p_place === 'day') {
    const date = a.p_date ?? null;
    if (date === null) fail('bad_input');
    if (!isDate(date)) fail('bad_input');
    if (role === 'kid' && date < c.today) fail('past_date');
    const start: number | null = a.p_start_min ?? null;
    if (badStart(start)) fail('bad_input');
    Object.assign(card, {
      place: 'day', date, start_min: start, week_start: null,
      doing_since: date === c.today ? card.doing_since : null, sort, updated_at: c.nowIso,
    });
  } else if (a.p_place === 'week') {
    const week = monday(a.p_week_start ?? c.today);
    if (role === 'kid' && week < monday(c.today)) fail('past_date');
    Object.assign(card, {
      place: 'week', week_start: week, date: null, start_min: null, doing_since: null, sort, updated_at: c.nowIso,
    });
  } else {
    fail('bad_input');
  }
  return card;
}

function startCard(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  access(c, card.child_id, true);
  if (card.status !== 'open') fail('not_open');
  for (const x of c.s.cards) {
    if (x.child_id === card.child_id && x.doing_since != null && x.id !== card.id) {
      x.doing_since = null;
      x.updated_at = c.nowIso;
    }
  }
  const keepStart = card.place === 'day' && card.date === c.today;
  Object.assign(card, {
    place: 'day', date: c.today, week_start: null, start_min: keepStart ? card.start_min : null,
    doing_since: c.nowIso, updated_at: c.nowIso,
  });
  return card;
}

function stopCard(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  access(c, card.child_id, true);
  card.doing_since = null;
  card.updated_at = c.nowIso;
  return card;
}

// ---- resolving -------------------------------------------------------------------

function resolveCard(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  const role = access(c, card.child_id, true);
  if (card.status !== 'open') fail('not_open');
  const pct = a.p_pct;
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) fail('bad_input');
  const remainder = a.p_remainder ?? 'tray';
  if (!['tray', 'day', 'let_go'].includes(remainder)) fail('bad_input');
  if (card.place === 'day' && card.date > c.today) fail('future_card');
  const newDate: string | null = a.p_new_date ?? null;
  const newStart: number | null = a.p_new_start_min ?? null;
  if (pct < 100) {
    if (remainder === 'let_go' && role === 'kid' && card.kind === 'must') fail('must_needs_parent');
    if (remainder === 'day') {
      if (newDate === null || !isDate(newDate) || (role === 'kid' && newDate < c.today) || badStart(newStart)) {
        fail('bad_input');
      }
    }
  }
  const wasDay = card.place === 'day';
  Object.assign(card, {
    place: 'day', date: wasDay ? card.date : c.today, week_start: null, start_min: wasDay ? card.start_min : null,
    status: 'resolved', pct, resolved_at: c.nowIso, doing_since: null, drop_requested_at: null,
    note: cleanText(a.p_note, 500), updated_at: c.nowIso,
  });
  let carry: Row | null = null;
  if (pct < 100 && remainder !== 'let_go') {
    const toDay = remainder === 'day';
    carry = newCard(c, {
      child_id: card.child_id, title: card.title, category_id: card.category_id,
      minutes: carryMinutes(card.minutes, pct), kind: card.kind, created_by: card.created_by,
      place: toDay ? 'day' : 'tray', date: toDay ? newDate : null, start_min: toDay ? newStart : null,
      due_date: card.due_date, root_id: card.root_id, carried_from_id: card.id,
      library_item_id: card.library_item_id, goal_id: card.goal_id, details: card.details,
    });
  }
  return { card, carry };
}

function reopenCard(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  const role = access(c, card.child_id, true);
  if (card.status !== 'resolved') fail('not_resolved');
  if (role === 'kid' && card.date < addDays(c.today, -1)) fail('not_allowed');
  const carries = c.s.cards.filter((x) => x.carried_from_id === card.id);
  for (const x of carries) {
    if (x.status !== 'open' || x.doing_since != null || c.s.cards.some((y) => y.carried_from_id === x.id)) {
      fail('carry_in_use');
    }
  }
  c.s.cards = c.s.cards.filter((x) => x.carried_from_id !== card.id);
  c.s.closeouts = c.s.closeouts.filter((x) => !(x.child_id === card.child_id && x.date === card.date));
  Object.assign(card, { status: 'open', pct: null, resolved_at: null, note: null, updated_at: c.nowIso });
  return card;
}

function dropCard(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  const reason = cleanText(a.p_reason, 500);
  const role = access(c, card.child_id, true);
  if (card.status !== 'open') fail('not_open');
  if (role === 'kid' && card.kind === 'must') {
    Object.assign(card, { drop_requested_at: c.nowIso, drop_reason: reason, updated_at: c.nowIso });
    return { requested: true, card };
  }
  Object.assign(card, {
    status: 'dropped', doing_since: null, drop_requested_at: null, drop_reason: reason, updated_at: c.nowIso,
  });
  return { requested: false, card };
}

function decideDrop(c: Ctx, a: Row): Row {
  const card = getCard(c, a.p_card_id);
  requireParent(c);
  if (card.status !== 'open' || card.drop_requested_at == null) fail('not_found');
  if (a.p_approve === true) {
    Object.assign(card, { status: 'dropped', doing_since: null, drop_requested_at: null, updated_at: c.nowIso });
  } else {
    Object.assign(card, { drop_requested_at: null, drop_reason: null, updated_at: c.nowIso });
  }
  return card;
}

function deleteCard(c: Ctx, a: Row): Row {
  requireParent(c);
  if (!c.s.cards.some((x) => x.id === a.p_card_id)) fail('not_found');
  c.s.cards = c.s.cards.filter((x) => x.id !== a.p_card_id);
  for (const x of c.s.cards) if (x.carried_from_id === a.p_card_id) x.carried_from_id = null;
  return { ok: true };
}

// ---- close-out and day marks ------------------------------------------------------

function closeDay(c: Ctx, a: Row): Row {
  const date: string = a.p_date ?? c.today;
  access(c, a.p_child_id, true);
  const mood = a.p_mood ?? null;
  if (!isDate(date) || date > c.today || (mood !== null && (!Number.isInteger(mood) || mood < 1 || mood > 5))) {
    fail('bad_input');
  }
  if (c.s.cards.some((x) => x.child_id === a.p_child_id && x.place === 'day' && x.date === date && x.status === 'open')) {
    fail('open_cards');
  }
  const row = { child_id: a.p_child_id, date, closed_at: c.nowIso, mood, note: cleanText(a.p_note, 500) };
  c.s.closeouts = c.s.closeouts.filter((x) => !(x.child_id === a.p_child_id && x.date === date));
  c.s.closeouts.push(row);
  return row;
}

function setDayMark(c: Ctx, a: Row): Row | null {
  if (access(c, a.p_child_id, true) !== 'parent') fail('not_parent');
  const date = a.p_date ?? null;
  if (date === null || !isDate(date)) fail('bad_input');
  const rest = c.s.day_marks.filter((x) => !(x.child_id === a.p_child_id && x.date === date));
  if (a.p_kind == null) {
    c.s.day_marks = rest;
    return null;
  }
  if (a.p_kind !== 'away' && a.p_kind !== 'rest') fail('bad_input');
  const row = { child_id: a.p_child_id, date, kind: a.p_kind, note: cleanText(a.p_note, 200) };
  rest.push(row);
  c.s.day_marks = rest;
  return row;
}

// ---- goals -------------------------------------------------------------------------

function saveGoal(c: Ctx, a: Row): Row {
  const role = access(c, a.p_child_id, true);
  const p = a.p_goal;
  if (!isObject(p)) fail('bad_input');
  let existing: Row | undefined;
  let scope: unknown;
  let start: string;
  if (p.id != null) {
    existing = c.s.goals.find((g) => g.id === p.id && g.child_id === a.p_child_id);
    if (!existing) fail('not_found');
    scope = p.scope ?? existing.scope;
    start = dateOrNull(p.period_start) ?? existing.period_start;
  } else {
    scope = p.scope;
    start = dateOrNull(p.period_start) ?? c.today;
  }
  if (scope === 'week') start = monday(start);
  else if (scope === 'month') start = firstOfMonth(start);
  else fail('bad_input');
  const sort = intOrKeep(p.sort);
  if (existing) {
    const next: Row = { ...existing, scope, period_start: start };
    if (p.title != null) next.title = String(p.title).trim();
    if ('category_id' in p) next.category_id = textOrNull(p.category_id);
    if ('note' in p) next.note = cleanText(p.note, 500, false);
    if (p.status != null) next.status = p.status;
    if (sort !== undefined) next.sort = sort;
    checkGoalRow(c.s, next);
    Object.assign(existing, next);
    return existing;
  }
  if (p.title == null) fail('bad_input');
  const row: Row = {
    id: uuid(), child_id: a.p_child_id, scope, period_start: start, title: String(p.title).trim(),
    category_id: textOrNull(p.category_id), note: cleanText(p.note, 500, false), status: p.status ?? 'active',
    sort: sort ?? 0, created_by: role === 'kid' ? 'kid' : 'parent', created_at: c.nowIso, seq: 0,
  };
  checkGoalRow(c.s, row);
  row.seq = ++c.s.seq.goals;
  c.s.goals.push(row);
  return row;
}

// ---- library and categories -----------------------------------------------------------

function getLibrary(c: Ctx): Row {
  if (viewer(c).role === 'none') fail('not_allowed');
  const cats = [...c.s.categories].sort(by<Row>((x) => x.sort, (x) => x.id));
  const rank = new Map(cats.map((x, i) => [x.id, i]));
  return {
    categories: cats,
    items: c.s.library_items.filter((i) => i.active)
      .sort(by<Row>((i) => rank.get(i.category_id), (i) => i.title, (i) => i.id)),
  };
}

function tagsOf(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) fail('bad_input');
  return v.map((x) => String(x));
}

function saveLibraryItem(c: Ctx, a: Row): Row {
  const role = viewer(c).role;
  if (role !== 'parent' && role !== 'kid') fail('not_allowed');
  const p = a.p_item;
  if (!isObject(p)) fail('bad_input');
  const minutes = intOrKeep(p.minutes);
  if (p.id != null) {
    const item = c.s.library_items.find((x) => x.id === p.id);
    if (!item) fail('not_found');
    if (role === 'kid' && item.source !== 'kid') fail('not_allowed');
    const next: Row = { ...item };
    if (p.title != null) next.title = String(p.title).trim();
    if (p.category_id != null) next.category_id = String(p.category_id);
    if (minutes !== undefined) next.minutes = minutes;
    if ('description' in p) next.description = cleanText(p.description, 1000, false);
    if ('tags' in p) next.tags = tagsOf(p.tags);
    checkLibraryRow(c.s, next);
    Object.assign(item, next);
    return item;
  }
  if (p.title == null || minutes === undefined) fail('bad_input');
  const row: Row = {
    id: uuid(), title: String(p.title).trim(), category_id: textOrNull(p.category_id), minutes,
    description: cleanText(p.description, 1000, false), tags: tagsOf(p.tags),
    source: role === 'kid' ? 'kid' : 'parent', plan_ref: null, active: true, created_at: c.nowIso,
  };
  checkLibraryRow(c.s, row);
  c.s.library_items.push(row);
  return row;
}

function archiveLibraryItem(c: Ctx, a: Row): Row {
  const role = viewer(c).role;
  if (role !== 'parent' && role !== 'kid') fail('not_allowed');
  const item = c.s.library_items.find((x) => x.id === a.p_id);
  if (!item) fail('not_found');
  if (role === 'kid' && item.source !== 'kid') fail('not_allowed');
  item.active = false;
  return { ok: true };
}

function boolOrKeep(v: unknown): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  fail('bad_input');
}

function saveCategory(c: Ctx, a: Row): Row {
  requireParent(c);
  const p = a.p_cat;
  if (!isObject(p) || p.id == null) fail('bad_input');
  // As in SQL, the full row is checked first, so name, color and icon are always required.
  if (p.name == null || p.color == null || p.icon == null) fail('bad_input');
  const existing = c.s.categories.find((x) => x.id === String(p.id));
  const row: Row = {
    id: String(p.id), name: String(p.name).trim(), color: String(p.color), icon: String(p.icon),
    kind: p.kind ?? existing?.kind ?? 'structured',
    sort: intOrKeep(p.sort) ?? existing?.sort ?? 0,
    active: boolOrKeep(p.active) ?? existing?.active ?? true,
  };
  checkCategoryRow(row);
  if (existing) {
    Object.assign(existing, row);
    return existing;
  }
  c.s.categories.push(row);
  return row;
}

export function registerBoard(db: MemoryDb): void {
  db.register('get_board', ['p_child_id', 'p_from', 'p_to'], getBoard);
  db.register('add_cards', ['p_child_id', 'p_cards'], addCards);
  db.register('update_card', ['p_card_id', 'p_patch'], updateCard);
  db.register('place_card', ['p_card_id', 'p_place', 'p_date', 'p_start_min', 'p_week_start', 'p_sort'], placeCard);
  db.register('start_card', ['p_card_id'], startCard);
  db.register('stop_card', ['p_card_id'], stopCard);
  db.register('resolve_card',
    ['p_card_id', 'p_pct', 'p_note', 'p_remainder', 'p_new_date', 'p_new_start_min'], resolveCard);
  db.register('reopen_card', ['p_card_id'], reopenCard);
  db.register('drop_card', ['p_card_id', 'p_reason'], dropCard);
  db.register('decide_drop', ['p_card_id', 'p_approve'], decideDrop);
  db.register('delete_card', ['p_card_id'], deleteCard);
  db.register('close_day', ['p_child_id', 'p_date', 'p_mood', 'p_note'], closeDay);
  db.register('set_day_mark', ['p_child_id', 'p_date', 'p_kind', 'p_note'], setDayMark);
  db.register('save_goal', ['p_child_id', 'p_goal'], saveGoal);
  db.register('get_library', [], getLibrary);
  db.register('save_library_item', ['p_item'], saveLibraryItem);
  db.register('archive_library_item', ['p_id'], archiveLibraryItem);
  db.register('save_category', ['p_cat'], saveCategory);
}
