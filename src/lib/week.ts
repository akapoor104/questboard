// Pure helpers for the Week screen. No React, no network: covered by tests/unit/week.test.ts.
import type { Card, Goal, LibraryItem } from '../api/types.ts';
import { addDays, formatDuration, isDate, monday, weekday, weekdayName } from './dates.ts';

export type LoadLevel = 'spare' | 'full' | 'over';

/** How full the week is against the weekly guide: under 80% spare, 80 to 100% full, above over. */
export function loadState(plannedMin: number, guideMin: number): { ratio: number; level: LoadLevel; overBy: number } {
  if (guideMin <= 0) return { ratio: 0, level: 'spare', overBy: 0 };
  const ratio = plannedMin / guideMin;
  const level: LoadLevel = ratio < 0.8 ? 'spare' : ratio <= 1 ? 'full' : 'over';
  return { ratio, level, overBy: Math.max(0, plannedMin - guideMin) };
}

/** The sentence under the load meter (docs/05-design.md, "Week"). */
export function loadText(state: { level: LoadLevel; overBy: number }): string {
  if (state.level === 'spare') return 'Room to spare. Leave some of it empty.';
  if (state.level === 'full') return 'A full week. Nothing more needs adding.';
  return `Over the guide by ${formatDuration(state.overBy)}. What could wait?`;
}

/** Planned minutes of a day's cards, leaving out dropped ones. */
export function dayPlannedMinutes(cards: Card[]): number {
  return cards.filter((c) => c.status !== 'dropped').reduce((sum, c) => sum + c.minutes, 0);
}

/** Library items of one category, or all of them for `null`. Order is kept. */
export function filterLibrary(items: LibraryItem[], categoryId: string | null): LibraryItem[] {
  return categoryId === null ? items : items.filter((i) => i.category_id === categoryId);
}

export function isMonday(date: string): boolean {
  return isDate(date) && weekday(date) === 1;
}

/**
 * Which week the address shows. `redirect` is where to go instead when the parameter is
 * not a Monday (its Monday) or not a date at all (`/week`); otherwise null.
 */
export function weekFromParam(param: string | undefined, today: string): { week: string; redirect: string | null } {
  if (param === undefined) return { week: monday(today), redirect: null };
  if (!isDate(param)) return { week: monday(today), redirect: '/week' };
  if (!isMonday(param)) return { week: monday(param), redirect: `/week/${monday(param)}` };
  return { week: param, redirect: null };
}

/** The week's focus chips: week goals of that Monday that are active or done (done ones are struck through). */
export function weekFocus(goals: Goal[], week: string): Goal[] {
  return goals.filter((g) => g.scope === 'week' && g.period_start === week && g.status !== 'dropped');
}

/** At most three active focus goals a week. */
export const MAX_FOCUS = 3;

export function activeCount(goals: Goal[]): number {
  return goals.filter((g) => g.status === 'active').length;
}

/** What is wrong with a new card's fields, or null when it can be sent. */
export function newCardProblem(title: string, minutes: number): 'title' | 'minutes' | null {
  const t = title.trim();
  if (t.length < 1 || t.length > 120) return 'title';
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480 || minutes % 5 !== 0) return 'minutes';
  return null;
}

/**
 * The days a card can move to from the Week screen: the shown week's days from today on,
 * labelled like PlaceForm's own (`Today`, `Wed 23`). Empty for a week that is over.
 */
export function weekPlaceDays(week: string, today: string): { date: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i))
    .filter((date) => date >= today)
    .map((date) => ({ date, label: date === today ? 'Today' : `${weekdayName(date, true)} ${Number(date.slice(8))}` }));
}
