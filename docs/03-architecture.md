# Architecture and security

## The pieces

```
  His laptop / tablet / family computer            A parent's phone
  ┌──────────────────────────────┐                ┌──────────────────────────────┐
  │ Questboard web app (static)  │                │ Questboard web app (static)  │
  │ device session + PIN unlock  │                │ Google sign-in               │
  └──────────────┬───────────────┘                └──────────────┬───────────────┘
                 │  HTTPS, publishable key + session token       │
                 ▼                                               ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ Supabase project (free plan)                                                 │
  │   Auth: anonymous sessions for devices, Google for parents                   │
  │   Data API ──▶ 42 functions in schema "public"  (the only door)              │
  │                    │ each one checks who is calling, then reads or writes    │
  │                    ▼                                                         │
  │                tables in private schema "qb"  (no grants, no policies)       │
  └──────────────────────────────────────────────────────────────────────────────┘
                 ▲ HTTPS, publishable key + automation token (read-only)
  ┌──────────────┴───────────────┐        ┌──────────────────────────────┐
  │ Google Apps Script           │        │ Cloudflare Pages (free)      │
  │ in a parent's own account:   │        │ serves the built files of    │
  │ Sunday e-mail, Drive backup, │        │ the web app; holds no data   │
  │ daily ping, calendar (ph. 2) │        └──────────────────────────────┘
  └──────────────────────────────┘
```

- **Web app**: Vite + React + TypeScript, built to static files. No server code of our own.
- **Database**: PostgreSQL on Supabase. All logic that matters lives in SQL functions.
- **Automation**: one Apps Script file that a parent pastes into their Google account.
- **Demo mode**: with no Supabase settings, the app runs the same rules in the browser
  (`src/api/memory/`), with data in `localStorage`. It is how the screens are built and tested.

## Why the rules live in the database

A web app's code runs on the user's device and can be changed there. So the browser is
never trusted: it holds only the project URL and the publishable key, both safe to publish.
What a caller may do is decided inside each SQL function, using the identity that Supabase
verified. The tables are in a schema the Data API does not expose, with row-level security
on, no policies and no grants; `tests/parity/privileges.test.ts` proves that a signed-in
caller cannot read or write them directly.

This is also why the backend is sealed: the model that builds the screens cannot weaken a
rule, because the rules are not in the screens.

## Identities

| Identity | Created by | Stored in the browser as | Becomes useful when |
|---|---|---|---|
| Device | `signInAnonymously()` on first visit | Supabase session under `localStorage` key `qb-device` | A parent approves its pairing code; then the PIN unlocks it for `unlock_minutes` |
| Parent | Google sign-in (PKCE redirect) | Supabase session under `localStorage` key `qb-parent` | The e-mail is on the allowlist and `claim_parent()` has run |
| Automation | A parent presses "New key" in Settings | Script property in the parent's Apps Script project | Always; read-only; replaceable |

Two Supabase clients run side by side (`src/api/supabaseBackend.ts`), one per identity, so
a parent can sign in on his laptop without unlinking it. Clearing the browser's site data
forgets the device; a parent then links it again.

## Security properties (each one is covered by a contract test)

- A stranger with the app's address and key gets `role: 'none'` and nothing else.
- Only a Google sign-in whose e-mail is on the allowlist can become a parent; an
  e-mail-and-password account with the same address cannot.
- A device sees nothing until a parent types its six-character code (valid 15 minutes).
- A linked device needs the PIN. The PIN is salted and hashed in the database, compared
  only there. Five wrong tries lock PIN entry for five minutes. Changing the PIN locks every
  device.
- A display device can read one child's board and can never write.
- He cannot edit, delete or silently drop a must-do, plan into the past, or reach parent
  functions. A parent decides drop requests.
- The automation token reads summaries and backups; it cannot change anything. Only its
  hash is stored. A backup file contains no PIN, token, device or e-mail address.
- `admin_setup` and every internal helper are not callable through the API.

Known limits, accepted for a family tool: the PIN is four digits (the lockout is what
protects it); anyone holding an unlocked device can act as him until it locks; a parent
account is as safe as that Google account.

## What is stored

His first name, his cards (titles, minutes, times, percentages, short notes), goals,
check-in notes, day marks, the parents' e-mail addresses (for sign-in and the weekly
e-mail), and device labels. No birthday, school, photo, location or contact list. Nothing
is sent to any other service: no analytics, no error reporting, no fonts from other sites.

