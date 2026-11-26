# Testing

## The layers

| Layer | Where | Runs with | What it proves |
|---|---|---|---|
| Contract tests | `tests/contract/` (sealed) | `npm test` (in-memory backend); `npm run test:pg` (also PostgreSQL) | Every business and security rule, as calls to the 42 API functions |
| Parity tests | `tests/parity/` (sealed) | `npm run test:pg` only | The in-memory backend and the SQL give identical answers to the same random sequences of calls (three seeds, 150 calls each by default; more with `QB_FUZZ_OPS`); the database refuses everything except the API |
| Unit tests | `tests/unit/` | `npm test` | Pure helpers (`src/lib`), demo mode, the e-mail builder |
| Browser tests | `e2e/` | `npm run e2e` or `npm run check:e2e` | The screens, in a real browser, against demo mode |
| Manual checklist | this file | a person | What it is like to use |

`npm run check` runs the first and third layers plus typecheck, guardrails and the build.

Because the demo backend is proven equal to the database, a browser test that passes in
demo mode says the screen is right for the real database too. That is why nobody building
screens needs PostgreSQL.

## Unit tests

Node's own test runner, no extra packages:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentDone } from '../../src/lib/board.ts';

test('percentDone rounds to a whole percent', () => {
  assert.equal(percentDone(350, 310), 89);
});
```

Put logic that can be wrong (grouping, sorting, text for a number) in a function in
`src/lib/` and test it there; keep components thin. Files must import with the `.ts`
extension and avoid `enum` (Node runs them by stripping types).

Run one file: `node --test tests/unit/board.test.ts`.

## Browser tests

`playwright.config.ts` starts its own dev server on port 5174 with `VITE_FORCE_DEMO=1`, so
these tests cannot reach the family's real board. Two projects: `kid` (1280 x 900) runs every
file except `parent.*.spec.ts`; `parent` (a phone) runs only those.

Every test starts from the same frozen moment, built by `openDemo()` in `e2e/helpers.ts`:

> Monday, December 21, 2026, 10:06 AM in Los Angeles. PIN 1234. Today has five cards:
> "Math Academy lesson" (9:00, done), "Outline the winter one-shot" (10:00, doing now),
> "micro:bit: first programs" (11:00), "Outside time" (1:00 PM, must-do), "Help cook dinner"
> (any time). The Catch-up tray holds "Mr Math problem set" (30 min left). Campfire: 2 days.
> The must-do "Pack for the trip" is due Wednesday and is still in the stack, which holds
> 13 cards in all: "Read for fun" x 7, "Music practice" x 4, "Plan the break together" and
> "Pack for the trip". There is a parent note for today. The word of the day is "dilemma".

Each test gets a fresh browser, so a fresh demo. Rules for writing them:

- Start with `openBoard(page)` (his side) or `openParent(page)` (parent side).
- Find things the way a person would: `getByRole('button', { name: 'To today' })`,
  `getByRole('region', { name: 'Catch-up tray' })`, `getByRole('heading', ...)`. Use
  `getByTestId` only for the ids listed in `docs/05-design.md`.
- Assert what the user sees after an action (the card moved, the text changed), not
  implementation details. No `waitForTimeout`; rely on `expect(...).toBeVisible()`.
- One file per ticket, named in the ticket. Never delete or weaken an earlier test to make a
  new screen pass; if an earlier test is now wrong because the design changed on purpose,
  say so in `tasks/STATUS.md` under Notes.

`e2e/smoke.spec.ts` and `e2e/helpers.ts` were written before the screens existed. If a
helper turns out to be wrong about how Playwright behaves (not about the wording), fix the
helper and note it in STATUS.

Useful commands:

```
npx playwright test e2e/today.spec.ts --project kid      one file
npx playwright test --project kid -g "tray"               tests whose name contains "tray"
npx playwright test --ui                                  watch it run (a person at the screen)
npx playwright show-trace test-results/<folder>/trace.zip after a failure
```

## PostgreSQL tests (maintainers only)

Needed only if someone changes the sealed backend, which the tickets never do.

```
# a local PostgreSQL 15+ you can reach as a superuser; never a Supabase project
QB_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:5432/postgres \
QB_PG_URL=postgresql://postgres@127.0.0.1:5432/qb_test bash scripts/pg-test-db.sh
QB_PG_URL=postgresql://postgres@127.0.0.1:5432/qb_test npm run test:pg
```

`db/test/supabase_stubs.sql` makes plain PostgreSQL look like Supabase (the roles and the
`auth.*` helpers) and is stricter than Supabase about privileges: nothing is executable
unless `005_grants.sql` grants it. `db/test/test_helpers.sql` adds a settable clock and
`test_rpc()`. After a deliberate backend change: update both the SQL and the matching file
in `src/api/memory/`, run `npm run test:pg` until both agree, then `node scripts/check.mjs
--reseal`.

## Manual checklist before he starts using it

Do this once with the real site, after ticket T13, on his own device. About 20 minutes.

- [ ] His device shows a code; a parent links it from a phone; the PIN pad appears.
- [ ] A wrong PIN is refused; the right one opens Today.
- [ ] He adds two cards from the Library and writes one of his own.
- [ ] He gives each a day and time; one overlaps another and both stay readable.
- [ ] He starts a card, then says 50% with a reason; a smaller card appears in the tray.
- [ ] He gives the tray card a time tomorrow.
- [ ] A parent adds a must-do; it appears on his board within a minute without reloading.
- [ ] He asks to drop it; the parent sees the request and decides.
- [ ] He closes out the day; the campfire shows 1 day.
- [ ] A parent marks Saturday as Away; his week shows it.
- [ ] The parent phone shows the week's numbers; they match what he did.
- [ ] Lock the board; reload the page; it asks for the PIN again.
- [ ] Settings → Download a backup; the file opens as text and contains his cards.
- [ ] On a second device, without linking: the site shows only a code, nothing else.
- [ ] Ask him: what was confusing? What would you rename? Write it in `tasks/STATUS.md`.
