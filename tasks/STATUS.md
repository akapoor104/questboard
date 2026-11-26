# Status

Tick a ticket only when every line of its "Done when" list is true and the checks pass.
One ticket per Claude Code session. Add a dated line under Notes for anything surprising.

## Core: build in demo mode (November 14 to December 4)

- [x] T01 Install and check the toolchain
- [x] T02 App shell: connection, session, routes, shared pieces
- [x] T03 Link this device and the PIN pad
- [x] T04 Today, read-only
- [x] T05 Card actions: start, how did it go, move, drop, undo
- [x] T06 Close-out, reminders, word of the day, profile
- [x] T07 Week and the Library
- [x] T08 Month and the Sunday check-in
- [x] T09 Parents: sign-in and This week
- [x] T10 Parents: Must-dos
- [x] T11 Parents: Settings
- [x] T12 Polish: small screens, keyboard, dark theme, empty and error states

## Go live (November 28 to December 6, with a parent)

- [x] T13 Supabase, Google sign-in, Cloudflare Pages
- [ ] Trial checklist in `docs/06-testing.md` done with Anush (December 5 to 10)

## Extras (January)

- [ ] T14 Weekly e-mail and Drive backup (with a parent)
- [ ] T15 Kitchen display screen
- [ ] T16 Drag and drop
- [ ] T17 Nest Hub: calendar and spoken reminders (with a parent)

## Installed versions (filled in by T01)

| Package | Version |
|---|---|
| node | v24.12.0 |
| react | 19.3.1 |
| react-router-dom | 7.18.7 |
| @supabase/supabase-js | 2.119.2 |
| vite | 7.3.8 |
| typescript | 6.0.3 |
| @playwright/test | 1.65.1 |

## Notes

