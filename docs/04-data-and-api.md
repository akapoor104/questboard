# Data and API reference

The screens never read tables. They call the typed client in `src/api/client.ts`:

```ts
import { createApi } from '../api/client.ts';
const api = createApi(connection.device);      // or connection.parent
const board = await api.getBoard(childId, '2026-12-21', '2026-12-27');
```

Every method maps to one SQL function in `db/migrations` (and to the same function in the
in-memory backend). All shapes are in `src/api/types.ts`. This file says who may call what
and which errors to expect.

## Conventions

- Ids are UUID strings (categories and library items use readable text ids such as `story`).
- Dates are `'YYYY-MM-DD'`. Weeks start on Monday. Clock times are minutes from midnight
  on a 5-minute grid (`540` = 9:00 AM). Timestamps are ISO strings.
- "Today" is the date in the family's time zone (`whoami().timezone`), decided by the server.
- A failed call rejects with an error whose message contains `QB:<code>`. Turn anything you
  catch into a typed error with `toApiError(e)` from `src/api/types.ts`, then switch on `.code`.

## Callers

| Caller | How the server recognises it |
|---|---|
| `parent` | Signed in with Google, e-mail on the family's list, and has called `claimParent()` once |
| `kid` | A device a parent approved as "his device", unlocked with the PIN (lasts `unlock_minutes`, 12 hours to start) |
| `display` | A device a parent approved as "display only". Read-only |
| `none` | Anything else: no session, a device waiting for approval, a locked device, a stranger |

## Errors

| Code | Meaning | What the screen does |
|---|---|---|
| `not_signed_in` | No session at all | Create the device session, or show parent sign-in |
| `not_parent` | A parent-only function was called by someone else | Should not happen; show the generic message |
| `not_allowed` | The caller may not do this (a display writing, him editing a must-do, a device that is not linked) | Explain kindly; reload |
| `not_allowlisted` | Google account is not on the family's list | "This Google account is not on the parent list." Offer sign-out |
| `not_found` | The card, child or item does not exist (any more) | Reload |
| `locked` | His device is linked but the PIN unlock has run out | Go to the PIN pad |
| `pin_not_set` | A parent has not set a PIN yet | "Ask a parent to set your PIN." |
| `bad_input` | A value is missing, malformed or out of range | Keep the form open, mark the field |
| `bad_code` | Pairing code is wrong or older than 15 minutes | "That code did not work. Check it or get a new one." |
| `bad_token` | Automation only | n/a |
| `past_date` | He tried to plan something in the past | "Pick today or a later day." |
| `future_card` | Resolving a card that is on a later day | "That card is for another day. Move it to today first." |
| `not_open` | The card is already resolved or dropped | Reload |
| `not_resolved` | Reopening a card that is not resolved | Reload |
| `must_needs_parent` | He chose "let it go" for a must-do | Offer "Ask a parent" instead |
| `carry_in_use` | Reopen refused: the leftover card was already started, resolved or carried again | "The leftover from this card was already used, so it cannot be reopened." |
| `open_cards` | Close-out refused: some cards of that day have no percent yet | List them |
| `network` | The request did not reach the server (real backend only) | "No connection. Try again." Keep what was typed |
| `unknown` | Anything else | Generic message; log to the console |

Two test-only codes exist in the in-memory backend: `no_such_function`, `unknown_argument`.
If you ever see one, a call in the screen code is misspelled.

## Session and devices

