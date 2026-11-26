# T13 Go live: Supabase, Google sign-in, Cloudflare Pages

**Goal.** The family's real board is online: parents sign in with Google, his devices are
linked, and the trial can start.

**Needs.** T12 for the trial. Parts A and B can be done any time after T03 if a parent
wants the accounts ready early.

**This ticket is done together with a parent.** The parent clicks through the dashboards
with `docs/02-setup-guide.md`; Claude Code runs the commands, checks the results, and fixes
`src/api/supabaseBackend.ts` if the real service behaves differently from what was assumed.

**Read first.** `docs/02-setup-guide.md` (all); `docs/03-architecture.md` ("Identities");
`src/api/supabaseBackend.ts`; `src/app/connection.ts`; `.env.example`.

**Files.** `.env.local` (never committed), `src/api/supabaseBackend.ts` only if needed,
`tests/unit/` for any helper you extract, `tasks/STATUS.md`.

## Safety rules for this ticket

- The only values that go into `.env.local` are the project URL and the **publishable** key.
  If a parent pastes anything starting with `sb_secret_`, or a long `eyJ...` key labelled
  "service_role" or "secret", stop: do not write it to any file, and ask them to rotate it
  in the Supabase dashboard.
- Never print or commit `.env.local`. Never put a parent's e-mail address in a file in this
  repository. `admin_setup` is run by the parent in the Supabase SQL editor, not from here.
- Do not run browser tests or scripts against the real project. `npm run check:e2e` always
  uses demo mode and stays safe to run.
- Do not change anything in `db/`. If a migration fails in the SQL editor, copy the exact
  error into `tasks/BLOCKED.md`.

## Part A: accounts (parent, with the setup guide)

Setup guide parts 3 and 4. Claude Code's job: answer questions, and afterwards ask the parent
to confirm each line:

- [ ] All five migration files ran; `005_grants.sql` showed three rows saying `true`.
- [ ] `admin_setup` ran with the family's time zone and both parents' addresses.
- [ ] `db/seed.sql` ran.
- [ ] Anonymous sign-ins are on. Google provider is on with the client ID and secret.
- [ ] Redirect URLs include `http://localhost:5173/**`.

## Part B: connect and verify (Claude Code and parent)

1. Create `.env.local` from `.env.example` with the two values. Confirm `git status` does
   not list it.
2. `npm run dev`. Open http://localhost:5173. Expected: **no** `Demo` chip, and
   `Link this device` with a code.
   - `Demo` chip still there → the values are missing or the server was not restarted.
   - An error instead of a code → open the browser console and match the message with the
     table at the end of the setup guide.
3. Open http://localhost:5173/parent → `Sign in with Google` → back on `Anush's week`.
   - If the page returns signed out: check `detectSessionInUrl` and `flowType: 'pkce'` on the
     parent client, and that the redirect URL is allowed in Supabase. Fix in
     `src/api/supabaseBackend.ts` only.
4. In Settings: set the PIN; link the device from step 2; enter the PIN on it.
5. Walk through these on the real backend and tick each:
   - [ ] A card added from the Library appears in the stack.
   - [ ] Resolve a card at 50%: the leftover is in the tray.
   - [ ] A must-do added by the parent appears on his screen within a minute, without a reload.
   - [ ] He asks to drop it; the parent decides.
   - [ ] Close-out works and the campfire shows 1 day.
   - [ ] Lock, reload: the PIN pad returns. A wrong PIN is refused.
   - [ ] Sign the parent out: `/parent` shows nothing but the sign-in screen.
   - [ ] In a private window (no session), the browser's network tab shows that a request to
         `/rest/v1/cards` or `/rest/v1/rpc/export_data` is refused.
   - [ ] Settings → Download a backup gives a file; open it and check it has his cards and no PIN.
6. If any error text shown to the user was the generic one where a specific sentence was
   expected, check how the error arrives (`error.message` should contain `QB:<code>`) and
   fix the mapping in `supabaseBackend.ts`. Add a unit test for the helper you change.

## Part C: put it online (parent, setup guide part 6)

1. `npm run check`, then `npm run build`.
2. The parent uploads `dist` to Cloudflare Pages and adds the site address to Supabase's
   Site URL and Redirect URLs and to the Google client's JavaScript origins.
3. On the parent's phone: open the site's `/parent`, sign in, add to the home screen.
4. On each of his devices and the family computer: open the site, link it from the phone.
5. Delete the test cards made in Part B, or restore the backup from before testing.

## Done when

- [ ] Every box in Parts A, B and C is ticked by a person, not assumed.
- [ ] `npm run check:e2e` still passes (demo mode) with `.env.local` present.
- [ ] `tasks/STATUS.md`: T13 ticked, with the site name under Notes (the address is not a secret).
- [ ] Any change to `supabaseBackend.ts` is committed with a sentence saying what differed.

## Then

The trial checklist in `docs/06-testing.md` with Anush (December 5 to 10). His comments go
under Notes in `tasks/STATUS.md`; small fixes are done as normal tickets-in-miniature: one
change, `npm run check:e2e`, commit.
