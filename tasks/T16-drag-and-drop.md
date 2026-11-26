# T16 Extra: drag and drop

**Goal.** On Week, he can drag a card from the stack or a day onto another day; on Today,
onto a time on the timeline. Tapping keeps working exactly as before.

**Needs.** T12. Optional: if it makes any existing browser test flaky, stop, revert, and
write why in `tasks/STATUS.md`. Tap-to-move is the supported way; this is a convenience.

**Read first.** `src/components/CardTile.tsx`, `PlaceForm.tsx`, `src/screens/kid/Week.tsx`,
`DayTimeline.tsx`.

**Files.** Create `src/app/useDrag.ts`, `src/lib/drop.ts`, `tests/unit/drop.test.ts`,
`e2e/drag.spec.ts`. Change `CardTile`, `DayColumn`, `WeekStack`, `DayTimeline` (+ `.css`).

## Steps

1. No library. Pointer events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`)
   with `setPointerCapture`. A drag starts only after the pointer has moved 8px (mouse) or
   after a 250 ms press without moving (touch), so taps and scrolling are untouched.
2. While dragging: a translucent copy of the tile follows the pointer; drop targets (day
   columns, the stack, timeline slots) highlight with an outline in `var(--ink)`; the page
   auto-scrolls near the edges.
3. **`src/lib/drop.ts`** (pure, tested): `slotFromOffset(offsetPx, slotPx, dayStartMin,
   dayEndMin, minutes): number` → the start minute, snapped to 15 minutes and clamped so the
   card ends by `dayEndMin`. `canDrop(card, targetDate, today, role): boolean` → false for
   past days for him, false for resolved cards.
4. Drop → the same `placeCard` calls as `PlaceForm`. On error: `showError`, reload. No
   optimistic move: the tile returns, then the reload shows the truth.
5. Keyboard users keep `Move` in the card sheet; say so with `aria-describedby` text on
   draggable tiles: `Press Enter for options, including Move.`
6. Change the Week hint to `Drag a card onto a day, or tap it to choose a day and time.`

## Browser test `e2e/drag.spec.ts`

1. Week: drag `Pack for the trip` from `Any day this week` onto `Wednesday, December 23` →
   it is listed there.
2. Today: drag `Help cook dinner` onto the timeline near 5 PM → it shows a time between
   `4:45 PM` and `5:15 PM`.
3. A plain click on a card still opens the card sheet.
4. All earlier browser tests still pass, three runs in a row (`npx playwright test --repeat-each 3`).

## Done when

- [ ] `npm run check:e2e` passes; test 4 above was run.
- [ ] Tried on a real touch screen: scrolling the page by swiping over cards still works.
