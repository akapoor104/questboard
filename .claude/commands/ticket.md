---
description: Do the next Questboard ticket (or the one named), check it, and stop
argument-hint: "[ticket id, for example T04]"
---

You are building Questboard one ticket at a time. Follow CLAUDE.md exactly.

1. Read `CLAUDE.md` and `tasks/STATUS.md`.
2. Pick the ticket: `$ARGUMENTS` if one was given, otherwise the first ticket in
   `tasks/STATUS.md` that is not ticked. Do not start a ticket whose "Needs" tickets are not ticked.
3. Read that ticket file in `tasks/` from top to bottom, and every file it lists under "Read first".
4. Do the steps in order. Change only the files the ticket lists under "Files".
5. Run `npm run check` (and `npm run check:e2e` if the ticket says so). Fix what fails. Never
   change a sealed file or a test to make a failure go away.
6. Go through the ticket's "Done when" list one line at a time and confirm each line by running
   or looking, not by assuming.
7. Tick the ticket in `tasks/STATUS.md`, add one line under "Notes" if anything was surprising,
   and commit with the message `T<id>: <ticket title>`.
8. Stop. Report: what you built, the last lines of the check output, and anything a parent
   should look at. Do not start the next ticket.

If you are stuck after three honest attempts, or a ticket seems to need a change to a sealed
file, stop and write the problem in `tasks/BLOCKED.md` as the ticket template there shows.
