// Which buttons a card gets, and the words around "How did it go?". Pure, no React:
// covered by tests/unit/cardActions.test.ts. Every screen asks cardActions() so they agree.
import type { Card } from '../api/types.ts';
import { nextFreeSlot, previewResolve } from './board.ts';
import { addDays, formatClock, formatDuration, weekdayName } from './dates.ts';

export type CardAction = 'start' | 'stop' | 'resolve' | 'to_today' | 'move' | 'give_time'
  | 'edit' | 'drop' | 'ask_drop' | 'undo';

/** The button text for each action (docs/05-design.md, "Card sheet"). */
export const ACTION_LABEL: Record<CardAction, string> = {
  start: 'Start',
  stop: 'Stop',
  resolve: 'How did it go?',
  to_today: 'To today',
  move: 'Move',
  give_time: 'Give it a time',
  edit: 'Edit',
  drop: 'Drop it',
  ask_drop: 'Ask to drop',
  undo: 'Undo',
};

/** The buttons a card gets, in the order the sheet shows them. */
export function cardActions(card: Card, today: string, role: 'kid' | 'parent'): CardAction[] {
  const parent = role === 'parent';
  if (card.status === 'dropped') return [];
  if (card.status === 'resolved') {
    const recent = card.date !== null && card.date >= addDays(today, -1);
    return parent || recent ? ['undo'] : [];
  }

  const canEdit = parent || card.kind === 'choice';
  const dropAction: CardAction[] = card.drop_requested_at !== null ? []
    : parent || card.kind === 'choice' ? ['drop'] : ['ask_drop'];
  const edit: CardAction[] = canEdit ? ['edit'] : [];

  if (card.place === 'tray') return ['give_time', ...(parent ? edit : []), ...dropAction];
  if (card.place === 'week') return ['to_today', 'move', ...edit, ...dropAction];
  // On a day.
  if (card.date === null || card.date === today) {
    return [card.doing_since !== null ? 'stop' : 'start', 'resolve', 'move', ...edit, ...dropAction];
  }
  if (card.date > today) return ['move', ...edit, ...dropAction];
  return ['resolve', 'move', ...(parent ? ['edit' as const] : [])];
}

/** The two preview sentences under the percent buttons. */
export function resolveText(minutes: number, pct: number): { done: string; left: string } {
  const { spent, left } = previewResolve(minutes, pct);
  if (pct >= 100) return { done: `All ${formatDuration(minutes)} done. Nice work.`, left: 'Nothing left over.' };
  const done = spent <= 0 ? 'Nothing done this time.' : `About ${formatDuration(spent)} done.`;
  return { done, left: `${formatDuration(left)} left over.` };
}

/** Today and the next six days: `Today`, `Tue 22`, ... */
export function placeDays(today: string): { date: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return { date, label: i === 0 ? 'Today' : `${weekdayName(date, true)} ${Number(date.slice(8))}` };
  });
}

/** `Today`, `Tomorrow`, or `Tuesday, Dec 22` style short names for a date. */
export function dayName(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  return `${weekdayName(date)} ${Number(date.slice(8))}`;
}

/** Where a card sits and for how long, for the card sheet: `Today · 10:00 AM · 45 min`. */
export function whereText(card: Card, today: string): string {
  if (card.place === 'tray') return `Catch-up tray · ${formatDuration(card.minutes)} left`;
  if (card.place === 'week') return `This week's stack · ${formatDuration(card.minutes)}`;
  const day = card.date === null ? 'Today' : dayName(card.date, today);
  const time = card.start_min === null ? 'Any time' : formatClock(card.start_min);
  return `${day} · ${time} · ${formatDuration(card.minutes)}`;
}

/** Minutes from midnight rounded up to the 5-minute grid. */
export function roundUp5(min: number): number {
  return Math.ceil(min / 5) * 5;
}

export interface SuggestInput {
  /** The card being placed (it is never in its own way). */
  card: Pick<Card, 'id' | 'minutes'>;
  date: string;
  today: string;
  /** The family's clock now, in minutes from midnight. */
  nowMin: number;
  day_start_min: number;
  day_end_min: number;
  /** That day's cards, or null when the day is outside the loaded board. */
  dayCards: Card[] | null;
}

/**
 * The time PlaceForm starts on: the first free slot from now (today) or from the day's
 * start (other days). Null means "Any time" (nothing fits). Unknown days get the day's start.
 */
export function suggestStart(s: SuggestInput): number | null {
  const from = s.date === s.today ? Math.max(roundUp5(s.nowMin), s.day_start_min) : s.day_start_min;
  if (s.dayCards === null) return from + s.card.minutes <= s.day_end_min ? from : null;
  const others = s.dayCards.filter((c) => c.id !== s.card.id);
  return nextFreeSlot(others, s.card.minutes, from, s.day_end_min);
}
