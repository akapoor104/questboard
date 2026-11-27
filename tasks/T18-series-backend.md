# T18 Repeating cards: the series in the backend

**Goal.** The server knows about series: it saves them, previews them, keeps their cards
filled 28 days ahead, and applies the series rules in `docs/08-repeating-cards.md`.
No screen changes in this ticket.

**Needs.** The December trial finished. T17 is not needed.

**This ticket changes sealed files and is done together with a parent.** It is the one
exception to "never change a sealed file". The parent:

1. allows edits to the sealed paths for this session (the project settings refuse them
   otherwise), and puts them back at the end;
2. reviews the diff of every sealed file;
3. runs `node scripts/check.mjs --reseal` **themselves** at the end. Claude Code never runs it;
4. applies `006_series.sql` to the real Supabase project in the SQL editor (Part C).

**Read first.** `docs/08-repeating-cards.md` (all); `docs/04-data-and-api.md`;
`docs/03-architecture.md`; `docs/06-testing.md` ("PostgreSQL tests"); `db/migrations/001_schema.sql`,
`003_board.sql` (`add_cards`, `resolve_card`, `get_board`), `004_insights.sql`
(`set_day_mark`, `get_today`, `qb.dump`, `qb.load`, `automation_export`), `005_grants.sql`;
`src/api/memory/board.ts` and `core.ts`; `tests/contract/board.test.ts`, `world.ts`;
`tests/parity/fuzz.test.ts`; the T13 entry in `tasks/BLOCKED.md` (Supabase's `safeupdate`).

**Files.** Create `db/migrations/006_series.sql`, `src/api/memory/series.ts`,
`tests/contract/series.test.ts`. Change `src/api/types.ts`, `src/api/client.ts`,
`src/api/memory/board.ts`, `insights.ts`, `backup.ts` (and `memoryBackend.ts` to register
the new module), `tests/parity/fuzz.test.ts`, `tests/contract/world.ts` if a helper is
needed, `db/migrations/005_grants.sql` **only** if grants cannot live in `006`,
`docs/04-data-and-api.md`, `sealed.json` (by the reseal), `tasks/STATUS.md`.
**Never edit 001 to 004**: the live database already ran them. Everything goes in `006`
as `alter table` and `create or replace function`.

## Safety rules for this ticket

- Every `update` and `delete` in `006` has a `where` (Supabase refuses them otherwise; see
  BLOCKED.md, T13).
- PostgreSQL tests run against a **local** PostgreSQL only, never a Supabase project.
- The real project gets `006` only in Part C, after everything is green locally.

## Part A: schema and functions (`006_series.sql` and `src/api/memory/series.ts`)

1. **Tables** (schema `qb`, row-level security on, no grants, like the others):
   - `series`: `id`, `child_id`, `created_by` (`'parent' | 'kid'`), `title`, `category_id`,
     `minutes`, `kind`, `details`, `library_item_id`, `goal_id`, `place` (`'time' | 'day' |
     'week'`), `rule` (jsonb, below), `starts_on`, `end_kind` (`'never' | 'until' | 'count'`),
     `until_date`, `count`, `if_missed` (`'catch_up' | 'let_pass'`), `allows_reschedule`,
     `status` (`'active' | 'ended'`), `created_at`, `updated_at`.
   - `series_skips`: `series_id`, `date`, `slot`, `reason` (`'skipped' | 'rest' | 'away'`),
     primary key `(series_id, date, slot)`.
   - `cards`: add `series_id` (nullable, references `series`), `series_date`, `series_slot`,
     `needs_day` (boolean, default false), and a unique index on
     `(series_id, series_date, series_slot)` where `series_id is not null`.
2. **Rule** (`types.ts`: `SeriesRule`), one of:
   - `{ freq: 'daily' }`, `{ freq: 'weekdays' }`
   - `{ freq: 'weekly', interval: 1..4, days: Weekday[] }` (`1` = Monday ... `7` = Sunday)
   - `{ freq: 'monthly', interval: 1..12, month_days: number[] }` (1 to 31)
   - `{ freq: 'monthly', interval: 1..12, nth: { n: 1..4 | -1, day: Weekday }[] }`
   - `{ freq: 'per_week', times: 1..7 }` (place must be `'week'`)
   - and for `place: 'time'`: `start_min` **or** `times_by_day: Partial<Record<Weekday, number>>`.
3. **`qb.series_dates(series, from, to)`** (SQL) and `seriesDates()` (TypeScript, same
   results): the occurrences `(date, slot, start_min)` between two dates, applying the
   interval from `starts_on`, the end date and the count (counting skipped occurrences).
   `per_week` gives `times` occurrences per week dated the week's Monday, slots `0..times-1`.
4. **`qb.series_fill(child_id)`**: for every active series, makes the missing cards for the
   occurrences from today through today + 27 that have no card and no skip row. Rest/Away
   dates get a skip row (`reason` = the mark), or, when `allows_reschedule`, a card in the
   tray with `needs_day = true`. Idempotent (`on conflict do nothing`). Called at the start of
   `get_board`, `get_today` and `automation_schedule`, and after every series change.
5. **New API functions** (each: SQL in `006`, the same in `series.ts`, a method in
   `client.ts`, a row in `docs/04-data-and-api.md`):

   | Method | Who | What |
   |---|---|---|
   | `previewSeries(childId, draft)` | parent, kid | Saves nothing. Returns `{ total: number \| null, first: SeriesOccurrence[] }` (up to 60): each `{date, start_min, place, outcome: 'card' \| 'skip' \| 'tray', mark, clashes: string[]}`; `clashes` = titles of open timed cards that overlap. `total` is `null` for a series that never ends |
   | `saveSeries(childId, draft)` | parent, kid | Creates the series and fills it. His series are always `kind: 'choice'` and `created_by: 'kid'`. Returns the `Series` |
   | `listSeries(childId)` | parent, kid, display | Active series (and ended ones from the last 60 days), each with `next_date`, `remaining` (`null` = never ends), `skipped` dates ahead |
   | `updateSeries(seriesId, patch, fromDate)` | parent; kid for his own | Rule 3 of the design page. `fromDate` not in the past. Returns the `Series` |
   | `skipSeriesDate(seriesId, date, slot?)` | parent; kid for his own | Rule 4. Errors `bad_input` when the date is not an occurrence |
   | `endSeries(seriesId, fromDate?)` | parent; kid for his own | Rule 8 |

   Errors as usual: `not_allowed` (him on a parent's series, a display), `not_found`,
   `bad_input`, `past_date`.
6. **Changed functions**:
   - `resolve_card`: when the card's series has `if_missed = 'let_pass'`, below 100 makes no
     leftover, ignores `remainder`, and never raises `must_needs_parent`.
   - `set_day_mark`: marking Rest/Away applies rule 5 to open, not-started series cards on that date.
   - `place_card`: placing a `needs_day` card clears `needs_day`.
   - `get_board`: cards carry `series_id`, `series_date`, `needs_day`; the result adds
     `series` (the series that have a card in range).
   - `qb.dump`/`qb.load` and `exportData`/`importData`: tables `series` and `series_skips`;
     a document without them still loads (`ExportDoc` gets two optional arrays).
7. Grants: the six new functions to the API roles, exactly like the others in `005`.

## Part B: tests

1. **`tests/contract/series.test.ts`**, at least: each rule kind over a month boundary and a
   leap day; every 2 weeks; 1st and 3rd Saturday; "last Sunday"; the 31st skipped in
   February; count with a skip makes 9 of 10; never-ending fills exactly 28 days and fills
   more the next day; a Rest day skips, and with `allows_reschedule` goes to the tray with
   `needs_day`; a mark set after filling; change from a date removes his moved cards too and
   keeps resolved ones; skip; end; `let_pass` below 100 makes no leftover for a must-do he
   resolves; him on a parent's series → `not_allowed`; display → `not_allowed`; export then
   import round-trips series.
2. **`tests/parity/fuzz.test.ts`**: add the six functions and `set_day_mark` on series
   dates to the random operations.
3. `npm test` (in-memory), then `npm run test:pg` against a local PostgreSQL
   (`docs/06-testing.md`), with `QB_FUZZ_OPS=600` once. Both green, then the parent reseals.

## Part C: the real database (with the parent)

1. The parent makes a backup (Settings → `Download a backup`) first.
2. The parent runs `006_series.sql` in the Supabase SQL editor. Copy any error into
   `tasks/BLOCKED.md` and stop.
3. On the live site, nothing visible changes (no screen uses series yet), and Today, Week,
   a resolve and a restore of the backup from step 1 still work.

## Done when

- [ ] `npm run check` passes after the parent's reseal; `npm run test:pg` passes.
- [ ] `npm run check:e2e` passes (no screen changed, so every earlier test is green).
- [ ] `docs/04-data-and-api.md` lists the new functions and the changes; the function count is updated.
- [ ] Part C done and ticked by the parent; the date is in `tasks/STATUS.md`.
