# Phase 2: the kitchen Nest Hub Max

Planned for the second half of January, after two weeks of real use. Nothing here is
needed for the first version, but the first version already contains the hooks.

## What the Hub can and cannot do (checked November 12, 2026)

| Goal | Route | Status |
|---|---|---|
| See today's plan on the Hub | The Apps Script copies his timed cards into a Google Calendar named "Questboard" in a parent's account, shared with the home's Google account | Likely to work. Nest displays show the account's main calendar and shared or Family calendars added in the Google Home app; they do not show imported (iCal link) calendars, which is why the script writes real events. Test for 30 minutes before relying on it |
| Ask "what's on my agenda today?" | The Assistant (or Gemini for Home, if the home was upgraded) reads calendar events aloud | Works for calendars the Hub can see. Upgrading a home to Gemini for Home cannot be undone |
| Spoken reminders at fixed times | A Google Home automation: a time starter and a "broadcast" action | Works for fixed wording, for example "Time to plan your day" at 8:30 AM and "Close out your board" at 7:30 PM |
| Speak his actual next card | A spare tablet or laptop in the kitchen showing the display-only board, using the browser's speech synthesis | Possible in a browser; not on the Hub itself |
| Mark a card done by voice | None found | Not planned |

No supported way was found for a custom web app to speak or to take voice commands on a
Nest Hub. The design therefore goes through Google's own calendar and automation features.

Sources: Google Nest Help "Manage calendar and event information"
(support.google.com/googlenest/answer/7029002), Google Home Help "Gemini for Home voice
assistant" (support.google.com/googlehome/answer/16618650), Google Home developer reference
"broadcast command" (developers.home.google.com/automations/schema/reference/entity/assistant/broadcast_command).

## What is already built for it

- **Display devices.** `deviceApprove(code, childId, 'display')` links a screen that can read
  his board and never change it, with no PIN. Ticket T15 builds its screen.
- **`automation_schedule(token, from, to)`.** Timed cards as plain data: title, category,
  date, start, minutes, status.
- **`calendarSync()` and `installCalendarSync()`** in `automation/apps-script/Code.gs`. Every
  15 minutes: create, move or remove events in the calendar named "Questboard" so that it
  mirrors his open timed cards for the next seven days. It only touches events it created
  (they carry a `qb_card_id` tag). Not yet run against a real calendar.

## Steps when the time comes (ticket T17)

1. In Google Calendar (parent account): **Other calendars → Create new calendar**, name it
   exactly `Questboard`. Share it with the account the Hub uses if that is a different one.
2. In the Google Home app: make sure the Hub shows that account's calendars (Settings →
   the Hub → Calendar, or the account's "Personal results" setting), and tick "Questboard".
3. In the Apps Script project: run `installCalendarSync` once and approve the calendar permission.
4. Place two timed cards for today in Questboard; within 15 minutes they appear on the Hub's
   calendar view. Ask the Hub "what's on my calendar today?".
5. In the Google Home app: **Automations → Add** two household routines with a time starter
   and the action "Make an announcement" (broadcast): morning planning and evening close-out.
6. Decide with Anush which spoken reminders he actually wants. Remove the rest.

## Ideas held for later

- The display screen reads the next card aloud at its start time (browser speech synthesis;
  needs a tap once per session to allow sound).
- A "next card" complication for a watch or phone widget through the same schedule feed.
- A second child: the data model allows it; the screens would need a profile picker.
