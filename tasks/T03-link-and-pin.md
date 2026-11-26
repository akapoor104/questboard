# T03 Link this device and the PIN pad

**Goal.** A new device shows a pairing code and waits; a linked device shows the PIN pad;
the right PIN opens his board.

**Needs.** T02.

**Read first.** `docs/05-design.md` ("Link this device", "PIN pad"); `design/screens/unlock.png`;
`docs/04-data-and-api.md` ("Session and devices"); `e2e/helpers.ts`; `e2e/smoke.spec.ts`.

**Files.** Replace `src/screens/Link.tsx` and `src/screens/Unlock.tsx` (+ their `.css`).
Create `src/lib/pin.ts`, `tests/unit/pin.test.ts`, `e2e/link.spec.ts`.

## Steps

### 1. `src/lib/pin.ts` (pure, tested)

```ts
import type { UnlockResult } from '../api/types.ts';

/** 'K7M2QX' -> 'K7M-2QX'. Anything that is not six characters is returned unchanged. */
export function formatPairCode(code: string): string

/** The sentence under the PIN pad after a failed try, or null after a good one. */
export function pinMessage(result: UnlockResult, timezone: string): string | null
```

`pinMessage`: `ok` → `null`; `locked_until` set → `Too many tries. Try again at {clock}.`
where clock = `formatClock(minutesInZone(Date.parse(locked_until), timezone))`; otherwise
`That PIN did not match. {n} tries left.` with `1 try left.` for one.
Tests in `tests/unit/pin.test.ts`: both functions, including the singular and a locked result.

### 2. Link screen

- On mount, look at `me.device`:
  - `null`, or `revoked`, or `pending` with `pair_expires_at` in the past →
    `await api.deviceStartPairing()` then `refreshMe()`. Guard with a ref so React's
    development double-mount does not ask twice.
  - `pending` and still valid → show `me.device.pair_code`.
- Show the code with `formatPairCode` in `data-testid="pair-code"`, large, in the display
  font, easy to read from across a table.
- Every 4 seconds call `refreshMe()`. When the device becomes `approved`, `DeviceGate` shows
  the PIN pad by itself; the Link screen does nothing special. Clear the interval on unmount.
  If the code has run out when a tick arrives, get a new one.
- Button `New code`: `deviceStartPairing()` then `refreshMe()`.
- Wording and the revoked variant: exactly as in the design guide. Remember in component
  state that the first status seen was `revoked`, so `This device was removed. A parent can
  link it again.` stays visible while the new code is shown. Errors: `showError(e)`.

### 3. PIN pad

- Layout as in `design/screens/unlock.png`: brand, avatar icon (`child.avatar`), heading,
  hint, four dots, a 3 x 4 grid (1 to 9, then empty, 0, Delete), the message line, the footer.
- State: the digits typed so far (a string, never stored anywhere else). The fourth digit
  calls `api.kidUnlock(pin)`, then clears the digits.
  - `ok` → `refreshMe()`; the gate then shows his board.
  - not ok → show `pinMessage(result, me.timezone)` in `role="alert"`.
  - While `locked_until` is in the future, every pad button is `disabled`; a timer enables
    them again when the time has passed.
  - `pin_not_set` → `Ask a parent to set your PIN.`; other errors → `errorText(e)`.
- Keyboard: digits type, Backspace deletes. Do not use an `<input>`: no keyboard should pop
  up on a tablet, and browsers must not offer to save the PIN.
- Never log the PIN, never put it in `localStorage`, a URL or React state outside this component.

### 4. Browser tests

- `e2e/smoke.spec.ts` (already written) must pass unchanged.
- `e2e/link.spec.ts`, using `openDemoUnlinked` from the helpers:
  1. The page shows `Link this device` and a code matching `^[A-Z2-9]{3}-[A-Z2-9]{3}$`.
  2. `New code` shows a different code.
- Add to `e2e/smoke.spec.ts` (new tests at the end; do not change the existing ones):
  3. Five wrong PINs show `Too many tries.` and the `1` button is disabled.
  4. Typing `1234` on the keyboard opens the board.

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] `/` in the demo: PIN pad → `1234` → the Today placeholder; the lock button brings the pad back.
- [ ] With `qb-demo-start` = `unlinked` set before the first visit (or after "Clear site data"
      plus setting it), `/` shows a code, and it changes with `New code`.
- [ ] The pad works by mouse, touch (try the browser's device toolbar) and keyboard; every
      button is at least 64px; focus is visible.
- [ ] Searching the built files for the demo PIN finds it only inside the demo backend:
      `grep -rl "1234" src/screens src/components src/app` prints nothing.

## Not in this ticket

Approving a code (parent Settings, T11). The profile picker for more than one child.