- 2026-11-25 (T02): `e2e/smoke.spec.ts` still fails until T03 builds the PIN pad, so `npm run check:e2e` is red until then; the T02 browser files pass. TopBar and ParentFrame call `useSession()` themselves (they are layouts); the layouts are composed inline in `App.tsx` with `<Outlet />`. The `Demo` chip style is `.demo-badge` in `src/ui/app.css`.
- 2026-11-25 (T03): `check:e2e` is green again. The PIN pad sends the PIN from an effect that watches the digits (so fast keyboard typing never loses a digit). Code expiry on the Link screen is judged against the server's `whoami().now`, not the browser clock. The demo device label is `This browser`. The revoked wording could not be tried by hand yet (revoking needs parent Settings, T11).
- 2026-11-25 (T04): Step 12's shared getToday lives in a small context, `src/app/TodayProvider.tsx` (`useTodayData()`), wrapped around the kid layout in `src/App.tsx`; those are the two files outside the ticket's list. Call `useTodayData().reload()` after changes in T05/T06. The now line keeps its time label and the hour label it would touch is hidden (as `docs/05-design.md` says; the ticket's step 9 says the opposite). The stack's `{n} cards` counts every card, not tiles (13 in the demo). Below 700px the timeline uses `--slot: 24px` so a 30-minute card fits its title and its time. Extra helpers in `src/lib/today.ts` (`cardMeta`, `timedBox`, `trayOriginText`, reminder sentences) are unit-tested.
- 2026-11-25 (T05): Today keeps one `CardSheet` open and always hands it the board's newest copy of the card, so a refused change shows the fresh state under the error. Inline buttons (`Give it a time`, `Drop it`, `Ask to drop`, `How did it go?`) open the sheet straight on that form (`start` prop); Cancel there closes it. The sheet remounts per form (keyed), so focus moves into each one and returns to the card at the end. `PlaceForm` also takes `timeZone`, `initialDate` and `onChange` (the resolve dialog has its own Save). Extra tested helpers in `src/lib/cardActions.ts`: `suggestStart`, `whereText`, `dayName`. Two demo tabs do not share state (each loads localStorage once), so the "refused change" browser test uses `carry_in_use` instead of two tabs.
- 2026-11-25 (T06): Outside the file list: `Today.tsx` (holds the close-out and unconfirmed dialogs), `CloseOutDialog.css` and `UnconfirmedSheet.css`, `closedToastText` in `src/lib/today.ts` (unit-tested), and `Sheet.css` plus `WordPanel.css` dark rules: in dark `--ink` turns light, so the dialog backdrop and the word panel (both drawn with `--ink`) became white boxes. The theme effect lives in `TopBar` (the kid layout piece that already reads the session). The close-out toast reads the campfire from a fresh `getToday()` right after `closeDay`. "Give it a day" reuses the card sheet's place form (`start="give_time"`, no stack). "Change my note" saves with the toast `Saved.`. Seen but not fixed (T04 layout, for T12): at 820px a timed card that is "Doing now" squeezes its title to one letter per line.
- 2026-11-25 (T07): Outside the file list: `PlaceForm.tsx` got the `days` prop, and `CardSheet.tsx` passes it on (`placeDays`) along with `stackWeek` (so "This week's stack" means the shown week, or this week when the shown one is over). Focus chips show active and done goals (done struck through); dropped ones are hidden, and the three-goal limit counts active ones only. The server does not cap goals at three: only the sheet does. In the demo the current week starts with two focus goals, not three. A day add makes the toast `Added to {Weekday}`. The demo answers instantly, so the 10-quick-adds test taps each button twice in one tick (it fails without the guard in `LibraryPanel`). Library `All` shows all 95 ideas in one long grid; a parent may want a shorter default.
- 2026-11-25 (T08): Outside the file list: `Month.css` (the page layout, like `Week.css`). The demo has no check-in yet, so the panel starts with `No check-in yet. On Sunday, sit down with Mom or Dad and write the first one.`; saving shows the toast `Check-in saved.`. Tint steps: under 60% of the busiest day's time, under 90%, the rest; today and rest/away days are not tinted (as in the picture). On a phone the calendar shows short text (`2h30`, `Rest`, `15m`); each cell's `aria-label` keeps the full sentence. In the frozen demo December 19 has 2 h spent, not the picture's 4 h 50. Extra tested helpers in `src/lib/month.ts`: `shiftMonth`, `monthParam`, `monthDay`, `boardLine`, `shortDuration`, `cellAriaLabel`. In a git worktree whose `node_modules` is linked from the main checkout, Vite refuses the bundled fonts (403 in the console); that is the worktree setup, not the app.
- 2026-11-25 (T09): "Needs you" reads this week's board (`getBoard(thisMonday, +6)`), not the shown week's: drop requests, unconfirmed cards, due-soon must-dos and the tray are about now, and an older week's board would miss this week's stack. Tiles, Load check, Time by category and Check-in follow `?week=`. Outside the file list: `useCategories(from?)` now takes an optional api, so parent screens load categories with `parentApi` (they have no device session), plus `Home.css`. The Load check uses `formatDuration`, so it reads `9 h 40 min` where the picture says `9 h 40`; equal reads `... so this week is exactly your guide.`. A bad `?week=` goes to `/parent`, a non-Monday to its Monday. A non-parent could not be tried by hand in demo mode; the gate is `ParentGate` (role must be `parent`).
- 2026-11-25 (T10): Outside the file list: `LibraryPanel.tsx` got an optional `onPick` (a `Pick` button per idea, no `New card`) for the must-do form's `Pick from the Library`, and `Plan.css`. The focus chips are drawn in `Plan.tsx` (`FocusChips` has his heading and `Edit focus`). A single-card group says `to place` / `placed`, not `all 1 placed`. `Remove all that are still open` confirms with `Remove all {n} open cards? Finished ones stay.` / `Keep them` / `Remove them`. The `Add` guard is a ref: `useAction`'s busy alone let two presses in one tick add 14 cards (the browser test proves it). Focus is put back by hand where a pressed button disappears or is disabled while saving (picker switch, remove buttons, day buttons); without it Escape stopped closing the sheet. The note input is labelled `Note for today` / `Note for tomorrow` (screen-reader only); saving it empty removes the note (toast `Note removed.`).
- 2026-11-26 (T11): Outside the file list: `Settings.css` (shared `settings-` panel, row and field classes). As in the picture, the PIN, Parents and Weekly e-mail panels are rows in one panel and expand in place (`Change`, `Edit`, `New key`); Parents also lists the addresses with `You` / `Has signed in` / `Not signed in yet`. Confirms use `Sheet`: `Remove this device?` (`Keep it` / `Remove`), `Make a new key?`, `Reset the demo?`; the restore dialog's `Restore` stays disabled until `RESTORE` is typed. After a restore every panel remounts (a key) and settings, devices and the parent session reload. `Hi, Anush` is the PIN pad's heading, not Today's. The parents' add form needs `noValidate`, or the browser's own e-mail check hides the friendly sentence. Extra tested helpers in `src/lib/settings.ts`: `deviceName`, `backupSummary`, `timeZoneOptions`, minutes/time/hours converters, `familyForm`/`familyPatch` (only changed fields; a day ending at midnight is not resent), `parentsLine`.
- 2026-11-26 (T12): The build was already 721 kB of JavaScript before this ticket: every browser downloaded both backends (the Supabase client, about 230 kB, and the demo backend with its seed data, about 95 kB) though it only uses one. Outside the file list, `src/app/connection.ts` now loads the chosen backend with a dynamic `import()`, through a small `lazyConnection()` added to `src/api/connection.ts` (it has to live under `src/api/`, where `.rpc(` is allowed). Now: app 400 kB + demo 94 kB in demo mode, app 400 kB + Supabase 228 kB for real. All the `.js` files added together are still 723 kB; no browser loads them all, but a person may want to confirm that reading of "under 700 kB". The `/_error` route and `ErrorPreview` are also outside the list (`src/App.tsx`). axe (WCAG 2 A/AA) found no serious or critical issues in either theme, so no token color needs a decision. Small tap targets fixed without changing the look: a card's title button now covers the whole card (its own buttons sit above), and `.btn-small` takes taps over 44px. A 45-minute-or-longer timeline card with "How did it go?" puts its time under the title (the 820px "one letter per line" from T06). Every browser test also passed once in an 820x1180 touch window (a throwaway config, not committed). Not testable in demo mode: "a must-do appears within a minute without reloading" (two tabs do not share demo state).
- 2026-11-26 (T13): Site: https://questboard-ytc.pages.dev (Cloudflare Pages, real Supabase project; no Demo chip). Supabase turns on `safeupdate` for the Data API role, which refused every `UPDATE`/`DELETE` without `WHERE` inside the sealed functions (New key, saving settings, restore). A parent chose to fix the migrations (`where id` / `where true`) and resealed; see `tasks/BLOCKED.md`. The weekly e-mail's `sendTestToMe` works. Vite reads `.env.local` only at start: keys made before restarting `npm run dev` were demo keys. A `dist` built before `.env.local` existed is a demo build; check with `grep -l <project ref> dist/assets/*.js`. A parent ticked every box in Parts A to C on the live site on 2026-11-26; `npm run check:e2e` passes with `.env.local` present.
