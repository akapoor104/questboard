// One friendly sentence for every error the backend can raise. Screens show
// errorText(e) and never a raw error.
import { toApiError, type ErrorCode } from '../api/types.ts';

const TEXT: Record<ErrorCode, string> = {
  not_signed_in: 'This device is not signed in yet. Reload the page.',
  not_parent: 'Only a parent can do that.',
  not_allowed: 'That is not something you can change here.',
  not_allowlisted: 'This Google account is not on the parent list.',
  not_found: 'That is not there any more. The page has been refreshed.',
  locked: 'Your board is locked. Enter your PIN to carry on.',
  pin_not_set: 'Ask a parent to set your PIN.',
  bad_input: 'Something in that form is missing or not quite right.',
  bad_code: 'That code did not work. Check it, or get a new one on the device.',
  bad_token: 'That key is not valid any more.',
  past_date: 'Pick today or a later day.',
  future_card: 'That card is for another day. Move it to today first.',
  not_open: 'That card was already finished or dropped.',
  not_resolved: 'That card is not finished, so there is nothing to undo.',
  must_needs_parent: 'A must-do can only be let go by a parent. You can ask them.',
  carry_in_use: 'The leftover from this card was already used, so it cannot be reopened.',
  open_cards: 'Some cards for that day still need a percent.',
  network: 'No connection. Check the internet and try again.',
  unknown: 'Something went wrong. Try again.',
};

export function errorCode(err: unknown): ErrorCode {
  const code = toApiError(err).code;
  return code in TEXT ? code : 'unknown';
}

export function errorText(err: unknown): string {
  return TEXT[errorCode(err)];
}

/** True when the fix is to show the PIN pad again. */
export function isLocked(err: unknown): boolean {
  return errorCode(err) === 'locked';
}
