# T02 App shell: connection, session, routes, shared pieces

**Goal.** The app starts in demo mode, knows who is using it, routes to the right place,
and has the shared pieces every later ticket uses. Screens are placeholders.

**Needs.** T01.

**Read first.** `CLAUDE.md`; `docs/03-architecture.md` ("Front-end structure" to the end);
`docs/05-design.md` ("Tokens and icons", "Shared pieces", "Top bar", "Parent sign-in and
frame"); `src/api/connection.ts`, `src/api/client.ts`, `src/app/connection.ts`,
`src/app/errors.ts`, `src/ui/icons.ts`, `src/ui/tokens.css`.

**Files.** Create: `src/main.tsx`, `src/App.tsx`, `src/ui/app.css`, `src/app/session.tsx`,
`src/app/useLoad.ts`, `src/components/Icon.tsx`, `src/components/Sheet.tsx` (+ `.css`),
`src/components/Toast.tsx` (+ `.css`), `src/components/TopBar.tsx` (+ `.css`),
`src/components/ParentFrame.tsx` (+ `.css`), `src/screens/Link.tsx`, `src/screens/Unlock.tsx`,
`src/screens/NotFound.tsx`, `src/screens/kid/Today.tsx`, `Week.tsx`, `Month.tsx`,
`src/screens/parent/SignIn.tsx`, `Home.tsx`, `Plan.tsx`, `Settings.tsx`, `e2e/shell.spec.ts`.
Already there, use as they are: `src/app/connection.ts`, `src/app/errors.ts`, `src/vite-env.d.ts`.

## Steps

### 1. Entry

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import './ui/tokens.css';
import './ui/app.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/ui/app.css`: page-level layout only (a `.page` wrapper with the paddings from
`docs/05-design.md`, "Layout"). Use the tokens.

### 2. Session

`src/app/session.tsx`. Start from this code; adjust only if the typecheck asks for it, and
keep the behaviour.

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApi, type Api } from '../api/client.ts';
import type { Connection } from '../api/connection.ts';
import type { ChildSummary, WhoAmI } from '../api/types.ts';
import { getConnection } from './connection.ts';

export interface Session {
  conn: Connection;
  /** Calls made as this device (his board, or a display). */
  api: Api;
  /** Calls made as the signed-in parent. */
  parentApi: Api;
  /** Who this device is; null until the first answer. */
  me: WhoAmI | null;
  /** Who the parent session is; null when signed out or not asked yet. */
  parentMe: WhoAmI | null;
  /** Creates the device session if needed, then asks the server who this device is. */
  refreshMe(): Promise<WhoAmI>;
  /** Asks the server who the parent session is, claiming the parent role when allowed. */
  refreshParent(): Promise<WhoAmI | null>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const conn = useMemo(() => getConnection(), []);
  const api = useMemo(() => createApi(conn.device), [conn]);
  const parentApi = useMemo(() => createApi(conn.parent), [conn]);
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [parentMe, setParentMe] = useState<WhoAmI | null>(null);

  const refreshMe = useCallback(async () => {
    await conn.ensureDeviceSession();
    const next = await api.whoami();
    setMe(next);
    return next;
  }, [conn, api]);

  const refreshParent = useCallback(async () => {
    if ((await conn.parentSession()) === null) {
      setParentMe(null);
      return null;
    }
    let next = await parentApi.whoami();
    if (next.role !== 'parent' && next.can_claim_parent) next = await parentApi.claimParent();
    setParentMe(next);
    return next;
  }, [conn, parentApi]);

  const value = useMemo<Session>(
    () => ({ conn, api, parentApi, me, parentMe, refreshMe, refreshParent }),
    [conn, api, parentApi, me, parentMe, refreshMe, refreshParent],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside <SessionProvider>');
  return s;
}

/** The child this device belongs to (his screens). Throws if used outside DeviceGate. */
export function useChild(): ChildSummary {
  const { me } = useSession();
  const child = me?.children[0];
  if (!child) throw new Error('useChild needs an unlocked device');
  return child;
}

/** The child a parent is looking at (parent screens). Throws if used outside ParentGate. */
export function useParentChild(): ChildSummary {
  const { parentMe } = useSession();
  const child = parentMe?.children[0];
  if (!child) throw new Error('useParentChild needs a signed-in parent');
  return child;
}
```

In the same file add two gate components, following "DeviceGate" and "ParentGate" in
`docs/03-architecture.md` step by step:

- `DeviceGate({ children })`: on mount call `refreshMe()`. While `me` is null show
  `Loading...`; on a thrown error show `errorText(e)` and a `Try again` button. Then:
  `me.role === 'kid'` → children; `me.role === 'display'` → a panel
  `This screen is display only.`; `me.device?.status === 'approved'` → `<Unlock />`;
  otherwise → `<Link />`.
- `ParentGate({ children })`: on mount call `refreshParent()`. Loading and error as above.
  `parentMe === null` → `<SignIn />`; `parentMe.role === 'parent'` → children; otherwise the
  "not on the parent list" panel with the e-mail and a `Sign out` button
  (`conn.signOutParent()` then `refreshParent()`).

Only `DeviceGate` may call `ensureDeviceSession()` (through `refreshMe`). A parent's phone
that only ever opens `/parent` must not create a device session.

### 3. Loading and changing data

`src/app/useLoad.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { isLocked } from './errors.ts';
import { useSession } from './session.tsx';

export interface Loaded<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Loads data when the screen opens and whenever `deps` change; again when the window is
 * focused or becomes visible, and once a minute. Keeps the last good data while reloading.
 */
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]): Loaded<T> {
  const { refreshMe } = useSession();
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>(
    { data: null, error: null, loading: true });
  const latest = useRef(loader);
  latest.current = loader;
  const ticket = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++ticket.current;
    try {
      const data = await latest.current();
      if (mine === ticket.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (isLocked(error)) void refreshMe().catch(() => undefined);     // back to the PIN pad
      if (mine === ticket.current) setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, [refreshMe]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const again = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('focus', again);
    const timer = window.setInterval(again, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('focus', again);
      window.clearInterval(timer);
    };
  }, [reload]);

  return { ...state, reload };
}

