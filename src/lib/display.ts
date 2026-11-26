import type { Card, DayMark } from '../api/types.ts';
import { formatClock } from './dates.ts';

export interface NowAndNext {
  /** What he is doing now: the card he started, else the timed card whose slot holds the time. */
  now: Card | null;
  /** The first timed card that starts after the time (never `now`). */
  next: Card | null;
  /** The other open timed cards, by start time. */
  later: Card[];
  /** Open cards without a time (never `now`). */
  anytime: Card[];
}

const byStart = (a: Card, b: Card) => (a.start_min as number) - (b.start_min as number) || a.seq - b.seq;

/**
 * The kitchen display's view of today's cards at `nowMin` (minutes from midnight).
 * Only open cards count; resolved and dropped ones are left out.
 */
export function nowAndNext(cards: Card[], nowMin: number): NowAndNext {
  const open = cards.filter((c) => c.status === 'open');
  const timed = open.filter((c) => c.start_min !== null).sort(byStart);
  // If more than one card says "doing", the one started last wins.
  const doing = open.filter((c) => c.doing_since !== null)
    .sort((a, b) => (b.doing_since as string).localeCompare(a.doing_since as string))[0];
  const now = doing
    ?? timed.find((c) => (c.start_min as number) <= nowMin && nowMin < (c.start_min as number) + c.minutes)
    ?? null;
  const next = timed.find((c) => c !== now && (c.start_min as number) > nowMin) ?? null;
  return {
    now,
    next,
    later: timed.filter((c) => c !== now && c !== next),
    anytime: open.filter((c) => c.start_min === null && c !== now),
  };
}

/** True when there is nothing at all to show. */
export function isEmpty(v: NowAndNext): boolean {
  return v.now === null && v.next === null && v.later.length === 0 && v.anytime.length === 0;
}

/** '11:00 AM' for a timed card, 'Any time' for one without a time. */
export function startText(card: Card): string {
  return card.start_min === null ? 'Any time' : formatClock(card.start_min);
}

/** 'Rest day' or 'Away'. */
export function markText(mark: DayMark): string {
  return mark.kind === 'rest' ? 'Rest day' : 'Away';
}
