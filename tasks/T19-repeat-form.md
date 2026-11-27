# T19 Repeating cards: the Repeats field and the preview

**Goal.** Making a repeating card takes one form: a parent in `Add a must-do`, Anush in
`New card`, either of them from a card's sheet with `Make it repeat`. They see what will
happen before anything is saved.

**Needs.** T18 (the series functions exist in `createApi()`).

**Read first.** `docs/08-repeating-cards.md`; `docs/04-data-and-api.md` (`previewSeries`,
`saveSeries`); `src/screens/parent/plan/MustDoForm.tsx`; `src/screens/kid/week/NewCardForm.tsx`;
`src/components/CardSheet.tsx`, `PlaceForm.tsx`; `src/lib/cardActions.ts`; `src/lib/dates.ts`.

**Files.** Create `src/components/RepeatField.tsx`, `src/components/SeriesPreview.tsx`
(+ `.css`), `src/lib/repeat.ts`, `tests/unit/repeat.test.ts`, `e2e/repeat.spec.ts`.
Change `MustDoForm.tsx`, `NewCardForm.tsx`, `CardSheet.tsx` (+ `.css`), `src/lib/cardActions.ts`
(the `make_repeat` action), `docs/05-design.md` (the wording below), `tasks/STATUS.md`.

## Steps

1. **`src/lib/repeat.ts`** (pure, tested). It only builds drafts and words; the dates
   always come from `previewSeries` (no second copy of the rule in the browser).
   - `presets(date): Preset[]` from a chosen date, in this order: `Every day`,
     `Every weekday`, `Every {Weekday}`, `Every 2 weeks on {Weekday}`,
     `Every month on the {nth} {Weekday}`, `Every month on the {D}`, `Custom...`.
   - `ruleText(rule, place, start)`: `Every Tuesday at 4:00 PM`, `Mon and Wed, every 2 weeks`,
     `1st and 3rd Saturday`, `3 times a week`, `Every day, any time`.
   - `endText(series)`: `10 times`, `Until Mar 16`, `No end`.
2. **`RepeatField`** (props: `api`, `childId`, `role`, `date`, `value`, `onChange`):
   - Select-like button `Repeats` showing `Does not repeat` or the chosen rule.
   - `Custom...` opens: group `Repeat` (`Every day`, `Weekdays`, `Weekly`, `Monthly`,
     `Times a week`); for Weekly the weekday chips `M T W T F S S` (buttons with
     `aria-pressed`, full day names as labels) and `Every` 1 to 4 weeks; for Monthly
     `On days` (1 to 31) or `On the` (`1st`, `2nd`, `3rd`, `4th`, `Last` + weekday), with
     `Add another` for twice a month; `Every` 1 to 12 months.
   - `When`: `At a time` (with switch `Same time each day`; off shows one time per chosen
     weekday), `Any time that day`, `Some day that week` (only for Times a week).
   - `Ends`: `Never`, `On a date`, `After` N `times`.
   - `If it's missed`: `Let it pass` / `Make a catch-up card` (defaults from the design page).
   - Checkbox `If it falls on a Rest or Away day, ask for a new day` (= allows reschedule).
3. **`SeriesPreview`**: calls `previewSeries` (debounced 300 ms after a change) and shows
   `{n} cards, {first date} to {last date}` (or `Starts {date}, no end`), the first 8 dates,
   `Skipped: {date} (Rest)` lines, and `Clashes with "{title}" at {time}` lines. Errors in
   `role="alert"`; while loading, the previous preview stays.
4. **Saving.** With a repeat chosen, the form's main button reads `Add {n} cards` (or
   `Start repeating`) and calls `saveSeries`; the toast says `Repeating: {ruleText}.`
   Without one, everything works exactly as before (the existing tests prove it).
   - `MustDoForm`: when Repeats is chosen, `How many times this week?` is hidden (the rule replaces it).
   - `NewCardForm`: his series are his picks; `Keep it in my Library` still works.
   - `CardSheet`: action `Make it repeat` (open cards that are not yet in a series, for whoever
     may edit the card) opens `RepeatField` + `SeriesPreview` prefilled from the card. The
     series starts on the first occurrence **after** this card; the card itself stays as it is.
5. Mobile first: the custom form fits 390px without sideways scrolling; chips and steppers are
   at least 44px; everything works by keyboard; the sheet traps focus and closes on Escape.

## Browser test `e2e/repeat.spec.ts`

1. Parent: `Add a must-do` → `Piano lesson`, Music, 45 min → Repeats `Custom...` → Weekly,
   Tuesday, at 4:00 PM, `After 10 times` → the preview says `10 cards` → `Add 10 cards` →
   the Must-dos week shows `Piano lesson` on Tuesday at 4:00 PM, and next week too.
2. The preview lists a Rest day as skipped (mark one first with Days off).
3. Him: `New card` → `Read before bed`, every day, any time, never ends → today and the
   next 27 days each have the card (check today and the last day on Week/Month).
4. `Make it repeat` from a card's sheet prefills its title and minutes.
5. `Twice a month`: `1st and 3rd Saturday` previews the right dates for January 2027.
6. Without a repeat, `Add a must-do` and `New card` behave as before.

## Done when

- [ ] `npm run check:e2e` passes, including every earlier browser test.
- [ ] Tried at 390px, 820px and 1280px; no console errors; axe finds nothing serious.
- [ ] `docs/05-design.md` has the exact wording above.
- [ ] `tasks/STATUS.md` ticked, committed as `T19: Repeating cards: the Repeats field and the preview`.