## Front-end structure

```
src/main.tsx                 fonts, tokens.css, <App />
src/App.tsx                  routes
src/app/connection.ts        getConnection(): demo, or Supabase when both env values are set
src/app/session.tsx          SessionProvider, useSession(), DeviceGate, ParentGate
src/app/useLoad.ts           useLoad(loader, deps) and useAction(reload)
src/app/errors.ts            errorText(code): one friendly sentence per error code
src/components/              Icon, CardTile, Sheet (dialog), Toast, PercentPicker, PlaceForm, ...
src/screens/Link.tsx         pairing code
src/screens/Unlock.tsx       PIN pad
src/screens/kid/             Today, Week, Month (+ their parts)
src/screens/parent/          Home, Plan, Settings, SignIn
src/screens/display/         Display (extra)
```

Routes:

| Path | Screen | Gate |
|---|---|---|
| `/` | Today | DeviceGate |
| `/week`, `/week/:monday` | Week | DeviceGate |
| `/month`, `/month/:yyyy-mm` | Month | DeviceGate |
| `/parent` | This week | ParentGate |
| `/parent/plan` | Must-dos | ParentGate |
| `/parent/settings` | Settings | ParentGate |

**DeviceGate** decides what a device sees, in this order:

1. `await conn.ensureDeviceSession()`, then `me = await api.whoami()`.
2. `me.device` is `null`, or its status is `revoked` or `pending` → **Link** screen. It calls
   `deviceStartPairing()` (once when there is no valid code, and again from a "New code"
   button), shows the code, and asks `whoami()` every 4 seconds until the status is `approved`.
3. `me.role === 'display'` → **Display** screen (until that extra is built: a plain
   "This screen is display only" message).
4. Approved kid device and `me.role === 'none'` → **Unlock** (PIN pad).
5. `me.role === 'kid'` → the requested screen.

Any call that fails with `locked` sends the app back to step 1 (the unlock simply ran out).

**ParentGate**:

1. `conn.parentSession()` is `null` → **SignIn** ("Sign in with Google"; in demo mode the
   button reads "Enter as demo parent").
2. `me = await parentApi.whoami()`. Role `parent` → the requested screen.
3. Otherwise, if `me.can_claim_parent` → `claimParent()`, then the screen.
4. Otherwise → "This Google account is not on the parent list", the e-mail, and "Sign out".

Parents act on the first child in `whoami().children`.

**Loading and changing data.** Each screen loads what it needs with `useLoad` and, after
every successful change, calls `reload()`. Screens also reload when the window regains
focus and once a minute while visible, so a change made on another device shows up. No
optimistic updates, no client-side cache library: the data is small and correctness matters
more than speed.

**Time.** The server's `today` and time zone drive every date. The only use of the
browser's clock is the "now" line on the timeline: `minutesInZone(Date.now(), timezone)`.

## Demo mode

`createDemoConnection(localStorage, {base, plan})` builds a whole family in the browser:
one parent, Anush with PIN 1234, this browser already linked, the seed library, the starter
plan moved to the current week, and a few days of made-up activity. It runs the same
functions as the database, ported line by line and compared by the parity tests. It is
for trying things and for tests; it is not private (anyone with the browser can read it)
and not shared between devices. The app shows a small "Demo" badge whenever it is active.

## Hosting, backup, moving

- **Hosting.** `npm run build` writes `dist/`; any static host works. `public/_redirects`
  makes Cloudflare Pages serve `index.html` for every path. The two environment values are
  read at build time and are public by design.
- **Backup.** Settings → "Download a backup" saves one JSON file (`exportData()`). The Apps
  Script saves the same file to Google Drive every Sunday and keeps the newest twelve.
- **Restore or move.** New Supabase project → run the migrations and `admin_setup` → sign in
  as a parent → Settings → "Restore from a backup". Devices are linked again with codes;
  the PIN is set again (neither is in the file, on purpose).
- **Free-plan limits that matter.** A free Supabase project pauses after a week without
  requests; the script's daily ping prevents that, and un-pausing is one click. There are no
  automatic database backups on the free plan; the Drive copy is the backup.

## Phase 2 hooks already in place

A `display` device kind (read-only), `automation_schedule()` (timed cards as plain data),
and `calendarSync()` in the Apps Script (copies them into a Google Calendar named
"Questboard"). See `docs/07-phase-2.md`.
