// Pure helpers for the Month screen. No React, no network: covered by tests/unit/month.test.ts.
// Every number here comes from getStats' by_day rows; nothing is recomputed from cards.
import type { StatsDay } from '../api/types.ts';
import { formatDuration, isDate, monthName } from './dates.ts';

/** True when the day had at least one card (any state) or was closed out. */
function hadSomething(day: StatsDay): boolean {
  return day.done + day.partial + day.missed + day.unconfirmed + day.open > 0 || day.planned_min > 0 || day.closed;
}

/** Days with at least one card or a close-out. */
export function daysOnBoard(byDay: StatsDay[]): number {
  return byDay.filter(hadSomething).length;
}

/**
 * "{a} of {b} days closed out": `counted` are the days up to and including today, with no
 * rest or away mark, that had a card or a close-out; `closed` are those that were closed.
 */
export function closedOfCounted(byDay: StatsDay[], today: string): { closed: number; counted: number } {
  const counted = byDay.filter((d) => d.date <= today && d.mark === null && hadSomething(d));
  return { closed: counted.filter((d) => d.closed).length, counted: counted.length };
}

export type DayLabel = 'today' | 'rest' | 'away' | 'closed' | 'not_closed' | 'planned' | 'empty';

/** What one calendar cell says about its day. */
export function dayLabel(day: StatsDay, today: string): DayLabel {
  if (day.date === today) return 'today';
  if (day.mark) return day.mark;
  if (day.closed) return 'closed';
  if (day.date < today && hadSomething(day)) return 'not_closed';
  if (day.date > today && day.planned_min > 0) return 'planned';
  return 'empty';
}

/** How strong the blue tint of a day is: 0 for no time spent, then three steps against the month's busiest day. */
export function tintStep(spentMin: number, maxSpentMin: number): 0 | 1 | 2 | 3 {
  if (spentMin <= 0 || maxSpentMin <= 0) return 0;
  const ratio = spentMin / maxSpentMin;
  if (ratio < 0.6) return 1;
  if (ratio < 0.9) return 2;
  return 3;
}

/** '2026-12' -> '2026-12-01'; null for anything that is not a real month. */
export function parseMonth(ym: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const first = `${ym}-01`;
  return isDate(first) ? first : null;
}

/** '2026-12-01' -> '2026-12', for addresses like /month/2026-12. */
export function monthParam(date: string): string {
  return date.slice(0, 7);
}

/** The first day of the month before or after. */
export function shiftMonth(first: string, by: -1 | 1): string {
  let [y, m] = first.split('-').map(Number);
  m += by;
  if (m === 0) { m = 12; y -= 1; }
  if (m === 13) { m = 1; y += 1; }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
}

/** '2026-12-19' -> 'December 19'. */
export function monthDay(date: string): string {
  return `${monthName(date).split(' ')[0]} ${Number(date.slice(8))}`;
}

/** '{n} days on the board so far.' (one day: 'day'). */
export function boardLine(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'} on the board so far. Here is where the time went.`;
}

/** 290 -> '4h50', 300 -> '5h', 45 -> '45m': the calendar's text on a narrow screen. */
export function shortDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** The cell's accessible name, for example 'December 19: 4 h 50 min, closed out'. */
export function cellAriaLabel(day: StatsDay, today: string): string {
  const name = monthDay(day.date);
  const spent = day.spent_min > 0 ? `${formatDuration(day.spent_min)} spent` : null;
  const parts: string[] = [];
  switch (dayLabel(day, today)) {
    case 'today':
      parts.push('today');
      if (day.closed) parts.push('closed out');
      break;
    case 'rest': parts.push('rest day'); break;
    case 'away': parts.push('away'); break;
    case 'closed': parts.push(day.spent_min > 0 ? formatDuration(day.spent_min) : 'nothing spent', 'closed out'); break;
    case 'not_closed':
      if (spent) parts.push(spent);
      parts.push('not closed');
      break;
    case 'planned': parts.push(`${formatDuration(day.planned_min)} planned`); break;
    case 'empty': if (spent) parts.push(spent); break;
  }
  return parts.length ? `${name}: ${parts.join(', ')}` : name;
}
