# Status

Tick a ticket only when every line of its "Done when" list is true and the checks pass.
One ticket per Claude Code session. Add a dated line under Notes for anything surprising.

## Core: build in demo mode (November 14 to December 4)

- [x] T01 Install and check the toolchain
- [x] T02 App shell: connection, session, routes, shared pieces
- [ ] T03 Link this device and the PIN pad
- [ ] T04 Today, read-only
- [ ] T05 Card actions: start, how did it go, move, drop, undo
- [ ] T06 Close-out, reminders, word of the day, profile
- [ ] T07 Week and the Library
- [ ] T08 Month and the Sunday check-in
- [ ] T09 Parents: sign-in and This week
- [ ] T10 Parents: Must-dos
- [ ] T11 Parents: Settings
- [ ] T12 Polish: small screens, keyboard, dark theme, empty and error states

## Go live (November 28 to December 6, with a parent)

- [ ] T13 Supabase, Google sign-in, Cloudflare Pages
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
