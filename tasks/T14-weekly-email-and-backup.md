# T14 Weekly e-mail and Drive backup

**Goal.** Every Sunday both parents get a one-screen summary to talk through with Anush,
a backup lands in Google Drive, and the free database is pinged daily.

**Needs.** T13. Done together with a parent; nothing here runs on the computer.

**Read first.** `docs/02-setup-guide.md` (part 7); `automation/apps-script/Code.gs` (the
header comment and the part below "Apps Script glue"); `tests/unit/automation.test.ts`.

**Files.** `automation/apps-script/Code.gs` only if a Google service behaves differently
from what the code assumes; `tests/unit/automation.test.ts` for any change above the
"Apps Script glue" line.

## Steps

1. The parent follows part 7 of the setup guide. Claude Code helps read any error message.
   Known first-run cases:
   | Message | Meaning |
   |---|---|
   | `Set SUPABASE_URL, SUPABASE_KEY and QB_TOKEN ...` | A script property is missing or misspelled |
   | `The automation key is wrong or was replaced` | Make a new key in Settings, update `QB_TOKEN` |
   | `Supabase refused the key (401)` | `SUPABASE_KEY` is not the publishable key, or has a space or line break in it |
   | `Questboard request failed (404)` with `PGRST202` | Run `notify pgrst, 'reload schema';` in the SQL editor |
2. `sendTestToMe` → the parent reads the e-mail on a phone and checks it against
   `/parent` for the same week: time done, days closed out, must-dos, the tray.
3. Run `driveBackup` once by hand → a file appears in the Drive folder "Questboard backups".
   Download it and compare its size with a backup downloaded from Settings (same order of size).
4. **Triggers** (clock icon in the script editor): three are listed (`weeklySummary` Sunday,
   `driveBackup` Sunday, `keepAwake` daily).
5. If the e-mail's wording or order should change, change `buildSummaryHtml` /
   `qbTalkingPoints` (above the glue line), update `tests/unit/automation.test.ts`, run
   `npm run check`, and have the parent paste the new file into the script editor.
6. The following Sunday evening: confirm that both parents received the e-mail and note the
   date in `tasks/STATUS.md`.

## Done when

- [ ] The test e-mail arrived and its numbers match the parent screen.
- [ ] A backup file is in Drive, and restoring is understood (setup guide, "Everyday jobs").
- [ ] Three triggers exist.
- [ ] `npm run check` passes if `Code.gs` changed.

## Not in this ticket

The calendar sync (T17). Daily e-mails. Notifications to Anush.
