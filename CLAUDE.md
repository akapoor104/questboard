# Questboard: instructions for Claude Code

Questboard is a family planning board for one child (Anush, 10) and his two parents.
He plans his own week and day on a kanban-style board; parents set a few must-dos and
see a weekly summary. Read `docs/01-product.md` once before your first ticket.

The backend (database rules, an in-memory copy of them, and the tests for both) is
**finished and sealed**. Your job is the web app's screens, built **one ticket at a time**.

## How to work

1. Run `/ticket` (or `/ticket T05` for a specific one). It walks you through the loop below.
2. One ticket per session. Read `tasks/STATUS.md`, take the first ticket that is not ticked.
3. Read the whole ticket and the files it lists under "Read first" before writing code.
4. Change only the files the ticket lists. Small steps; run `npm run check:quick` often.
5. Finish with `npm run check` (and `npm run check:e2e` when the ticket has browser tests).
6. Confirm every line of the ticket's "Done when" list by running or looking, not by assuming.
7. Tick the ticket in `tasks/STATUS.md`, commit as `T05: <title>`, report, and stop.

Never start the next ticket in the same session. Never mark a ticket done while a check fails.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | The app at http://localhost:5173. With no `.env.local` it runs in demo mode (PIN 1234). |
| `npm run check:quick` | Sealed files, seed data, guardrails. Two seconds. |
| `npm run check` | The above plus typecheck, unit and contract tests, production build. |
| `npm run check:e2e` | Everything, then the browser tests in `e2e/` (demo mode, port 5174). |
| `npm test` | Unit and contract tests only. |
| `node --test tests/unit/board.test.ts` | One test file. |
| `npx playwright test e2e/today.spec.ts --project kid` | One browser test file. |

## Map

```
CLAUDE.md, README.md      you are here; README is for the parents
docs/                     product, setup guide, architecture, API, design, testing, phase 2
tasks/                    STATUS.md (the checklist), one file per ticket, BLOCKED.md
design/screens/*.png      what each screen should look like; design/mock/*.html is the source
db/migrations/*.sql       SEALED  the real backend: tables and the 42 API functions
db/seed.sql               generated from seed/*.json by `npm run seed:sql`
seed/                     starter library, words, encouragements, winter-break plan
src/api/types.ts          SEALED  every type the API returns
src/api/client.ts         SEALED  createApi(): one typed method per API function
src/api/memory/           SEALED  the same backend in TypeScript (demo mode and tests)
src/api/demo.ts           demo mode: a whole family in localStorage
src/api/supabaseBackend.ts  the real connection (checked in ticket T13)
src/lib/dates.ts          SEALED  date and time helpers; use these, not your own
src/lib/board.ts          tested helpers: layoutDay, nextFreeSlot, previewResolve, ...
src/ui/tokens.css         every color, size and font as a CSS variable
src/ui/icons.ts           every icon, by key
src/app/, src/components/, src/screens/   YOURS: created by the tickets
tests/contract, tests/parity   SEALED  the backend's tests
tests/unit/               tests for src/lib and demo mode; add yours here
e2e/                      browser tests (Playwright); add one file per ticket
automation/apps-script/   the parents' weekly e-mail and backup script (ticket T14)
```

## Sealed files

Sealed: `db/migrations/`, `db/test/`, `src/api/types.ts`, `src/api/client.ts`,
`src/api/memoryBackend.ts`, `src/api/memory/`, `src/lib/dates.ts`, `tests/contract/`,
`tests/parity/`, `scripts/check.mjs`, `scripts/run-tests.mjs`, `sealed.json`.

They hold the security rules and the business rules, and they were tested against a real
PostgreSQL database. `npm run check` fails if any of them changes, and the project
settings refuse the edit. If a sealed file seems wrong or seems to be missing something:

- First assume the screen should adapt. Re-read `docs/04-data-and-api.md`; the API almost certainly
  already does what you need (for example "ask a parent to let it go" is `resolveCard` then
  `dropCard` on the carry card).
