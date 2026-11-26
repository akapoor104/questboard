// Small pure helpers for the Link screen and the PIN pad.
import type { UnlockResult } from '../api/types.ts';
import { formatClock, minutesInZone } from './dates.ts';

/** 'K7M2QX' -> 'K7M-2QX'. Anything that is not six characters is returned unchanged. */
export function formatPairCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** The sentence under the PIN pad after a failed try, or null after a good one. */
export function pinMessage(result: UnlockResult, timezone: string): string | null {
  if (result.ok) return null;
  if (result.locked_until) {
    const clock = formatClock(minutesInZone(Date.parse(result.locked_until), timezone));
    return `Too many tries. Try again at ${clock}.`;
  }
  const n = result.attempts_left ?? 0;
  return `That PIN did not match. ${n === 1 ? '1 try left.' : `${n} tries left.`}`;
}
