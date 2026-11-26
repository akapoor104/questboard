// Pure helpers for the Today screen. No React, no network: covered by tests/unit/today.test.ts.
import type { Card } from '../api/types.ts';
import { formatClock, formatDuration, minutesInZone, weekdayName } from './dates.ts';

/**
 * This week's stack as tiles: cards with the same title, category, minutes and kind are
 * one entry, and `more` says how many others hide behind it. Must-dos first, then by
 * `sort`, then `seq`.
 */
export function stackGroups(pool: Card[]): { card: Card; more: number }[] {
  const ordered = [...pool].sort((a, b) =>
    (a.kind === 'must' ? 0 : 1) - (b.kind === 'must' ? 0 : 1) || a.sort - b.sort || a.seq - b.seq);
  const groups = new Map<string, { card: Card; more: number }>();
  for (const c of ordered) {
    const key = JSON.stringify([c.title, c.category_id, c.minutes, c.kind]);
    const g = groups.get(key);
    if (g) g.more += 1;
    else groups.set(key, { card: c, more: 0 });
  }
  return [...groups.values()];
}

/** Stack cards of this week, and open stack cards still sitting in earlier weeks. */
export function splitPool(pool: Card[], thisMonday: string): { current: Card[]; older: Card[] } {
  const current: Card[] = [];
  const older: Card[] = [];
  for (const c of pool) {
    if (c.place !== 'week' || c.week_start === null) continue;
    if (c.week_start === thisMonday) current.push(c);
    else if (c.week_start < thisMonday && c.status === 'open') older.push(c);
  }
  return { current, older };
}

/** The minute of each full hour to label: from the hour containing the start to the last hour before the end. */
export function hourRows(dayStartMin: number, dayEndMin: number): number[] {
  const out: number[] = [];
  for (let h = Math.floor(dayStartMin / 60) * 60; h < dayEndMin; h += 60) out.push(h);
  return out;
}

/** 480 -> '8 AM', 810 -> '1:30 PM'. */
export function hourLabel(min: number): string {
  return formatClock(min).replace(':00 ', ' ');
}

/** Where a timed card sits in the day box, in minutes from the box's top. Clamped to the box; at least 20 minutes tall. */
export function timedBox(start: number, minutes: number, dayStartMin: number, dayEndMin: number): { top: number; height: number } {
  const span = Math.max(0, dayEndMin - dayStartMin);
  const clamp = (m: number) => Math.min(Math.max(m, 0), span);
  const from = clamp(start - dayStartMin);
  const to = clamp(start - dayStartMin + minutes);
  const height = Math.min(Math.max(to - from, 20), span);
  return { top: Math.min(from, span - height), height };
}

export interface TrayOrigin {
  date: string;
  pct: number;
  note: string | null;
}

/** Where a tray card came from, when the card it was carried from is among the loaded cards. */
export function trayOrigin(card: Card, cards: Card[]): TrayOrigin | null {
  if (card.carried_from_id === null) return null;
  const from = cards.find((c) => c.id === card.carried_from_id);
  if (!from || from.date === null || from.pct === null) return null;
  return { date: from.date, pct: from.pct, note: from.note };
}

/** `50% done`, `done` at 100, `not started` at 0. */
export function pctText(pct: number): string {
  if (pct >= 100) return 'done';
  if (pct <= 0) return 'not started';
  return `${pct}% done`;
}

/** `Saturday: 50% done. "Play date ran long."` */
export function trayOriginText(o: TrayOrigin): string {
  const head = `${weekdayName(o.date)}: ${pctText(o.pct)}.`;
  const note = o.note?.trim();
  if (!note) return head;
  return `${head} "${/[.!?]$/.test(note) ? note : note + '.'}"`;
}

export function campfireText(current: number): string {
  if (current <= 0) return 'Campfire: light it today';
  return `Campfire: ${current} ${current === 1 ? 'day' : 'days'}`;
}

/**
 * The meta line of a card, as separate parts joined with ' · ' on screen. The Must-do
 * mark is drawn by the tile itself (it has an icon). `timeZone` turns "doing since" into a clock time.
 */
export function cardMeta(card: Card, timeZone: string): string[] {
  if (card.drop_requested_at !== null) return ['Waiting for a parent to decide'];
  if (card.place === 'tray') return [`${formatDuration(card.minutes)} left`];
  if (card.place === 'week') return card.kind === 'choice' ? ['My pick'] : [];
  const parts = card.start_min !== null
    ? [formatClock(card.start_min), formatDuration(card.minutes)]
    : [formatDuration(card.minutes)];
  if (card.status === 'resolved' && card.pct !== null) return [...parts, pctText(card.pct)];
  if (card.doing_since !== null) {
    return ['Doing now', `started ${formatClock(minutesInZone(Date.parse(card.doing_since), timeZone))}`];
  }
  return parts;
}

/** Today's open cards: the ones that still need a percent before the day can close. */
export function openCount(cards: Card[], today: string): number {
  return cards.filter((c) => c.date === today && c.status === 'open').length;
}

export function cardCount(n: number): string {
  return `${n} ${n === 1 ? 'card' : 'cards'}`;
}

/** The 'unconfirmed' reminder. */
export function unconfirmedText(n: number): string {
  return n === 1
    ? '1 card from earlier days still needs a percent.'
    : `${n} cards from earlier days still need a percent.`;
}

/** The 'due_soon' reminder; names the card when there is exactly one. */
export function dueSoonText(count: number, cards: Card[]): string {
  const only = cards[0];
  if (count === 1 && cards.length === 1 && only.due_date !== null) {
    return `Must-do due ${weekdayName(only.due_date)}: "${only.title}" is not on a day yet.`;
  }
  const n = Math.max(count, cards.length);
  return n === 1 ? '1 must-do is due soon and not on a day yet.' : `${n} must-dos are due soon and not on a day yet.`;
}

/** The toast after closing a day; `streak` is getToday().streak.current. */
export function closedToastText(streak: number): string {
  return `Day closed. Campfire: ${streak} ${streak === 1 ? 'day' : 'days'}.`;
}

/** The Close out panel's sentence. */
export function closeOutText(open: number): string {
  if (open === 0) return 'Every card has a percent. Close the day to keep the campfire burning.';
  const head = open === 1 ? '1 card still needs a percent.' : `${open} cards still need a percent.`;
  return `${head} When every card has one, close the day to keep the campfire burning.`;
}
