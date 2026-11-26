# T10 Parents: Must-dos

**Goal.** A parent sets the week's frame: focus areas, must-dos, days off, and a note.

**Needs.** T09.

**Read first.** `docs/05-design.md` ("Parent: Must-dos"); `design/screens/parent-plan.png`;
`docs/01-product.md` (rules 1, 3, 11, 15); `docs/04-data-and-api.md` (`addCards`,
`deleteCard`, `setDayMark`, `setParentNote`, `saveGoal`); `src/lib/board.ts` (`groupMustDos`).

**Files.** Replace `src/screens/parent/Plan.tsx`. Create under `src/screens/parent/plan/`:
`MustDoList.tsx`, `MustDoForm.tsx`, `MustDoSheet.tsx`, `DaysOff.tsx`, `NotePanel.tsx`
(+ `.css`); `src/lib/parentPlan.ts`, `tests/unit/parentPlan.test.ts`,
`e2e/parent.plan.spec.ts`. Reuse `FocusSheet` and `LibraryPanel` (as a picker).

## Steps

1. **Data.** Week from `/parent/plan?week=...` (default: this week), with the same
   previous/next buttons as Home. `getBoard(child.id, week, week + 6)`, `getLibrary()`.
2. **`src/lib/parentPlan.ts`** (pure, tested):
   - `mustDoCards(input, week): NewCard[]`: `input` = `{ title, category_id, minutes, times,
     due_date }` → `times` copies with `kind: 'must'`, `place: 'week'`, `week_start: week`.
   - `mustDoStatus(group: MustGroup): string` → `0 placed, 7 to place`, `2 placed, 3 to place`,
     `all 5 placed`, `3 of 5 done`, `all done`.
   - `nextMark(current: 'rest' | 'away' | null): 'rest' | 'away' | null` (none → rest → away → none).
   - `removable(group: MustGroup): Card[]`: the open cards, unplaced ones first.
3. **Focus areas**: the chips and `Edit` → `FocusSheet` with `api={parentApi}`.
4. **`MustDoList`**: `groupMustDos([...board.cards, ...board.pool])`. Each row: category dot
   and icon, title, `{minutes}, {n} times` (`once` for one), the status text. A row opens
   `MustDoSheet`: `Remove one` (`deleteCard` on `removable(group)[0]`) and
   `Remove all that are still open` (confirm; `deleteCard` on each). Finished cards are never removed.
5. **`MustDoForm`** (`Add a must-do`): fields from the design guide. `Pick from the Library`
   opens the library picker and fills title, category and minutes. Validate like
   `NewCardForm`. Save: `addCards(child.id, mustDoCards(input, week))`, toast
   `Added. {name} will see it on his board.`
6. **`DaysOff`**: seven buttons for the shown week; a press calls
   `setDayMark(child.id, date, nextMark(current))`. Past days can be marked too.
7. **`NotePanel`**: `Today` / `Tomorrow` (dates from `parentMe.today`); loads the current
   text for today from `getToday(child.id).parent_note`; tomorrow starts empty unless saved in
   this session. `Save` → `setParentNote(child.id, date, text)`; an empty text removes it.
   Toast `Saved. He will see it {today|tomorrow}.`

## Browser test `e2e/parent.plan.spec.ts` (phone)

Start with `openParent(page, '/parent/plan')`.

1. Heading `Week of December 21`. The row `Read for fun` shows `7 times` and `0 placed, 7 to place`.
2. **Add.** `Add a must-do` → `Tidy desk`, `Home & Helping`, 10 minutes, 2 times → `Add` →
   the row `Tidy desk` shows `2 times`. On `/` (unlock) the stack shows `Tidy desk` with
   `Must-do` and `1 more this week`.
3. **Remove one.** Open `Read for fun` → `Remove one` → `6 times`.
4. **Days off.** Press Thursday twice → its label is `Thursday: Away`. On `/week` (unlock)
   the `Thursday, December 24` region shows `Away`.
5. **Note.** `Today`, type `Have fun at D&D`, `Save` → on `/` the note panel shows it
   (it replaces the demo's note).
6. **He cannot.** On `/` open `Tidy desk`: there is no `Edit` and no `Drop it`, only
   `Ask to drop`.

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] Compared with `design/screens/parent-plan.png` at 390px.
- [ ] Adding a must-do 7 times creates exactly 7 cards (check the stack count), and pressing
      `Add` twice quickly does not create 14.

## Not in this ticket

Repeating must-dos across weeks (parents add them each Sunday for now; note it under
Notes in STATUS if the family asks for it). Categories and library management.
