# T06 Close-out, reminders, word of the day, profile

**Goal.** He can close out his day and keep the campfire going, act on reminders, tick
the word of the day, and change his avatar and theme.

**Needs.** T05.

**Read first.** `docs/01-product.md` (rules 9 to 12, 14, "Reminders"); `docs/05-design.md`
("Today", "Close-out dialog", "Top bar"); `docs/04-data-and-api.md` (`closeDay`,
`markWordUsed`, `updateChild`, `getToday`).

**Files.** Create `src/screens/kid/today/CloseOutDialog.tsx`, `UnconfirmedSheet.tsx`,
`src/components/ProfileSheet.tsx` (+ `.css`), `e2e/close-out.spec.ts`. Change
`CloseOutPanel.tsx`, `Reminders.tsx`, `WordPanel.tsx`, `TopBar.tsx`, the kid layout, and
`e2e/helpers.ts` (add the two helpers below).

## Steps

1. **Close-out.** `CloseOutPanel`: the button is enabled when no card with
   `date === board.today` is open. It opens `CloseOutDialog` (design guide). Save:
   `api.closeDay(child.id, { mood, note })`, reload both the board and `getToday`, toast
   `Day closed. Campfire: {n} days.` (`1 day` for one). If the server answers `open_cards`
   (a card was added meanwhile), show its sentence and reload.
   When `board.closeouts` has today's date: show `Today is closed out.` and `Change my note`
   (the same dialog, prefilled; saving calls `closeDay` again).
2. **Unconfirmed cards.** `Sort them out` opens `UnconfirmedSheet` (title
   `Cards that still need a percent`): `board.unconfirmed` grouped by date
   (`formatLongDate`), each row a `CardTile` variant `row` with a button `How did it go?` that
   opens the `ResolveDialog` from T05. After the last one the sheet says
   `All sorted. Nice.` and offers `Close`.
3. **Due soon.** `Give it a day` opens the `PlaceForm` for that card (`allowStack: false`).
   `Show them` opens a sheet listing the cards, each with `Give it a day`.
4. **Word of the day.** The button calls `api.markWordUsed(child.id, !word.used)` and
   reloads `getToday`. Pressed state: text `Used today`, `aria-pressed="true"`, check icon.
5. **Profile.** The avatar + name in the top bar becomes a button opening `ProfileSheet`
   (title `My profile`): one button per entry of `AVATAR_ICONS` (`aria-label` = the key with
   a capital, `aria-pressed` on the current one) → `api.updateChild(child.id, { avatar })`;
   buttons `Light` and `Dark` → `api.updateChild(child.id, { theme })`; then `refreshMe()`.
   A link `Parent sign-in` to `/parent`.
6. **Theme.** In the kid layout: an effect sets
   `document.documentElement.dataset.theme = child.theme === 'dark' ? 'dark' : 'light'`.
   `ParentFrame` sets `'light'`. Check every Today panel in dark: no white boxes, no
   unreadable text (the tokens handle it if no raw colors were used).
7. **Helpers** in `e2e/helpers.ts`:
   ```ts
   /** Says how a card on Today went. */
   export async function resolveOnToday(page: Page, title: string, pct: '0%' | '25%' | '50%' | '75%' | '100%'): Promise<void>
   /** Moves the frozen clock to the same time on the next day and reloads. The board is locked again by then. */
   export async function goToNextDay(page: Page): Promise<void>   // sets 2026-12-22T18:06:00Z, reloads
   ```

## Browser test `e2e/close-out.spec.ts`

1. **Not yet.** `Close out today` is disabled and the panel says `4 cards still need a percent.`
2. **Close the day.** Resolve the four open cards of today at `100%` (`resolveOnToday`) →
   the button is enabled → press it → choose `Good` → `Close the day` → the toast reads
   `Day closed. Campfire: 3 days.`, the chip reads `Campfire: 3 days`, and the panel says
   `Today is closed out.`
3. **Undo un-closes.** After test 2's steps, `Undo` on `Help cook dinner` → the panel is
   back to `1 card still needs a percent.` and the chip to `Campfire: 2 days`.
4. **Yesterday's cards.** `goToNextDay(page)`, type the PIN → the heading is
   `Tuesday, December 22` → the reminder reads `4 cards from earlier days still need a percent.`
   → `Sort them out` → resolve `Help cook dinner` at `100%` → the reminder reads `3 cards ...`.
5. **Word.** `I used it today` → the button reads `Used today`; reload and unlock → still `Used today`.
6. **Give it a day.** In the reminder for `Pack for the trip`, `Give it a day` → pick
   `Tue 22` → `Save` → the reminder is gone.
7. **Theme.** Open the profile, press `Dark` → `<html>` has `data-theme="dark"`; reload,
   unlock → still dark.

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] The campfire number always equals `getToday().streak.current`; it is never computed in the browser.
- [ ] Dark theme checked by eye on Today, the card sheet and the resolve dialog.
- [ ] Closing a day with no cards at all works (try `goToNextDay` twice, sort out the old
      cards, close the empty day).

## Not in this ticket

Mood history or charts. Editing the word list.
