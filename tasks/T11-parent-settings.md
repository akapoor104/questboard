# T11 Parents: Settings

**Goal.** A parent links and removes devices, sets the PIN, manages who the parents are,
creates the automation key, downloads and restores backups, and changes family settings.

**Needs.** T10.

**Read first.** `docs/05-design.md` ("Parent: Settings"); `design/screens/parent-settings.png`;
`docs/04-data-and-api.md` ("Session and devices", "Settings", "Backup");
`docs/03-architecture.md` ("Identities", "Security properties").

**Files.** Replace `src/screens/parent/Settings.tsx`. Create under
`src/screens/parent/settings/`: `DevicesPanel.tsx`, `LinkDevicePanel.tsx`, `PinPanel.tsx`,
`ParentsPanel.tsx`, `AutomationPanel.tsx`, `BackupPanel.tsx`, `FamilyPanel.tsx` (+ `.css`);
`src/lib/settings.ts`, `tests/unit/settings.test.ts`, `e2e/parent.settings.spec.ts`.

## Steps

1. **`src/lib/settings.ts`** (pure, tested):
   - `cleanPairCode(text): string` (upper case, letters and digits only, at most 6).
   - `validPin(pin): boolean` (exactly four digits).
   - `validEmail(text): boolean` (something@something.something, no spaces).
   - `deviceStatus(device: DeviceRow): string` → the three sentences in the design guide.
   - `backupFileName(today: string): string` → `questboard-backup-2026-12-21.json`.
   - `parseBackup(text: string): ExportDoc` → throws `Error('not a Questboard backup')` unless
     it is JSON with `version === 1` and a `tables` object.
   - `TIME_ZONES`: a short list for the select (the four mainland US zones, Alaska, Hawaii,
     plus the current value if it is not in the list).
2. **`DevicesPanel`**: `deviceList()`; `Remove` → confirm → `deviceRevoke(user_id)`.
3. **`LinkDevicePanel`**: the code field shows what `cleanPairCode` keeps, formatted
   `ABC-DEF`; `autocapitalize="characters"`, `autocomplete="off"`, `inputmode="text"`.
   `Link` → `deviceApprove(code, child.id, kind, label || undefined)`. On `bad_code` keep the
   form and show the sentence. Success: toast `Device linked.`, clear the form, reload the list.
4. **`PinPanel`**: two password-type inputs with `inputmode="numeric"`,
   `autocomplete="off"`; both must be four digits and equal. `setChildPin(child.id, pin)`;
   toast `PIN changed. His devices are locked.` Clear the inputs afterwards; never keep the
   PIN in state after saving.
5. **`ParentsPanel`**: list from `getSettings().parent_emails`, marking which have signed in
   (`parents`). `Edit`: add an address (`validEmail`), remove others (your own has no remove
   button). Save → `updateSettings({ parent_emails })`.
6. **`AutomationPanel`**: `New key` → confirm when one exists (`This replaces the old key.`)
   → `rotateAutomationToken()` → show the token once in a read-only input with `Copy`
   (`navigator.clipboard.writeText`). Keep it only in component state; it disappears when
   the panel is left. Under it, the plain text `Setup steps: part 7 of the setup guide.`
7. **`BackupPanel`**:
   - `Download a backup`: `exportData()` → a Blob → a temporary `<a download>` click, named
     with `backupFileName(parentMe.today)`.
   - `Restore from a backup`: a file input (`accept="application/json,.json"`) →
     `parseBackup` → show what is in it (`{n} cards, {n} library ideas, exported {date}`) →
     the parent types `RESTORE` → `importData(doc)` → toast `Board restored.` → reload.
     A wrong file shows `That file is not a Questboard backup.` and changes nothing.
8. **`FamilyPanel`**: the fields in the design guide. Times as `<input type="time">`
   (convert to minutes); hours as numbers (`unlock_minutes / 60`,
   `structured_weekly_max_min / 60`, half hours allowed). Validate before sending:
   day start before day end. `updateSettings(patch)` with only the changed fields.
9. `Sign out` → `conn.signOutParent()` → `refreshParent()`.
   Demo mode: `Reset the demo` → confirm → `resetDemo()` from `src/app/connection.ts`.

## Browser test `e2e/parent.settings.spec.ts` (phone)

Start with `openParent(page, '/parent/settings')`.

1. `Linked devices` lists `This browser` with `His board, locked`.
2. **PIN.** `Change` → `4321` twice → `Save PIN` → toast. On `/`: `1234` shows
   `That PIN did not match.`; `4321` opens the board.
3. **Pairing.** `Remove` on `This browser` (confirm) → `/` shows `Link this device` and
   `This device was removed.` → read the code from `pair-code` → back in Settings type it,
   `His device`, `Link` → toast `Device linked.` → `/` shows `Hi, Anush`.
4. **Display only.** As test 3 but choose `Display only` → `/` shows
   `This screen is display only.`
5. **Wrong code.** Type `AAAAAA`, `Link` → `That code did not work.`
6. **Key.** `New key` → `token-value` holds 64 characters from `0-9a-f`; the status reads `Key created`.
7. **Backup and restore.** `Download a backup` (use `page.waitForEvent('download')`), read
   the file: `version` is 1 and `tables.cards` is not empty. Then restore that same file,
   type `RESTORE`, confirm → toast `Board restored.` → `/` still accepts the PIN and shows
   the same five cards today.
8. **Not a backup.** Choosing a file containing `{"hello":1}` shows
   `That file is not a Questboard backup.`
9. **Family.** Set `Alert me when the tray holds (cards)` to `1`, `Save` → on `/parent` the
   tray line reads `Catch-up tray: 1 card, 30 min. You are alerted at 1 card.` and is marked
   as an alert (`data-testid="alert-tray"`, bold, alert icon), and `Nothing needs you right
   now.` is not shown.
10. **Parents.** Add `grandma@example.com` → it is listed. Your own address has no remove button.
11. **Reset.** `Reset the demo` → confirm → the PIN pad; after `1234`, Today has five cards again.

## Done when

- [ ] `npm run check:e2e` passes.
- [ ] Compared with `design/screens/parent-settings.png` at 390px.
- [ ] The token and the PIN are never written to `localStorage`, the URL or the console
      (search the code for `localStorage` and `console.`: only `src/api/` may use `localStorage`).
- [ ] After a restore, nothing on screen is stale (all panels reloaded).

## Not in this ticket

Categories and library management, more than one child, deleting the family's data
(a parent can do that in the Supabase dashboard).
