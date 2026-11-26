# T15 Extra: kitchen display screen

**Goal.** A device linked as "Display only" shows, read-only and readable from across the
kitchen: the time, what he is doing now, what is next, the rest of today, and the campfire.

**Needs.** T12.

**Read first.** `docs/07-phase-2.md`; `docs/03-architecture.md` ("DeviceGate");
`docs/04-data-and-api.md` (`getBoard`, `getToday`: both allowed for `display`).

**Files.** Create `src/screens/display/Display.tsx` (+ `.css`), `src/lib/display.ts`,
`tests/unit/display.test.ts`, `e2e/parent.display.spec.ts`. Change `DeviceGate` (render
`Display` for role `display`).

## Steps

1. **`src/lib/display.ts`** (pure, tested): `nowAndNext(cards: Card[], nowMin: number):
   { now: Card | null; next: Card | null; later: Card[]; anytime: Card[] }` for today's open
   cards. `now` = the card with `doing_since`, else the timed card whose slot contains
   `nowMin`; `next` = the first timed card starting after `nowMin` (not `now`); `later` = the
   remaining timed cards in order; `anytime` = open cards without a time.
2. **Screen.** No top bar, no buttons, no links except a tiny `Display only` label.
   Large clock (`formatClock`), the date, `Now` (title in the display font, about 56px,
   category icon and color), `Next` with its start time, a compact list for `later` and
   `anytime`, the campfire chip, the word of the day at the bottom. Nothing planned:
   `Nothing on the board right now.` Rest or Away day: show the mark.
3. Data with `useLoad` (it already refreshes every minute); the clock itself updates every
   15 seconds. Child from `me.children[0]`.
4. Dark background by default (it is a wall screen): set `data-theme="dark"` on this route.
5. Never call a function that writes. A display device would be refused anyway; the screen
   must not even try.

## Browser test `e2e/parent.display.spec.ts`

`openDemoUnlinked` at `/`, read the code, `openParent`-style sign-in on `/parent/settings`,
link it as `Display only`, go to `/` → the screen shows `Now`, `Outline the winter
one-shot`, `Next`, `micro:bit: first programs`, and no element with role `button`.

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] Readable at 3 meters on a tablet (titles at least 40px; contrast checked in dark).
- [ ] Left open for 10 minutes: the clock moves, the data refreshes, memory does not grow.
