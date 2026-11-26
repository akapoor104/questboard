// Pure helpers for turning API data into what the screens draw. No React, no
// network: everything here is covered by tests/unit/board.test.ts.
import type { Board, Card, Category } from '../api/types.ts';
import { addDays, firstOfMonth, lastOfMonth, monday } from './dates.ts';

/** The seven dates of a week, Monday first. */
export function weekDates(mondayDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayDate, i));
}

/** Cards grouped by their date (cards without a date are skipped). Order within a day is kept. */
export function cardsByDate(cards: Card[]): Map<string, Card[]> {
  const out = new Map<string, Card[]>();
  for (const c of cards) {
    if (c.date === null) continue;
    const list = out.get(c.date);
    if (list) list.push(c);
    else out.set(c.date, [c]);
  }
  return out;
}

/** What "50% of 60 minutes" means, exactly as the backend computes it. */
export function previewResolve(minutes: number, pct: number): { spent: number; left: number } {
  const spent = Math.floor((minutes * pct + 50) / 100);
  const left = pct >= 100 ? 0 : Math.max(5, Math.floor((minutes * (100 - pct) + 250) / 500) * 5);
  return { spent, left };
}

/** Minutes actually spent on a card (0 until it is resolved). */
export function spentMinutes(card: Card): number {
  return card.status === 'resolved' && card.pct !== null ? previewResolve(card.minutes, card.pct).spent : 0;
}

export interface CategoryMinutes {
  category_id: string;
  planned: number;
  spent: number;
}

/** Planned and spent minutes per category, in category order. Dropped cards are ignored. */
export function minutesByCategory(cards: Card[], categories: Category[]): CategoryMinutes[] {
  const totals = new Map<string, CategoryMinutes>();
  for (const c of cards) {
    if (c.status === 'dropped') continue;
    const t = totals.get(c.category_id) ?? { category_id: c.category_id, planned: 0, spent: 0 };
    t.planned += c.minutes;
    t.spent += spentMinutes(c);
    totals.set(c.category_id, t);
  }
  const order = new Map(categories.map((k, i) => [k.id, i]));
  return [...totals.values()].sort((a, b) => (order.get(a.category_id) ?? 999) - (order.get(b.category_id) ?? 999));
}

/** Planned minutes in "structured" categories: the number the weekly load meter shows. */
export function structuredMinutes(cards: Card[], categories: Category[]): number {
  const structured = new Set(categories.filter((k) => k.kind === 'structured').map((k) => k.id));
  return cards.filter((c) => c.status !== 'dropped' && structured.has(c.category_id))
    .reduce((sum, c) => sum + c.minutes, 0);
}

export interface TimedCard {
  card: Card;
  start: number;          // minutes from midnight
  end: number;
  column: number;         // 0-based column when cards overlap
  columns: number;        // how many columns its overlap group needs
}

/**
 * Splits one day's cards into "any time" cards and cards with a clock time, and
 * places overlapping timed cards side by side.
 */
export function layoutDay(cards: Card[]): { anytime: Card[]; timed: TimedCard[] } {
  const anytime = cards.filter((c) => c.start_min === null);
  const timed: TimedCard[] = cards.filter((c) => c.start_min !== null)
    .map((card) => ({ card, start: card.start_min as number, end: (card.start_min as number) + card.minutes, column: 0, columns: 1 }))
    .sort((a, b) => a.start - b.start || a.card.seq - b.card.seq);
  let group: TimedCard[] = [];
  let groupEnd = -1;
  const close = () => {
    const cols = Math.max(0, ...group.map((t) => t.column)) + 1;
    for (const t of group) t.columns = cols;
    group = [];
  };
  for (const t of timed) {
    if (group.length > 0 && t.start >= groupEnd) close();
    const taken = new Set(group.filter((g) => g.end > t.start).map((g) => g.column));
    let col = 0;
    while (taken.has(col)) col++;
    t.column = col;
    group.push(t);
    groupEnd = Math.max(groupEnd, t.end);
  }
  if (group.length > 0) close();
  return { anytime, timed };
}

/**
 * The first free slot of at least `minutes` on a day, on a 5-minute grid,
 * between `fromMin` and `dayEndMin`. Returns null when nothing fits.
 */
export function nextFreeSlot(dayCards: Card[], minutes: number, fromMin: number, dayEndMin: number): number | null {
  const busy = dayCards.filter((c) => c.start_min !== null && c.status !== 'dropped')
    .map((c) => [c.start_min as number, (c.start_min as number) + c.minutes] as const)
    .sort((a, b) => a[0] - b[0]);
  let t = Math.ceil(fromMin / 5) * 5;
  for (const [s, e] of busy) {
    if (t + minutes <= s) break;
    if (e > t) t = Math.ceil(e / 5) * 5;
  }
  return t + minutes <= dayEndMin ? t : null;
}

/**
 * Open must-dos that are due within two days and are not yet on a day on or before
 * their due date. This is the rule behind the 'due_soon' alert; use it to name the cards.
 */
export function dueSoonCards(board: Pick<Board, 'today' | 'cards' | 'pool' | 'tray'>): Card[] {
  const limit = addDays(board.today, 2);
  return [...board.cards, ...board.pool, ...board.tray].filter((c) =>
    c.status === 'open' && c.kind === 'must' && c.due_date !== null && c.due_date <= limit
    && !(c.place === 'day' && c.date !== null && c.date <= c.due_date));
}

export interface MustGroup {
  title: string;
  category_id: string;
  minutes: number;
  /** All cards in the group, in the order given. */
  cards: Card[];
  total: number;
  /** On a day (done or not). */
  placed: number;
  /** Still in the week's stack, waiting for a day. */
  toPlace: number;
  /** Resolved at 100%. */
  done: number;
}

/**
 * The parent view of one week's must-dos: cards with the same title, category and
 * minutes are one line ("Music practice: 2 placed, 3 to place"). Pass the week's day
 * cards and its stack; choice cards and dropped cards are ignored.
 */
export function groupMustDos(weekCards: Card[]): MustGroup[] {
  const groups = new Map<string, MustGroup>();
  for (const c of weekCards) {
    if (c.kind !== 'must' || c.status === 'dropped') continue;
    const key = JSON.stringify([c.title, c.category_id, c.minutes]);
    const g = groups.get(key)
      ?? { title: c.title, category_id: c.category_id, minutes: c.minutes, cards: [], total: 0, placed: 0, toPlace: 0, done: 0 };
    g.cards.push(c);
    g.total += 1;
    if (c.place === 'day') g.placed += 1;
    if (c.place === 'week') g.toPlace += 1;
    if (c.pct === 100) g.done += 1;
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Whole percent of planned minutes that got done; 0 when nothing was planned. */
export function percentDone(plannedMin: number, spentMin: number): number {
  return plannedMin <= 0 ? 0 : Math.min(100, Math.round((spentMin * 100) / plannedMin));
}

/**
 * The weeks of a month calendar, Monday first. Each week has seven dates; dates from
 * the months before and after fill the first and last rows.
 */
export function monthGrid(anyDateInMonth: string): string[][] {
  const out: string[][] = [];
  const last = lastOfMonth(anyDateInMonth);
  for (let start = monday(firstOfMonth(anyDateInMonth)); start <= last; start = addDays(start, 7)) {
    out.push(weekDates(start));
  }
  return out;
}