- If you still think it is wrong, stop and write it up in `tasks/BLOCKED.md`. Do not work
  around it, do not copy the logic into the screen, and never run `--reseal`.

## Rules that are never broken

1. **All data goes through `createApi()`** (`src/api/client.ts`). No Supabase table access
   (`.from(...)`), no `rpc()` in screens, no second copy of a business rule in the UI.
   The server decides; the screen shows what the server returned and reloads after a change.
2. **No secrets in the app.** Only the Supabase URL and the *publishable* key, from
   `import.meta.env`. Never a secret or service-role key, never a parent's e-mail in code.
3. **Nothing leaves the family.** No analytics, no error reporting service, no fonts or
   scripts from other sites, no AI features, no external images.
4. **Text is rendered as text.** Never `dangerouslySetInnerHTML`. Titles and notes are typed
   by a child and by parents.
5. **He never sees the parent side.** Parent screens need a parent session. His PIN is
   checked by the server only; never compare PINs in the browser, never store one.
6. **No new npm packages** unless the ticket names them. No UI kit, no state library, no
   date library, no drag-and-drop library.
7. **Browser tests never touch real data.** They run in demo mode only (`playwright.config.ts`).

## Code conventions

- TypeScript, strict. Imports of local files end in `.ts` or `.tsx`. Use `import type` for
  types. No `enum`, no `namespace`, no constructor parameter properties (the tests run on
  Node's built-in type stripping).
- React function components and hooks only. One component per file; file name = component
  name. Screens in `src/screens/<area>/`, shared pieces in `src/components/`.
- Components in `src/components/` and the parts of a screen receive `api`, `childId` and
  `role` as props; only screens and layouts call `useSession()`. That is what lets the
  parent screens reuse his card sheet, forms and dialogs.
- State: `useState`/`useReducer` and the `useLoad` hook from T02. After every change call
  `reload()`; do not patch local copies of server data (no optimistic updates).
- Errors: wrap calls with the `useAction` helper from T02. Show `errorText(code)` from
  `src/app/errors.ts`. Never show a raw error or a stack trace to the child.
- Dates are `'YYYY-MM-DD'` strings and clock times are minutes from midnight. "Today" is
  what the server says (`whoami().today`, `board.today`), in the family's time zone, never
  `new Date()` in the browser's own zone. Use `src/lib/dates.ts` for all date math and text.
- CSS: plain CSS files next to the component, class names prefixed by the component
  (`.today-`, `.card-`). Colors, spacing, radii and fonts only through the variables in
  `src/ui/tokens.css`. A category is always shown with its icon and name, never by color alone.
- Icons: `<Icon name="tent" />` from T02, keys from `src/ui/icons.ts`. No emoji anywhere.
- Accessibility is part of "done": real `<button>`s, visible focus, labels on inputs,
  touch targets at least 44px, headings in order, dialogs that trap focus and close on Escape,
  `role="alert"` for errors. Everything works by keyboard and by touch; hover is never required.
- Wording: the exact headings and button names in `docs/05-design.md` are a contract; the
  browser tests look for them. Sentence case. Friendly, short, never scolding.
- Tests: every ticket that adds logic adds a unit test for it; every ticket that adds a
  screen adds a browser test file named in the ticket. Tests find things by role and name
  first, `data-testid` second (the ids are listed in `docs/05-design.md`).

## Definition of done (every ticket)

- `npm run check` prints `CHECK PASSED` with no `FAIL`; from T02 on there is no `SKIP`
  for typecheck or build.
- Tickets with screens: `npm run check:e2e` passes, including all earlier browser tests.
- You opened the screen in `npm run dev`, compared it with `design/screens/<name>.png`,
  and tried it at 1280px, 820px and 390px wide (parent screens: 390px first).
- No `console.error` or React warning in the browser console while using the screen.
- `tasks/STATUS.md` is ticked and the work is committed.

## When you are stuck

Three honest attempts, then stop. Write in `tasks/BLOCKED.md`: the ticket, what you tried,
the exact error, and the smallest question a person could answer. Leave the ticket unticked.
Commit work in progress on the same branch with the message `T05 (blocked): ...`.
