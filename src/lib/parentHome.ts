// Pure helpers for the parent's This week screen. No React, no network:
// covered by tests/unit/parentHome.test.ts.
import type { Card } from '../api/types.ts';
import { addDays, formatDuration, isDate, monday, weekdayName } from './dates.ts';
import { isMonday } from './week.ts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

/** '2026-12-14' -> 'December 14 to 20'; across months 'December 28 to January 3'. */
export function weekRangeText(mondayDate: string): string {
  const sunday = addDays(mondayDate, 6);
  const [, m1, d1] = mondayDate.split('-').map(Number);
  const [, m2, d2] = sunday.split('-').map(Number);
  return m1 === m2
    ? `${MONTHS[m1 - 1]} ${d1} to ${d2}`
    : `${MONTHS[m1 - 1]} ${d1} to ${MONTHS[m2 - 1]} ${d2}`;
}

/** The Load check sentence: structured time planned against the parents' weekly guide. */
export function loadCheckText(plannedMin: number, guideMin: number): string {
  const head = `Structured time planned: ${formatDuration(plannedMin)}.`;
  if (guideMin <= 0) return `${head} No weekly guide is set yet.`;
  const guide = `Your guide is ${formatDuration(guideMin)}`;
  if (plannedMin > guideMin) return `${head} ${guide}, so this week ran ${formatDuration(plannedMin - guideMin)} over.`;
  if (plannedMin < guideMin) return `${head} ${guide}, so there is ${formatDuration(guideMin - plannedMin)} to spare.`;
  return `${head} ${guide}, so this week is exactly your guide.`;
}

function cards(n: number): string {
  return `${n} ${n === 1 ? 'card' : 'cards'}`;
}

/** The Catch-up tray line; `alert` is true at or above the parents' threshold. */
export function trayLine(count: number, minutes: number, threshold: number): { text: string; alert: boolean } {
  return {
    text: `Catch-up tray: ${cards(count)}, ${formatDuration(minutes)}. You are alerted at ${cards(threshold)}.`,
    alert: threshold > 0 && count >= threshold,
  };
}

/** "{n} cards from earlier days have no percent yet." */
export function unconfirmedLine(n: number): string {
  return n === 1
    ? '1 card from earlier days has no percent yet.'
    : `${n} cards from earlier days have no percent yet.`;
}

/** One due-soon must-do: '"Pack for the trip" is due Wednesday and is not on a day yet.' */
export function dueSoonLine(card: Pick<Card, 'title' | 'due_date'>): string {
  const when = card.due_date === null ? 'soon' : weekdayName(card.due_date);
  return `"${card.title}" is due ${when} and is not on a day yet.`;
}

/** A drop request's line: 'Mr Math problem set (25 min left). "We had guests all weekend."' */
export function dropRequestLine(card: Pick<Card, 'title' | 'minutes' | 'place' | 'drop_reason'>): string {
  const minutes = card.place === 'tray' ? `${formatDuration(card.minutes)} left` : formatDuration(card.minutes);
  const reason = card.drop_reason?.trim();
  return reason ? `${card.title} (${minutes}). "${reason}"` : `${card.title} (${minutes}).`;
}

/**
 * Which week `/parent?week=...` shows. `redirect` is the address to use instead when the
 * parameter is not a Monday (its Monday) or not a date (`/parent`); otherwise null.
 */
export function parentWeek(param: string | null, today: string): { week: string; redirect: string | null } {
  if (param === null) return { week: monday(today), redirect: null };
  if (!isDate(param)) return { week: monday(today), redirect: '/parent' };
  if (!isMonday(param)) return { week: monday(param), redirect: `/parent?week=${monday(param)}` };
  return { week: param, redirect: null };
}