/**
 * Runs one change, then reloads. `busy` disables buttons; `error` is what went wrong.
 * `run` resolves to the call's result, or undefined when it failed.
 */
export function useAction(reload: () => Promise<void>) {
  const { refreshMe } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(async <R>(change: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      const result = await change();
      await reload();
      return result;
    } catch (e) {
      setError(e);
      if (isLocked(e)) void refreshMe().catch(() => undefined);
      else await reload();
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [reload, refreshMe]);
  return { run, busy, error, clearError: () => setError(null) };
}
```

### 4. Shared pieces

Build these exactly as `docs/05-design.md` ("Shared pieces", "Tokens and icons") describes:

- `Icon`: props `name: string`, `size?: number` (default 20), `label?: string`. Renders the
  nodes from `iconNodes(name)`. With `label`, it gets `role="img"` and `aria-label`;
  without, `aria-hidden="true"`.
- `Sheet`: props `title: string`, `onClose: () => void`, `children`. All the dialog
  behaviour in the design guide (focus in and back, Tab trapped, Escape closes, scroll
  locked, a `Close` button with the close icon and `aria-label="Close"`).
- `Toast`: a `ToastProvider` and a `useToast()` hook returning `show(text)` and
  `showError(err)` (which displays `errorText(err)` in `role="alert"`).
- `TopBar`: brand, `<nav aria-label="Main">` with `Today` (`/`), `Week` (`/week`), `Month`
  (`/month`), the `Demo` chip when `conn.mode === 'demo'`, and the lock button
  (`kidLock()` then `refreshMe()`). The campfire chip and profile button come in T04 and T06.
- `ParentFrame`: a centered column with the `<nav aria-label="Parent">` tab bar at the bottom
  (`This week` → `/parent`, `Must-dos` → `/parent/plan`, `Settings` → `/parent/settings`) and
  the `Demo` chip when in demo mode.

### 5. Routes and placeholder screens

`src/App.tsx`: `SessionProvider` > `ToastProvider` > `BrowserRouter` > `Routes`, with the
table in `docs/03-architecture.md`. His routes are wrapped in `DeviceGate` and share a layout
with `TopBar`; parent routes are wrapped in `ParentGate` and share `ParentFrame`. Any other
path renders `NotFound` (h1 `Page not found`, link `Back to the board`).

Placeholders for this ticket (each replaced by a later ticket):

| File | Shows |
|---|---|
| `screens/Unlock.tsx` | h1 `Hi, {name}` (`me.children[0].name`) and `Enter your PIN to open your board.` No pad yet |
| `screens/Link.tsx` | h1 `Link this device` |
| `screens/kid/Today.tsx` | h1 `formatLongDate(me.today)` |
| `screens/kid/Week.tsx`, `Month.tsx` | h1 `Week` / `Month` |
| `screens/parent/SignIn.tsx` | Complete: as in the design guide. The button calls `conn.signInParent('/parent')` then `refreshParent()` |
| `screens/parent/Home.tsx`, `Plan.tsx`, `Settings.tsx` | h1 `{name}'s week` / `Must-dos` / `Settings`; Settings also has a working `Sign out` button |

### 6. Browser test `e2e/shell.spec.ts`

Use `openDemo` from `e2e/helpers.ts`. Tests (project `kid` unless the file name says parent;
put the parent ones in `e2e/parent.shell.spec.ts`):

1. `/` shows the heading `Hi, Anush` and the `Demo` chip.
2. `/nope` shows `Page not found`; `Back to the board` leads to `/`.
3. (parent) `/parent` shows `Parents` and `Enter as demo parent`; pressing it shows the
   `Parent` navigation with three links and the heading `Anush's week`.
4. (parent) After that, reloading `/parent/settings` still shows `Settings` (the demo parent
   stays signed in); `Sign out` returns to `Parents`.

## Done when

- [ ] `npm run check` passes with no SKIP (typecheck and production build both run).
- [ ] `npx playwright test e2e/shell.spec.ts e2e/parent.shell.spec.ts` passes.
- [ ] `npm run dev`: `/` shows the placeholder PIN screen with the Demo chip; `/parent` works as in the tests.
- [ ] Opening `/parent` directly in a fresh browser works without visiting `/` first, and
      `refreshMe()` is not called on parent routes (on the real backend this keeps a parent's
      phone from creating a device session).
- [ ] The Sheet can be opened from a temporary button on the Today placeholder, traps focus,
      closes on Escape, and returns focus to the button. Remove the temporary button after checking.
- [ ] No console errors or React warnings.

## Not in this ticket

The PIN pad and pairing code (T03). Any real screen content. The campfire chip.
