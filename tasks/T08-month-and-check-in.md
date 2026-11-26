# T08 Month and the Sunday check-in

**Goal.** He sees where the month's time went, which days he closed out, his monthly
goals, and can write the weekly check-in.

**Needs.** T07.

**Read first.** `docs/05-design.md` ("Month"); `design/screens/kid-month.png`;
`docs/04-data-and-api.md` (`getStats`, `getReview`, `saveReview`, `saveGoal`);
`src/lib/board.ts` (`monthGrid`, `percentDone`).

**Files.** Replace `src/screens/kid/Month.tsx`. Create under `src/screens/kid/month/`:
`GoalsPanel.tsx`, `StatTiles.tsx`, `TimeByCategory.tsx`, `DayGrid.tsx`, `CheckInPanel.tsx`,
`CheckInForm.tsx` (+ `.css`); `src/components/CategoryBar.tsx` (+ `.css`);
`src/lib/month.ts`, `tests/unit/month.test.ts`, `e2e/month.spec.ts`.

## Steps

1. **Route and data.** `/month` is the month of `me.today`; `/month/:ym` (`2026-12`) is that
   month; anything else redirects to `/month`.
   ```ts
   const first = firstOfMonth(date), last = lastOfMonth(date);
   const soFar = last < me.today ? last : me.today;          // do not count the future
   const whole = useLoad(() => api.getStats(child.id, first, last), [child.id, first]);      // the calendar
   const done = useLoad(() => first > me.today ? Promise.resolve(null)
     : api.getStats(child.id, first, soFar), [child.id, first, soFar]);                     // tiles and bars
   const board = useLoad(() => api.getBoard(child.id, first, last), [child.id, first]);      // goals
   const review = useLoad(() => api.getReview(child.id, monday(me.today)), [child.id, me.today]);
   ```
   A month entirely in the future shows the goals and the calendar only.
2. **`src/lib/month.ts`** (pure, tested):
   - `daysOnBoard(byDay: StatsDay[]): number`: days with at least one card or a close-out.
   - `closedOfCounted(byDay: StatsDay[], today: string): { closed: number; counted: number }`:
     `counted` = days up to today with no mark that had a card or a close-out; `closed` = those closed.
   - `dayLabel(day: StatsDay, today: string): 'today' | 'rest' | 'away' | 'closed' | 'not_closed' | 'planned' | 'empty'`
     (`not_closed`: before today, has cards, not closed, no mark; `planned`: after today with planned minutes).
   - `tintStep(spentMin: number, maxSpentMin: number): 0 | 1 | 2 | 3`.
   - `parseMonth(ym: string): string | null` (first day, or null when invalid).
3. **`GoalsPanel`**: `board.goals` with `scope === 'month'`; a checkbox toggles
   `status` between `active` and `done`; `Add a goal` → title (and optional category) →
   `saveGoal(child.id, { scope: 'month', period_start: first, title, category_id })`.
4. **`StatTiles`** from `done.totals` and `closedOfCounted(done.by_day, me.today)`; test ids
   from the design guide. Time as `formatDuration`.
5. **`CategoryBar`** (shared) and **`TimeByCategory`**: one bar per category that has planned
   minutes, in category order; the solid part is `spent / max(planned)` of the widest bar,
   the pale part `planned`. Text `{spent} of {planned}`. The bar is decorative
   (`aria-hidden`); the text carries the numbers.
6. **`DayGrid`**: `monthGrid(first)`; days outside the month show only a muted number.
   Each day of the month is a cell with its number and, by `dayLabel`: time spent and a
   check icon (`closed`), `Rest day` / `Away`, `Today`, `Not closed`, `{planned} planned`,
   or nothing. The tint uses `var(--c-blue-tint)`, `var(--c-blue-tint2)` and a third step
   mixed from them with `color-mix(in srgb, ...)`; the legend line is
   `Darker blue means more time spent that day.` Each cell is a link to that day's week
   (`/week/<monday>`), with an `aria-label` such as `December 19: 4 h 50 min, closed out`.
7. **`CheckInPanel`**: shows the answers of the newest week that has a review (look at
   this week, then the previous week: two `getReview` calls at most). The button opens
   `CheckInForm` for **this** week (`monday(me.today)`), prefilled when it exists. Saving
   sends all five fields: `saveReview(child.id, week, { keep, change, stop, start, notes })`.
   Each field is a `<textarea>` with a label and a one-line prompt:
   - Keep: `What worked that I want to keep doing?`
   - Change: `What should work differently next week?`
   - Stop: `What should I stop doing or planning?`
   - Start: `What is one new thing to try?`
   - Notes: `Anything Mom or Dad and I agreed.`

## Browser test `e2e/month.spec.ts`

1. `/month` shows `December 2026`; `Next month` shows `January 2027` at `/month/2027-01`.
2. The tile `stat-closed` reads `2 of 3` (Saturday and Sunday closed, today not yet), and
   `stat-finished` shows `7`.
3. The calendar cell for December 20 has a check and an `aria-label` containing `closed out`;
   December 21 shows `Today`.
4. **Goal.** Tick `Run a one-shot adventure I wrote` → it is checked after a reload and unlock.
5. **Check-in.** `Write this week's check-in` → fill Keep with `The morning focus block` →
   `Save check-in` → the panel shows it under `Keep`, and the button now reads
   `Edit this week's check-in`.
6. `/month/abc` redirects to `/month`.

(In the frozen demo: December 19 has three cards at 100%; December 20 has three at 100% and
one at 50%; today has one at 100%. So finished = 7, partly done = 1, missed = 0, and the
time tile reads `5 h` spent of `8 h` planned.)

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] Compared with `design/screens/kid-month.png` at 1280px; usable at 390px (the calendar
      keeps seven columns and shortens its text; nothing scrolls sideways).
- [ ] The numbers on the tiles equal the numbers from `getStats`; nothing is recomputed from cards.

## Not in this ticket

Charts beyond the bars. Comparing months. Exporting.
