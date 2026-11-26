// Drag and drop (ticket T16): the pure part. Where a dropped card lands and whether it may.
import type { Card, Role } from '../api/types.ts';

/** Where a card was dropped: a day (Week), a time on a day (Today's timeline), or the week's stack. */
export type DropTarget =
  | { kind: 'day'; date: string }
  | { kind: 'time'; date: string; start_min: number }
  | { kind: 'week' };

/** What placeCard() is called with (the same calls as PlaceForm makes). */
export type DropPlace =
  | { place: 'day'; date: string; start_min: number | null }
  | { place: 'week'; week_start: string };

/**
 * The start minute for a drop `offsetPx` below the top of the timeline, where 15 minutes are
 * `slotPx` tall and the day starts at `dayStartMin`. Snapped to 15 minutes, and clamped so the
 * card (of `minutes`) ends by `dayEndMin`. A card longer than the day starts when the day starts.
 */
export function slotFromOffset(offsetPx: number, slotPx: number, dayStartMin: number, dayEndMin: number, minutes: number): number {
  const raw = dayStartMin + (slotPx > 0 ? (offsetPx / slotPx) * 15 : 0);
  const snapped = Math.round(raw / 15) * 15;
  const latest = Math.max(dayStartMin, Math.floor((dayEndMin - minutes) / 15) * 15);
  return Math.min(Math.max(snapped, dayStartMin), latest);
}

/** False for a finished card, and for him on a day that is over. The server still decides. */
export function canDrop(card: Card, targetDate: string, today: string, role: Role): boolean {
  if (card.status === 'resolved') return false;
  if (role !== 'parent' && targetDate < today) return false;
  return true;
}

/**
 * The placeCard() argument for a drop, or null when the card is already there. A card moved
 * to another day keeps its time; a card from a stack goes on the day at any time.
 */
export function dropPlace(card: Card, target: DropTarget, stackWeek: string): DropPlace | null {
  const onDay = card.place === 'day';
  switch (target.kind) {
    case 'week':
      if (card.place === 'week' && card.week_start === stackWeek) return null;
      return { place: 'week', week_start: stackWeek };
    case 'day':
      if (onDay && card.date === target.date) return null;
      return { place: 'day', date: target.date, start_min: onDay ? card.start_min : null };
    case 'time':
      if (onDay && card.date === target.date && card.start_min === target.start_min) return null;
      return { place: 'day', date: target.date, start_min: target.start_min };
  }
}

/** The date a target is judged by in canDrop(): the stack counts as the end of its week. */
export function targetDate(target: DropTarget, stackWeekEnd: string): string {
  return target.kind === 'week' ? stackWeekEnd : target.date;
}
