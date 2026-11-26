# T09 Parents: sign-in and This week

**Goal.** On a phone, a parent sees what needs them and how the week went, and decides
drop requests.

**Needs.** T08.

**Read first.** `docs/05-design.md` ("Parent sign-in and frame", "Parent: This week");
`design/screens/parent-home.png`; `docs/04-data-and-api.md` (`getBoard`, `getStats`,
`getSettings`, `decideDrop`, `getReview`); `src/lib/board.ts` (`dueSoonCards`, `percentDone`);
`src/lib/month.ts` (`closedOfCounted`).

**Files.** Replace `src/screens/parent/Home.tsx`. Create under `src/screens/parent/home/`:
`NeedsYou.tsx`, `WeekTiles.tsx`, `LoadCheck.tsx` (+ `.css`); `src/lib/parentHome.ts`,
`tests/unit/parentHome.test.ts`, `e2e/parent.home.spec.ts`. Reuse `CategoryBar`.

## Steps

1. **Data** (all through `parentApi`, child from `useParentChild()`, week from the route
   `/parent` or `/parent?week=2026-12-14`; default the week of `parentMe.today`):
   `getBoard(child.id, week, week + 6)`, `getStats(child.id, week, week + 6)`,
   `getSettings()` (for `catchup_alert_threshold`), `getReview(child.id, week)`.
2. **`src/lib/parentHome.ts`** (pure, tested):
   - `weekRangeText(monday: string): string` → `December 14 to 20`, and across months
     `December 28 to January 3`.
   - `loadCheckText(plannedMin, guideMin): string` → the two sentences in the design guide
     (`... so this week ran 40 min over.` / `... so there is 2 h to spare.`; equal: `... exactly your guide.`).
   - `trayLine(count, minutes, threshold): { text: string; alert: boolean }`.
3. **`NeedsYou`**, in this order: drop requests (`board.drop_requests`; `Keep it` →
   `decideDrop(id, false)`, `Let it go` → `decideDrop(id, true)`; toast `Kept.` / `Let go.`),
   unconfirmed count, due-soon must-dos (`dueSoonCards(board)`, one line each:
   `"{title}" is due {weekday} and is not on a day yet.`), the tray line. When there are no
   drop requests, no unconfirmed cards, no due-soon cards and the tray is under the
   threshold, show `Nothing needs you right now.` above the tray line.
4. **`WeekTiles`**: `percentDone(totals.planned_min, totals.spent_min)`;
   `closedOfCounted(stats.by_day, today)`; `totals.must_done` of `totals.must_planned`.
5. **`LoadCheck`** and **Time by category** (`CategoryBar` per `stats.by_category`).
6. **Check-in** panel from `getReview`.
7. Tapping a drop request's title opens the T05 `CardSheet` with `role="parent"` and
   `api={parentApi}` (parents can edit, move and resolve any card).

## Browser test `e2e/parent.home.spec.ts` (phone)

Start with `openParent(page)`.

1. Heading `Anush's week`, range `December 21 to 27`. Tiles: `15%`, `0 of 1`, `1 of 3`.
   `Needs you` mentions `Pack for the trip`; the tray line reads
   `Catch-up tray: 1 card, 30 min. You are alerted at 5 cards.`
2. `Previous week` → `December 14 to 20`; tiles `90%`, `2 of 2`, `4 of 4`.
3. **Drop request.** Go to `/`, unlock, open `Outside time`, `Ask to drop`, reason
   `It is raining`, `Ask a parent`. Go to `/parent` → `He asked to drop a must-do`,
   `Outside time`, `It is raining` → `Let it go` → the request is gone. Back on `/`,
   `Outside time` is no longer on Today.
4. **Keep it.** Same, but `Keep it` → on `/` the card is still there and no longer says
   `Waiting for a parent to decide`.
5. Nothing scrolls sideways at this width.

(Frozen demo, this week: 195 min planned (180 today and the 15-minute check-in on Sunday),
30 done → 15%; three must-dos on days, one done. Last week: 300 planned, 270 done → 90%.)

## Done when

- [ ] `npm run check:e2e` passes (both projects).
- [ ] Compared with `design/screens/parent-home.png` on a 390px-wide window.
- [ ] Signed out, `/parent` shows only the sign-in screen: no child name, no numbers.
- [ ] A non-parent cannot see this screen even by typing the address (the gate from T02).

## Not in this ticket

Must-dos (T10), Settings (T11), the weekly e-mail (T14).
