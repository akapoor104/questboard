# Questboard

A planning board that Anush runs himself: he picks cards from a library, gives them a day
and a clock time, says how much he got done, and closes out his day. Parents set a few
must-dos, see where the time went, and get a weekly summary. One family, free hosting, no
ads, no tracking, no AI features inside the app.

This folder is a **build package**. The part that must be right (the database rules, the
security, the arithmetic) is already written and tested. The screens are built from here,
one small ticket at a time, by Claude Code running a smaller model.

## What is in the box

| Folder | What it is | State |
|---|---|---|
| `db/` | The database: tables, 42 API functions, access grants, seed data | Done. Tested against PostgreSQL 16 |
| `src/api/` | A typed client, and the same backend in TypeScript for demo mode and tests | Done. Proven equal to the SQL by tests |
| `src/lib/`, `src/ui/`, `src/app/` | Date and board helpers, design tokens, icons, connection and error text | Done, unit-tested |
| `seed/` | 9 categories, 95 library ideas, 100 words, 60 encouragements, the winter-break starter plan | Done |
| `design/` | Pictures and static pages of all eight screens | Done |
| `docs/` | Product rules, setup guide, architecture, API reference, design guide, testing, phase 2 | Done |
| `tasks/` | 17 tickets with acceptance checks, and the status checklist | Ready to start |
| `automation/` | Google Apps Script for the Sunday e-mail, Drive backup and daily ping | Written; the e-mail builder is tested, the Google parts are first run in ticket T14 |
| `src/screens/`, `src/components/` | The screens | **To build** (tickets T02 to T12) |

## Start

You need Node.js 22.18 or newer, Git, and Claude Code (see `docs/02-setup-guide.md`, part 1).

```
npm install
npx playwright install chromium
npm run check
```

`npm run check` must end with `CHECK PASSED`. Then, in Claude Code, in this folder:

```
/ticket
```

Claude Code reads `CLAUDE.md` and `tasks/STATUS.md`, does the next ticket, runs the checks,
ticks it off, commits, and stops. Start a new session for each ticket. Suggested model: a
Sonnet-class model is enough for every ticket; if a ticket ends up in `tasks/BLOCKED.md`,
that one question can go to a stronger model or to a person.

## How you know it is going well

- After every ticket: `npm run check` (and from T03 on, `npm run check:e2e`) says `CHECK PASSED`.
- From T04 on: `npm run dev`, open http://localhost:5173, PIN **1234**. Compare what you see
  with the pictures in `design/screens/`. This demo keeps its data in that browser only.
- `tasks/STATUS.md` shows what is done and any notes Claude left.
- The sealed backend cannot be changed by a ticket: the check fails and Claude Code's
  project settings refuse the edit.

## Schedule

| When | What | Tickets |
|---|---|---|
| November 14 to December 4 | Build the screens in demo mode | T01 to T12 |
| November 28 to December 6 | Parents create the accounts and put it online | T13 (`docs/02-setup-guide.md`) |
| December 5 to 10 | Trial with Anush; fix what he trips over | checklist in `docs/06-testing.md` |
| December 11 | He starts using it, a week before break | |
| January 4 to 17 | Weekly e-mail and Drive backup, kitchen display, drag and drop | T14 to T16 |
| January 18 to 31 | Kitchen Nest Hub: calendar and spoken reminders | T17 (`docs/07-phase-2.md`) |

## What has and has not been verified

Verified before this package was handed over:

- All 42 API functions, against a real PostgreSQL 16 database and against the in-memory
  copy, with the same 40 contract tests on each; random-sequence tests show the two agree.
- The database refuses direct table access and internal functions for API callers.
- Demo mode, the helpers, the seed data, and the weekly e-mail's content.

Not verified, because it needs your accounts or a browser build:

- `src/api/supabaseBackend.ts` against a real Supabase project (ticket T13 does this first).
- The Google parts of the Apps Script: sending mail, Drive, triggers, calendar (T14, T17).
- `playwright.config.ts`, `e2e/helpers.ts` and `e2e/smoke.spec.ts` have not been run; the
  first tickets run and, if needed, correct them.
- The exact package versions that `npm install` picks. T01 records them.

## Where to read more

- `docs/01-product.md`: how the board behaves, in plain language
- `docs/02-setup-guide.md`: accounts and go-live, step by step
- `docs/03-architecture.md`: the pieces and why it is safe
- `docs/04-data-and-api.md`: every function the screens can call
- `docs/05-design.md`: every screen, with exact wording
- `docs/06-testing.md`: the test layers and the trial checklist
- `docs/07-phase-2.md`: the kitchen Nest Hub
