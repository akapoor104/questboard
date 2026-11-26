# T04 Today, read-only

**Goal.** His Today screen shows everything, laid out as in the picture. Nothing is
clickable yet except navigation.

**Needs.** T03.

**Read first.** `docs/05-design.md` ("Layout", "Shared pieces", "Card text", "Today");
`design/screens/kid-today.png` and `design/mock/kid-today.html`; `src/lib/board.ts`;
`src/lib/dates.ts`; `docs/04-data-and-api.md` (`getBoard`, `getToday`, `getLibrary`).

**Files.** Replace `src/screens/kid/Today.tsx`. Create under `src/screens/kid/today/`:
`TimeBar.tsx`, `WordPanel.tsx`, `Reminders.tsx`, `StackColumn.tsx`, `DayTimeline.tsx`,
`TrayColumn.tsx`, `CloseOutPanel.tsx` (each with its `.css` when needed). Create
`src/components/CardTile.tsx` (+ `.css`), `src/components/CampfireChip.tsx`,
`src/app/useCategories.ts`, `src/lib/today.ts`, `tests/unit/today.test.ts`,
`e2e/today.spec.ts`. Change `src/components/TopBar.tsx` (add the campfire chip).

## Steps

1. **Data.** In `Today.tsx`, with `child = useChild()` and `me` from the session:
   ```ts
   const week = monday(me.today);
   // Four weeks back, so leftovers can say where they came from and nothing left in an
   // older stack is lost from view. Today's cards are the ones with date === board.today.
   const board = useLoad(() => api.getBoard(child.id, addDays(week, -28), addDays(week, 6)), [child.id, week]);
   const today = useLoad(() => api.getToday(child.id), [child.id]);
   const library = useLoad(() => api.getLibrary(), []);
   ```
   Put the library load in `src/app/useCategories.ts` as `useCategories()` returning
   `{ categories, byId, colorClass(categoryId) }`; `colorClass` gives `cat-<color>` and falls
   back to `cat-slate` for unknown ids or colors. Every later screen uses it.
   Show `Loading...` until all three have data; show the error panel if any failed.
2. **`src/lib/today.ts`** (pure, tested). Write and test:
   - `stackGroups(pool: Card[]): { card: Card; more: number }[]`: cards with the same title,
     category, minutes and kind collapse into one entry; `more` is how many others there are.
     Order: must-dos first, then by `sort`, then `seq`.
   - `splitPool(pool: Card[], thisMonday: string): { current: Card[]; older: Card[] }`: stack
     cards of this week, and open stack cards left in earlier weeks.
   - `hourRows(dayStartMin, dayEndMin): number[]`: the minute of each full hour to label,
     from the hour containing the start to the last hour before the end.
   - `trayOrigin(card: Card, cards: Card[]): { date: string; pct: number; note: string | null } | null`:
     looks up `card.carried_from_id` in the loaded cards.
   - `campfireText(current: number): string`: `Campfire: light it today`, `Campfire: 1 day`,
     `Campfire: 6 days`.
3. **`CardTile`** with the three variants and the meta-line table from the design guide.
   The root element and its `data-` attributes are a contract (see "Shared pieces"). In this
   ticket the inner button does nothing yet; accept an optional `onOpen` prop for T05.
4. **Header block**: h1, encouragement, the parent-note panel when `today.parent_note` is set.
5. **`TimeBar`** (region `Today's time`): today's cards only (`board.cards` with
   `date === board.today`). Totals with `minutesByCategory()`; text with `formatDuration`.
6. **`WordPanel`** (region `Word of the day`): static in this ticket (the button arrives in T06).
   If `today.word` is null, do not render the panel.
7. **`Reminders`**: render the rows for `today.alerts` (`unconfirmed`, `due_soon`) with their
   exact sentences; buttons present but inert until T06. Use `dueSoonCards(board)` for titles
   and `weekdayName(due_date)` for the day.
8. **`StackColumn`** (region `This week's stack`): `splitPool(board.pool, week).current`
   through `stackGroups`; `CardTile` variant `full`; the `To today` buttons are present but
   inert. If `older` is not empty, show those cards below under the label
   `Left from earlier weeks` (same tiles).
9. **`DayTimeline`** (region `Today`): `layoutDay(todayCards)`. The any-time strip uses
   variant `row`. The timeline is a relative-positioned box: height =
   `(dayEnd - dayStart) / 15 * var(--slot)`; a timed card sits at
   `top = (start - dayStart) / 15 * slot`, `height = max(minutes, 20) / 15 * slot`,
   `left` and `width` from `column` and `columns`. Cards that start before `day_start_min`
   or end after `day_end_min` are clamped to the box and still shown. The now line:
   `minutesInZone(Date.now(), me.timezone)`, re-read every 30 seconds, drawn only when it
   falls inside the box, behind the cards (`z-index`), with its label hidden when within 20
   minutes of an hour label.
10. **`TrayColumn`** (region `Catch-up tray`) with `trayOrigin` text; buttons inert.
11. **`CloseOutPanel`** (region `Close out the day`): count today's open cards; the button
    is disabled in this ticket.
12. **`CampfireChip`** in the top bar from `today.streak.current` (`data-testid="campfire"`).
    The top bar needs the streak, so load `getToday` once in the kid layout and pass it down
    (or lift it into a small context); do not call it twice per screen.
13. **Layout** at the three widths in the design guide. Use CSS grid; no JavaScript for layout.

## Browser test `e2e/today.spec.ts`

Start each with `openBoard(page)`.

1. The heading is `Monday, December 21`; the encouragement is not empty; the campfire chip
   reads `Campfire: 2 days`; the parent note `Proud of how you planned yesterday.` is visible.
2. Region `Today` has five cards. `Math Academy lesson` has `data-status="resolved"`;
   `Outline the winter one-shot` has `data-doing="true"`; `Help cook dinner` is inside the
   `Any time today` block; `Outside time` shows `Must-do`.
3. Region `Catch-up tray` has one card, `Mr Math problem set`, showing `30 min left` and
   `Play date ran long`.
4. Region `This week's stack` contains `Pack for the trip`, and `Read for fun` appears once
   with `6 more this week`.
5. Region `Reminders` contains `Must-do due Wednesday: "Pack for the trip" is not on a day yet.`
6. Region `Word of the day` shows a word and its definition.
7. At a 390px-wide viewport nothing scrolls sideways
   (`document.documentElement.scrollWidth <= window.innerWidth`).

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] Side by side with `design/screens/kid-today.png` at 1280px: same structure, spacing
      and colors; the differences are only the ones listed in "Where the mock is wrong".
- [ ] Each category color appears together with its icon and name somewhere on the card or legend.
- [ ] Two overlapping timed cards (add them through the demo parent later, or temporarily in
      the demo seed while developing, then undo) render side by side, not on top of each other.
- [ ] No console errors.

## Not in this ticket

Any button that changes data (T05, T06). Week and Month.
