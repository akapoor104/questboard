// Pure helpers for the parent's Must-dos screen. No React, no network:
// covered by tests/unit/parentPlan.test.ts.
import type { Card, NewCard } from '../api/types.ts';
import type { MustGroup } from './board.ts';
import { formatDuration } from './dates.ts';
import { parentWeek } from './parentHome.ts';

export interface MustDoInput {
  title: string;
  category_id: string;
  minutes: number;
  /** How many times this week (1 to 7). */
  times: number;
  due_date: string | null;
}

/** `times` copies of one must-do, all in the week's stack. */
export function mustDoCards(input: MustDoInput, week: string): NewCard[] {
  const out: NewCard[] = [];
  for (let i = 0; i < input.times; i++) {
    out.push({
      title: input.title, category_id: input.category_id, minutes: input.minutes, kind: 'must',
      place: 'week', week_start: week, due_date: input.due_date,
    });
  }
  return out;
}

/** '30 min, 7 times', '1 h, once'. */
export function mustDoMeta(group: Pick<MustGroup, 'minutes' | 'total'>): string {
  return `${formatDuration(group.minutes)}, ${group.total === 1 ? 'once' : `${group.total} times`}`;
}

/** '0 placed, 7 to place', 'all 5 placed', '3 of 5 done', 'all done'; for one card 'placed' or 'to place'. */
export function mustDoStatus(group: Pick<MustGroup, 'total' | 'placed' | 'toPlace' | 'done'>): string {
  if (group.total > 0 && group.done === group.total) return 'all done';
  if (group.done > 0) return `${group.done} of ${group.total} done`;
  if (group.total === 1) return group.toPlace === 1 ? 'to place' : 'placed';
  if (group.toPlace === 0) return `all ${group.placed} placed`;
  return `${group.placed} placed, ${group.toPlace} to place`;
}

/** Days off cycle: none -> rest -> away -> none. */
export function nextMark(current: 'rest' | 'away' | null): 'rest' | 'away' | null {
  if (current === null) return 'rest';
  if (current === 'rest') return 'away';
  return null;
}

/** The label of a day's button: 'Thursday: Away'. */
export function markLabel(weekdayName: string, mark: 'rest' | 'away' | null): string {
  return `${weekdayName}: ${mark === 'rest' ? 'Rest day' : mark === 'away' ? 'Away' : 'no mark'}`;
}

/** The cards a parent may still remove: the open ones, those not on a day yet first. */
export function removable(group: Pick<MustGroup, 'cards'>): Card[] {
  const open = group.cards.filter((c) => c.status === 'open');
  return [...open.filter((c) => c.place !== 'day'), ...open.filter((c) => c.place === 'day')];
}

/** A stable key for a group (same title, category and minutes). */
export function groupKey(group: Pick<MustGroup, 'title' | 'category_id' | 'minutes'>): string {
  return JSON.stringify([group.title, group.category_id, group.minutes]);
}

/** Which week `/parent/plan?week=...` shows; `redirect` as in parentWeek(), on this screen's address. */
export function planWeek(param: string | null, today: string): { week: string; redirect: string | null } {
  const { week, redirect } = parentWeek(param, today);
  return { week, redirect: redirect === null ? null : redirect.replace(/^\/parent/, '/parent/plan') };
}
