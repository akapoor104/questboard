# T17 Extra: Nest Hub calendar and spoken reminders (phase 2)

**Goal.** The kitchen Nest Hub Max shows his timed cards for the day and announces two
fixed reminders.

**Needs.** T14. Done together with a parent, in Google's apps. Read `docs/07-phase-2.md`
first: it says what the Hub can and cannot do and lists the steps.

**Files.** `automation/apps-script/Code.gs` only if `calendarSync()` needs a fix;
`docs/07-phase-2.md` to record what turned out to be true.

## Steps

1. The parent does steps 1 to 3 of "Steps when the time comes" in `docs/07-phase-2.md`.
2. `installCalendarSync` runs `calendarSync()` once. Expected first-run problems:
   | Message | Meaning |
   |---|---|
   | `Create a Google Calendar named "Questboard" first.` | The name must match exactly |
   | An authorization prompt | Expected: the script now also needs calendar access |
   | Events appear at the wrong hour | The calendar's time zone differs from the family's; set the calendar's time zone in Google Calendar settings |
3. Place three timed cards on today in Questboard. After the next sync (15 minutes, or run
   `calendarSync` by hand): three events with the same titles and times. Move one card,
   resolve another: after the next sync the first moved and the second disappeared.
   Events the family made themselves in that calendar are untouched.
4. On the Hub: the calendar shows them. Ask it what is on the calendar today.
   If the Hub does not show the "Questboard" calendar, record exactly what was tried in
   `docs/07-phase-2.md`; the fallback is a spare tablet running the display screen (T15).
5. Two household automations in the Google Home app (time starter, announcement action),
   wording chosen with Anush.
6. Update the status column of the table in `docs/07-phase-2.md` with what was observed and the date.

## Done when

- [ ] Timed cards appear on the Hub (or the fallback is in place and the reason is written down).
- [ ] Two announcements run at the agreed times for three days, and Anush still wants them.
- [ ] `docs/07-phase-2.md` reflects what was actually observed.
