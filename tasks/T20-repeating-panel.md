# T20 Repeating cards: see, change, skip and end a series

**Goal.** Once a series exists, a parent (or Anush, for his own) can see all of them in one
place and change, skip a date in, or end one, in a couple of taps. A card from a series
says so.

**Needs.** T19.

**Read first.** `docs/08-repeating-cards.md` (rules 1 to 8); `docs/04-data-and-api.md`
(`listSeries`, `updateSeries`, `skipSeriesDate`, `endSeries`, the `needs_day` field);
`src/screens/parent/Plan.tsx` and `plan/MustDoList.tsx`; `src/screens/kid/Week.tsx`;
`src/components/CardSheet.tsx`, `ResolveDialog.tsx`, `CardTile.tsx`; `src/lib/repeat.ts`.

**Files.** Create `src/components/SeriesList.tsx`, `src/components/SeriesSheet.tsx`
(+ `.css`), `tests/unit/seriesList.test.ts` (for any helper added to `src/lib/repeat.ts`),
`e2e/series.spec.ts`. Change `Plan.tsx`, `Week.tsx`, `CardSheet.tsx`, `ResolveDialog.tsx`,
`CardTile.tsx` (+ `.css`), `src/lib/repeat.ts`, `docs/05-design.md`, `tasks/STATUS.md`.

## Steps

1. **`SeriesList`** (props: `api`, `childId`, `role`, `series`, `onOpen`): one row per
   series: category icon and name, title, `ruleText`, and `{n} left` / `Until {date}` /
   `No end`, plus `Next: {weekday} {time}`. Empty: `Nothing repeats yet.`
   - Parent Must-dos: panel `Repeating`, all series, under `Must-dos this week`.
   - His Week: panel `Repeating`, his own series with buttons; a parent's series listed
     without buttons (he can see the plan, not change it).
2. **`SeriesSheet`** (title = the series title): the rule, the end, *If missed*, the next
   dates (from `listSeries`), and buttons, each confirmed in place:
   - `Change from...`: a date (today or later; default the next occurrence) and the
     `RepeatField` from T19, prefilled; the preview says
     `{n} upcoming cards will be made again, including ones moved by hand.` → `Save changes`.
   - `Skip a date`: the next 8 dates as buttons → `Skip {date}?` → `Skip it`. With
     reschedule allowed: `It goes to the Catch-up tray to get a new day.`
   - `End it`: `Stop repeating from {date}? Finished cards stay.` → `End it` / `Keep it`.
3. **Cards from a series.**
   - `CardSheet` shows `Repeats: {ruleText}`. A parent, or him on his own series, also gets
     `Change the series` (opens `SeriesSheet`). Moving one card stays `Move`, as today.
   - A tray card with `needs_day` shows `Needs a new day` instead of where it came from.
   - `ResolveDialog`, for a `let_pass` series below 100 %: the `What happens to the time left?`
     fieldset is replaced by `This repeats, so nothing is left over.`, and Save sends no
     `remainder`.
4. After every change: `reload()` the board and the series list; toasts `Changed.`,
   `Skipped {weekday}.`, `Ended. Finished cards stay.`

## Browser test `e2e/series.spec.ts`

1. Parent: with the piano series from T19's test, `Change from...` the next Tuesday to
   Wednesday 5:00 PM → the Tuesday cards from then on are gone, Wednesday ones are there,
   including one he had moved to Thursday (moved back to Wednesday by the change).
2. `Skip a date` removes that card; the row's count goes down by one (9 left of 10 total).
3. With reschedule allowed, a Rest mark on an occurrence puts the card in his Catch-up tray
   with `Needs a new day`.
4. `End it` → no more cards from today on; yesterday's resolved card is still there.
5. Him: his own series has buttons; the parent's has none; `Change the series` is not
   offered on a parent's series card.
6. A `let_pass` must-do resolved at 50 % makes no leftover and asks no parent.

## Done when

- [ ] `npm run check:e2e` passes, including every earlier browser test.
- [ ] Tried at 390px first (parent screens), then 820px and 1280px; no console errors.
- [ ] `docs/05-design.md` has the exact wording above.
- [ ] `tasks/STATUS.md` ticked, committed as `T20: Repeating cards: see, change, skip and end a series`.