| Method | Who | What it does | Errors |
|---|---|---|---|
| `whoami()` | anyone | Role, device state, family name, time zone, day start and end, today, now, and the children the caller may see. Never fails for a signed-in caller | `not_signed_in` only inside other calls; `whoami` itself returns `role: 'none'` |
| `claimParent()` | Google account on the list | Makes the caller a parent. Safe to repeat. Returns `whoami()` | `not_signed_in`, `not_allowlisted` |
| `deviceStartPairing(label?)` | an anonymous device session | Returns `{status: 'pending', pair_code, pair_expires_at}` (six characters, valid 15 minutes), or `{status: 'approved'}` if already linked. Calling again makes a new code | `not_signed_in`, `not_allowed` (a parent or Google session) |
| `deviceApprove(code, childId, kind, label?)` | parent | Links the device that shows this code, as `'kid'` or `'display'`. Spaces, dashes and lower case in the code are ignored | `bad_code`, `bad_input`, `not_found` |
| `deviceList()` | parent | Approved devices, oldest first, each with `unlocked` | |
| `deviceRevoke(deviceId)` | parent | Unlinks a device at once (`deviceId` is the row's `user_id`) | `not_found` |
| `setChildPin(childId, pin)` | parent | Sets the PIN (4 to 6 digits; the screens use exactly 4) and locks all his devices | `bad_input`, `not_found` |
| `kidUnlock(pin)` | a linked kid device | `{ok: true, unlocked_until}` or `{ok: false, attempts_left, locked_until}`. Five wrong tries lock PIN entry for five minutes for every device | `not_allowed` (not a linked kid device), `pin_not_set` |
| `kidLock()` | any device | Locks this device now | |

`whoami().device` is `null` until the device has asked for a code. Its `status` is
`pending`, `approved` or `revoked`. A revoked or never-linked device shows the Link screen.

## Settings

| Method | Who | Notes |
|---|---|---|
| `getSettings()` | parent, kid, display | Kid and display get the family name, time zone, day start and end and their child. Parents also get the parent e-mail list, `unlock_minutes`, `catchup_alert_threshold`, `structured_weekly_max_min`, `automation_token_set`, and the parents who have signed in |
| `updateSettings(patch)` | parent | Any subset of the fields. A parent cannot remove their own e-mail. Removing an e-mail signs that parent out for good. `day_start_min` must be before `day_end_min`. Errors: `bad_input` |
| `updateChild(childId, patch)` | parent; kid for `avatar` and `theme` only | `avatar` is an icon key from `AVATAR_ICONS`; `theme` is `'light'` or `'dark'` (anything else, including the default `'forest'`, means light). Errors: `not_allowed`, `bad_input` |
| `rotateAutomationToken()` | parent | Returns `{token}` once. Only its hash is stored, so show it immediately and never again. The old token stops working |

## Board

| Method | Who | What it does | Errors |
|---|---|---|---|
| `getBoard(childId, from, to)` | parent, kid, display | Everything needed to draw a range of at most 63 days: `cards` (on days in range, not dropped), `pool` (open stack cards for weeks touching the range), `tray`, `unconfirmed` (open cards on any past day), `drop_requests`, `goals`, `day_marks`, `closeouts`, plus `today` and `now` | `bad_input`, `locked`, `not_allowed` |
| `addCards(childId, cards)` | parent, kid | 1 to 60 new cards, each to a day (`place: 'day'`, `date`, optional `start_min`) or to a week's stack (`place: 'week'`, optional `week_start`, default this week). His cards are always `kind: 'choice'`; a parent's default to `'must'`. All or nothing | `bad_input`, `past_date` (kid) |
| `updateCard(cardId, patch)` | parent; kid for his own picks | Title, category, minutes, details, due date, goal; parents also `kind`. Open cards only | `not_open`, `not_allowed`, `bad_input` |
| `placeCard(cardId, to)` | parent, kid | Moves an open card to a day (and optional time) or back to a week's stack. Also how a tray card gets "a new time" | `not_open`, `past_date` (kid), `bad_input` |
| `startCard(cardId)` | parent, kid | Marks it "doing now" and puts it on today. Stops any other card that was running | `not_open` |
| `stopCard(cardId)` | parent, kid | Clears "doing now" | |
| `resolveCard(cardId, pct, opts)` | parent, kid | Records the percent and an optional `note`. Under 100, `remainder` decides the leftover: `'tray'` (default), `'day'` (needs `new_date`, optional `new_start_min`) or `'let_go'`. Returns `{card, carry}`; `carry` is the leftover card or `null` | `not_open`, `future_card`, `must_needs_parent`, `bad_input` |
| `reopenCard(cardId)` | parent; kid for today and yesterday | Undoes a resolve: removes the unused leftover and un-closes that day | `not_resolved`, `not_allowed`, `carry_in_use` |
| `dropCard(cardId, reason?)` | parent, kid | His own pick, or any card for a parent: dropped, returns `{requested: false}`. His must-do: marked as a drop request, returns `{requested: true}` | `not_open` |
| `decideDrop(cardId, approve)` | parent | `true` drops the card, `false` clears the request | `not_found` (no request on that card) |
| `deleteCard(cardId)` | parent | Removes a card completely. Prefer drop | `not_found` |
| `closeDay(childId, {date?, mood?, note?})` | parent, kid | Closes today (or an earlier date). `mood` 1 to 5 | `open_cards`, `bad_input` |
| `setDayMark(childId, date, kind, note?)` | parent | `'rest'`, `'away'`, or `null` to clear | `not_parent`, `bad_input` |

How to do the things the mock shows:

| On screen | Calls |
|---|---|
| "To today" on a stack card | `placeCard(id, {place: 'day', date: board.today})` |
| "Give it a time" on a tray card | `placeCard(id, {place: 'day', date, start_min})` |
| Back to the stack | `placeCard(id, {place: 'week', week_start})` |
| "How did it go?" 50 %, leftover to the tray | `resolveCard(id, 50, {note})` |
| ... leftover to a day he picks now | `resolveCard(id, 50, {note, remainder: 'day', new_date, new_start_min})` |
| ... "Let it go" (his own pick) | `resolveCard(id, 50, {note, remainder: 'let_go'})` |
| ... "Ask a parent to let it go" (must-do) | `resolveCard(id, 50, {note})`, then `dropCard(result.carry.id, note)` |
| "Ask to drop" a must-do | `dropCard(id, reason)` → `requested: true` |
| A must-do five times this week | `addCards(childId, [...five copies with place: 'week'])` |
| Preview "about 30 min done, 30 min left over" | `previewResolve(minutes, pct)` from `src/lib/board.ts` (same arithmetic as the server) |

## Goals, library, categories

| Method | Who | Notes |
|---|---|---|
| `saveGoal(childId, goal)` | parent, kid | Without `id`: creates (`scope` `'week'` or `'month'`, `title`, optional `period_start`, `category_id`, `note`). With `id`: updates the given fields; `status` `'active'`, `'done'` or `'dropped'`. `period_start` snaps to the Monday or the first of the month. Errors: `bad_input`, `not_found` |
| `getLibrary()` | parent, kid, display | `{categories, items}`: every category in order (skip those with `active: false`) and the active items, sorted by category then title |
| `saveLibraryItem(item)` | parent; kid for items he created | Create (no `id`) or update. His items get `source: 'kid'`. Errors: `not_allowed`, `not_found`, `bad_input` |
| `archiveLibraryItem(id)` | parent; kid for his own | Hides the item. Cards made from it stay |
| `saveCategory(cat)` | parent | Rename, recolor (`color` is a token name: blue, orange, aqua, yellow, magenta, green, violet, red, slate), change icon, kind, order, or hide. `id` is required; an id that does not exist yet creates a category |

## Daily content, stats, check-ins

| Method | Who | Notes |
|---|---|---|
| `getToday(childId)` | parent, kid, display | `{date, encouragement, parent_note, word, streak: {current, best}, alerts}`. Alerts: `unconfirmed` (count), `tray` (count, minutes), `due_soon` (count), and for parents `drop_requests` (count). Only alerts with a count above zero are present, in that order |
| `markWordUsed(childId, used)` | parent, kid | Ticks or unticks "I used it today" |
| `setParentNote(childId, date, text)` | parent | One note per date, 500 characters; `null` or empty removes it |
| `getStats(childId, from, to)` | parent, kid, display | Up to 401 days. `totals`, `by_category` (planned and spent minutes), `by_day` (one row per date with counts, `closed`, `mark`), `tray`, `streak`, `structured_weekly_max_min`. Counts: `done` = 100 %, `partial` = 1 to 99 %, `missed` = 0 %, `unconfirmed` = open on a past day, `open` = open today or later |
| `getReview(childId, weekStart)` | parent, kid, display | The check-in notes for that week, or `null` |
| `saveReview(childId, weekStart, review)` | parent, kid | Saves all five fields (`keep`, `change`, `stop`, `start`, `notes`); a field left out is cleared, so always send the whole form |

## Backup

| Method | Who | Notes |
|---|---|---|
| `exportData()` | parent | The whole board as one JSON document (`ExportDoc`). No PIN, no token, no e-mail addresses, no devices |
| `importData(doc)` | parent | **Replaces** all board data with the document. Devices stay linked when the child ids match. Returns row counts. Errors: `bad_input` (nothing is changed) |

The same document format is used by `seed/base.json` and by the test fixtures.

## Not in the client: automation and admin

These exist in the database but are not part of `createApi()`; no screen calls them.

| Function | Called by | Purpose |
|---|---|---|
| `automation_summary(p_token, p_from, p_to)` | The parents' Apps Script | One week of stats, leftovers, open must-dos, goals, close-outs and check-in notes per child, plus the parent e-mail list to send to |
| `automation_export(p_token)` | The parents' Apps Script | The backup document, for Google Drive |
| `automation_schedule(p_token, p_from, p_to)` | The parents' Apps Script (phase 2) | Timed cards in a date range, for the calendar that the kitchen display shows |
| `admin_setup(family, timezone, emails, child)` | A parent, once, in the Supabase SQL editor | Names the family, sets the time zone and the parent list, creates the child. Cannot be called through the API |

The token is 64 random characters from `rotateAutomationToken()`. It can read (never
change) the board. Parents can replace it at any time in Settings.

## Tables (for reference only)

All in the private schema `qb`: `app_config` (one row), `parents`, `children`, `devices`,
`categories`, `library_items`, `goals`, `cards`, `day_marks`, `closeouts`, `words`,
`encouragements`, `word_uses`, `parent_notes`, `reviews`. Row-level security is on with no
policies and no grants, so the browser cannot reach them even with a valid session.
`db/migrations/001_schema.sql` is the definition.
