# T07 Week and the Library

**Goal.** He plans a week: sees seven days, the week's focus and the load check, moves
cards between days and the stack, and adds cards from the Library or writes his own.

**Needs.** T06.

**Read first.** `docs/05-design.md` ("Week"); `design/screens/kid-week.png` and
`design/mock/kid-week.html`; `docs/01-product.md` (rules 1, 2, 11, 13);
`docs/04-data-and-api.md` (`getBoard`, `getStats`, `addCards`, `saveGoal`, `getLibrary`,
`saveLibraryItem`).

**Shared with parents.** `FocusSheet`, `NewCardForm`, `LibraryPanel` and the T05 components
are reused by the parent screens in T10. Give them `api`, `childId` and `role` as props;
do not call `useSession()` inside them.

**Files.** Replace `src/screens/kid/Week.tsx`. Create under `src/screens/kid/week/`:
`FocusChips.tsx`, `FocusSheet.tsx`, `LoadMeter.tsx`, `WeekStack.tsx`, `DayColumn.tsx`,
`LibraryPanel.tsx`, `NewCardForm.tsx` (+ `.css`); `src/lib/week.ts`,
`tests/unit/week.test.ts`, `e2e/week.spec.ts`.

## Steps

1. **Route and data.** `/week` shows the week of `me.today`; `/week/:monday` shows that week
   (if the parameter is not a valid date, or not a Monday, redirect to its Monday or to
   `/week`). The arrows link to the previous and next Monday.
   ```ts
   const board = useLoad(() => api.getBoard(child.id, week, addDays(week, 6)), [child.id, week]);
   const stats = useLoad(() => api.getStats(child.id, week, addDays(week, 6)), [child.id, week]);
   ```
2. **`src/lib/week.ts`** (pure, tested):
   - `loadState(plannedMin, guideMin): { ratio: number; level: 'spare' | 'full' | 'over'; overBy: number }`
     (`spare` under 80%, `full` 80 to 100%, `over` above; a guide of 0 means always `spare`).
   - `dayPlannedMinutes(cards: Card[]): number` (not dropped).
   - `filterLibrary(items: LibraryItem[], categoryId: string | null): LibraryItem[]`.
   - `isMonday(date: string): boolean`.
3. **Focus.** `FocusChips`: `board.goals` with `scope === 'week'`, `period_start === week`,
   `status === 'active'`; done ones struck through. `Edit focus` opens `FocusSheet`:
   - rename (`saveGoal(child.id, { id, title })`), mark done / not done (`status`), remove
     (`status: 'dropped'`), add (`saveGoal(child.id, { scope: 'week', period_start: week, title, category_id })`);
   - with three active goals, the add form is replaced by
     `Three is plenty. Finish or remove one to add another.`
4. **`LoadMeter`** from `stats.totals.structured_planned_min` plus the structured minutes of
   this week's stack (`structuredMinutes(pool, categories)`), against
   `stats.structured_weekly_max_min`. `role="meter"` with `aria-valuenow/min/max` and
   `aria-label="Structured time planned"`. Sentences from the design guide.
5. **`WeekStack`** (region `Any day this week`): the week's `pool` through `stackGroups`
   from T04, tiles as rows; tapping opens the `CardSheet` from T05.
6. **`DayColumn`** x 7 (regions named `formatLongDate(date)`): header, `Today` marker, mark
   chip and note from `board.day_marks`, the day's cards as `CardTile` rows ordered as the
   server returned them (timed first by time, then any time), each opening the `CardSheet`.
   The add button opens `NewCardForm` preset to that day. Past days are dimmed and have no
   add button. Under 900px the seven columns become one horizontal strip that scrolls,
   starting scrolled to today.
7. **`LibraryPanel`** (`id="library"`; `/week#library` scrolls to it): category filter,
   items in a responsive grid, `Add` →
   `addCards(child.id, [{ title, category_id, minutes, place: 'week', week_start: week, library_item_id: item.id, details: item.description }])`,
   toast `Added to this week's stack`. A past week cannot be added to: the buttons are
   disabled and a note says `This week is over. Go to this week to add cards.`
8. **`NewCardForm`**: fields from the design guide, validated before sending (title 1 to 120
   characters, minutes 5 to 480 in steps of 5). `Add card` → `addCards` to the stack of the
   shown week, or to the preset day. With `Keep it in my Library` ticked, also
   `saveLibraryItem({ title, category_id, minutes })`.
9. Moving cards uses the `CardSheet` → `Move` → `PlaceForm` from T05. For Week, pass the
   shown week's days to `PlaceForm` instead of "today and the next six" (add a `days` prop
   to `PlaceForm`; keep the default for Today), never offering days before today.

## Browser test `e2e/week.spec.ts`

1. `/week` shows `Week of December 21`; the Monday region is marked `Today` and holds five cards.
2. `Next week` shows `Week of December 28` and the address ends in `/week/2026-12-28`;
   `Previous week` twice shows `Week of December 14`, where the Library `Add` buttons are disabled.
3. The load meter has `role="meter"` and the panel contains `weekly guide`.
4. **Add from the Library.** Filter `Story & D&D` → `Add` on the first item → toast
   `Added to this week's stack` → that title is in `Any day this week`.
5. **New card.** `New card` → title `Paint minis`, category `Fun & Friends`, 45 minutes →
   `Add card` → it is in `Any day this week` showing `My pick`.
6. **Give it a day.** Open `Paint minis` → `Move` → `Wed 23` → `Save` → it is in the
   `Wednesday, December 23` region.
7. **Focus.** `Edit focus` → add `Finish my map` → a chip `Finish my map` appears. With
   three active goals the add form is replaced by the "Three is plenty" sentence.
8. `/week/2026-12-23` redirects to `/week/2026-12-21`.

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] Compared with `design/screens/kid-week.png` at 1280px; checked at 820px and 390px.
- [ ] The Rest day / Away chip is drawn from `board.day_marks`. Nothing in the demo has a
      mark until a parent can set one, so T10's browser test is where it is first seen.
- [ ] Adding 10 cards quickly does not duplicate or lose any (each `Add` is disabled while saving).

## Not in this ticket

Dragging (T16). Editing or archiving library items (he can add; management is a parent
extra). Parent must-dos (T10).
