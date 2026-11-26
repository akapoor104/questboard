# T05 Card actions: start, how did it go, move, drop, undo

**Goal.** He can run his day: move a card to today, give it a time, start it, say how much
he did, send the leftover somewhere, drop a card or ask to, and undo a mistake.

**Needs.** T04.

**Read first.** `docs/01-product.md` ("The life of a card", rules 1 to 8);
`docs/04-data-and-api.md` ("Board", including the table "How to do the things the mock
shows"); `docs/05-design.md` ("Card sheet", "How did it go? dialog", "PlaceForm");
`design/screens/resolve.png`; `src/lib/board.ts` (`previewResolve`, `nextFreeSlot`).

**Files.** Create `src/components/CardSheet.tsx`, `ResolveDialog.tsx`, `PercentPicker.tsx`,
`PlaceForm.tsx`, `EditCardForm.tsx` (+ `.css`), `src/lib/cardActions.ts`,
`tests/unit/cardActions.test.ts`, `e2e/card-actions.spec.ts`. Change `Today.tsx` and its
columns, and `CardTile.tsx`, to open the sheet and wire the inline buttons.

## Steps

1. **`src/lib/cardActions.ts`** (pure, tested). One function decides which buttons a card
   gets, so every screen agrees:
   ```ts
   export type CardAction = 'start' | 'stop' | 'resolve' | 'to_today' | 'move' | 'give_time'
     | 'edit' | 'drop' | 'ask_drop' | 'undo';
   export function cardActions(card: Card, today: string, role: 'kid' | 'parent'): CardAction[]
   export function resolveText(minutes: number, pct: number): { done: string; left: string }
   export function placeDays(today: string): { date: string; label: string }[]   // Today, Tue 22, ...
   ```
   `cardActions` implements the table under "Card sheet" in the design guide, with these
   additions: a card with `drop_requested_at` gets no `drop`/`ask_drop`; a kid gets `edit`
   only for `kind === 'choice'`; a kid gets `undo` only when `card.date >= addDays(today, -1)`;
   a parent always gets `edit` and `undo` (for resolved cards) and `drop` instead of `ask_drop`.
   `resolveText` returns the two preview sentences from the design guide using
   `previewResolve` and `formatDuration`. Test every row of the table and the three
   preview cases (0, 50, 100).
2. **`CardSheet`**: a `Sheet` titled with the card title. Shows category (icon + name), the
   time line, details, `Must-do` or `My pick`, and one button per action from `cardActions`.
   Props: `card`, `board`, `role`, `api`, `reload`, `onClose`. Use `useAction(reload)`; close
   the sheet after a successful change; show `errorText` inside the sheet on failure.
   | Action | Call |
   |---|---|
   | `start` / `stop` | `api.startCard(id)` / `api.stopCard(id)` |
   | `to_today` | `api.placeCard(id, { place: 'day', date: board.today })` |
   | `move`, `give_time` | open `PlaceForm`, then `api.placeCard(...)` with its result |
   | `resolve` | open `ResolveDialog` |
   | `edit` | open `EditCardForm` (title, category, minutes, details), then `api.updateCard` |
   | `drop` | confirm, then `api.dropCard(id)` |
   | `ask_drop` | the reason form, then `api.dropCard(id, reason)`; toast `Asked. A parent will decide.` |
   | `undo` | `api.reopenCard(id)`; on `carry_in_use` show its sentence |
3. **`PlaceForm`**: props `card`, `board`, `settings` (`day_start_min`, `day_end_min` from
   `me`), `allowStack: boolean`, `onSave(place)`. Days from `placeDays(board.today)`. The
   suggested time: `nextFreeSlot(cardsOfThatDay, card.minutes, from, day_end_min)` where
   `from` is now (rounded up to 5) for today and `day_start_min` for other days; when it
   returns null, start on `Any time`. Changing the day recomputes the suggestion unless he
   already changed the time himself. Day cards for days outside the loaded board are simply
   unknown: suggest `day_start_min`.
4. **`PercentPicker`** and **`ResolveDialog`** exactly as in the design guide. Saving:
   | Choice | Calls |
   |---|---|
   | 100% | `resolveCard(id, 100, { note })` |
   | below 100, tray | `resolveCard(id, pct, { note })` |
   | below 100, new day and time | `resolveCard(id, pct, { note, remainder: 'day', new_date, new_start_min })` |
   | below 100, let it go (his pick) | `resolveCard(id, pct, { note, remainder: 'let_go' })` |
   | below 100, ask a parent (must-do) | `resolveCard(id, pct, { note })`, then `dropCard(result.carry.id, note)` |
   Toasts: `Saved. {left} is in your Catch-up tray.` / `Saved.` / `Saved. A parent will decide about the rest.`
5. **Inline buttons** on Today now work: `To today` (stack), `Give it a time` and
   `Drop it` / `Ask to drop` (tray), and the `How did it go?` button on the card that is
   "doing now". Tapping any card opens the `CardSheet`.
6. The "doing now" card shows `Doing now · started {clock}` from `doing_since`
   (`minutesInZone(Date.parse(doing_since), me.timezone)`).

## Browser test `e2e/card-actions.spec.ts`

Start each with `openBoard(page)`; use `card(page, region, title)` from the helpers.

1. **To today.** In the stack, `To today` on `Pack for the trip` → it appears in region
   `Today` (any time), leaves the stack, and the due-soon reminder disappears.
2. **Start switches.** Open `micro:bit: first programs`, press `Start` → it has
   `data-doing="true"` and `Outline the winter one-shot` has `data-doing="false"`.
3. **Half done to the tray.** Open `Outline the winter one-shot` → `How did it go?` → `Save`
   is disabled → choose `50%` → the preview reads `About 23 min done.` and `25 min left over.` →
   type a reason → `Save` → the card shows `50% done`; the tray now has two cards, one of
   them `Outline the winter one-shot` with `25 min left`.
4. **Leftover to a day.** Same card, `25%`, `Give it a new day and time now`, pick `Tue 22`,
   `Save` → the tray still has one card.
5. **Must-do cannot be let go.** Open `Outside time` → `How did it go?` → `0%` → the third
   option reads `Ask a parent to let it go` → choose it → `Save` → the tray shows
   `Outside time` with `Waiting for a parent to decide`.
6. **Undo.** Open `Math Academy lesson` (done) → `Undo` → `data-status="open"`.
7. **Give it a time.** In the tray, `Give it a time` on `Mr Math problem set` → pick today,
   keep the suggested time → it appears on the timeline and the tray is empty
   (`Nothing left over. Nice.`).
8. **Drop.** Open `Help cook dinner` → `Drop it` → confirm → it is gone from Today.
9. **Ask to drop.** Open `Outside time` → `Ask to drop` → `Ask a parent` → the card shows
   `Waiting for a parent to decide` and is still there.
10. **Edit.** `Help cook dinner` has `Edit`; `Outside time` (a must-do) does not.

(45 min at 50% is 22.5, which rounds to 23 done; the leftover is 25. `previewResolve` is the
source of truth: if a number in a test disagrees with it, the test is wrong, not the function.)

## Done when

- [ ] `npm run check:e2e` passes (including all earlier browser tests).
- [ ] Every dialog works by keyboard alone: open, choose, save, cancel, Escape.
- [ ] After any change the screen shows the server's answer (no stale card anywhere).
- [ ] A failing call (try: press `Undo` twice quickly, or resolve a card twice in two tabs)
      shows a friendly sentence and the board reloads; nothing crashes.

## Not in this ticket

Close-out, the word button, reminder buttons, profile (T06). Week and Library (T07).
