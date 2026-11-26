# Questboard: what it is and how it behaves

Read this once. It is the plain-language version of the rules that the backend enforces
(`docs/04-data-and-api.md` has the exact functions).

## People

| Who | Signs in with | Can do |
|---|---|---|
| **Anush** (10) | A profile tile and a 4-digit PIN, on a device a parent has linked | Plan his week and day, start cards, say how much he did, close out his day, write his own cards and library items, lead the weekly check-in |
| **Parents** (two) | Google, limited to the e-mail addresses on the family's list | Everything he can do, plus: must-dos, focus areas, days off, notes, decide drop requests, devices, PIN, settings, backup |
| **Display** | Nothing (a device linked as "display only") | Read his board. It cannot change anything. Meant for a kitchen screen (phase 2) |

One family, one child. The data model allows more children; the screens show the first.

## Words

- **Card**: one task. Title, category, planned minutes (5 to 480), and either *must-do*
  (set by a parent) or *my pick* (his choice).
- **Category**: one of nine color-coded groups, each with an icon. "Structured" categories
  (Math & School, Build & Code, Music, Story & D&D) count toward the weekly load guide;
  "free" ones (Reading & Rest, Fun & Friends, Outdoors & Scouts, Home & Helping,
  Plan & Reflect) do not.
- **Library**: about 100 ready-made card ideas from the family's plan. He adds cards from
  it, or writes his own.
- **This week's stack**: cards planned for "some day this week" with no day yet.
- **Day**: cards for one date. A card on a day can have a clock time (5-minute steps) or be
  "any time".
- **Catch-up tray**: leftovers. A card that was not fully done leaves a smaller card here.
- **Close-out**: the end-of-day step. Allowed once every card of that day has a percent.
- **Campfire**: the streak of days in a row that were closed out.
- **Focus areas**: up to three goals for a week, agreed at the Sunday check-in. They can
  change every week. Monthly goals sit above them.
- **Check-in**: Sunday review that he leads: keep, change, stop, start.

## The life of a card

```
Library ──add──▶ This week's stack ──give it a day (and a time)──▶ Day
                                                                     │ Start (optional; one card at a time)
                                                                     ▼
                                                        "How did it go?"  0 / 25 / 50 / 75 / 100 %
                                              100 % ──▶ done
                                              less  ──▶ done at that percent, and the rest becomes
                                                        a new, smaller card:
                                                          - in the Catch-up tray (default), or
                                                          - on a day and time he picks now, or
                                                          - let go (his own picks only)
```

## Rules

1. **Who makes what.** Cards a parent adds are must-dos unless the parent says otherwise.
   Cards he adds are always "my pick".
2. **He can move anything, but not into the past.** He can give any open card a new day and
   time from today onward, or put it back in this week's (or a later week's) stack.
3. **He cannot delete or edit a must-do.** He can edit and drop his own picks. To drop a
   must-do he asks ("Ask to drop", with a reason); the card stays until a parent decides
   *Keep it* or *Let it go*. Only parents can delete a card outright.
4. **Percent done.** Any whole percent from 0 to 100 is accepted; the screen offers 0, 25,
   50, 75, 100. A short note ("what got in the way?") is optional. Time spent is planned
   minutes times percent.
5. **Leftovers.** Below 100 %, the minutes left (rounded to 5, at least 5) become a new card
   with the same title, category and kind, linked to the original. For a must-do he cannot
   choose "let it go"; he can only ask a parent.
6. **No finishing the future.** A card on a later day cannot be resolved yet. A card in the
   stack or the tray can: it is then counted on today.
7. **Undo.** A resolved card can be reopened: by him for today's and yesterday's cards, by a
   parent for any. Reopening removes its leftover card, unless that leftover has already been
   used (started, resolved or carried again). It also un-closes that day.
8. **Start and stop.** Starting a card puts it on today and marks it "doing now". Starting
   another card stops the first. Starting is optional.
9. **Close-out.** He can close a day (today or earlier) when none of its cards are still
   open. He can add a mood (1 to 5) and a note. Closing again just updates them.
10. **Campfire.** Counts closed days in a row, ending today or yesterday. Days marked Rest
    or Away are skipped: they neither add to it nor break it.
11. **Days off.** Parents mark a date *Rest* or *Away*. The campfire skips those days and
    the screens show the mark instead of an empty day. Cards can still be planned on them.
12. **Unconfirmed cards.** An open card on a past day is "unconfirmed": he still has to say
    how much he did. It is the first reminder on his board.
13. **Load check.** The week view totals planned minutes in structured categories against
    the family's weekly guide (540 minutes to start). It informs; it never blocks.
14. **Word of the day and encouragement.** One of each per day, the same for everyone, picked
    by the date. He can tick "I used it today" for the word.
15. **Parent note.** A parent can leave one short note per date; he sees it on that day.

## Reminders

| Reminder | Who sees it | When |
|---|---|---|
| Cards from earlier days still need a percent | Anush, parents | Any open card on a past day |
| Catch-up tray | Anush (always, as the tray itself); parents as an alert | Parents: at or above the family's threshold (5 cards to start) |
| A must-do is due within two days and has no day in time | Anush, parents | Until it is placed on or before its due date, or done |
| He asked to drop a must-do | Parents | Until they decide |
| Weekly summary e-mail | Parents | Sundays, from the parents' own Google account (ticket T14) |

There are no push notifications and no sounds in the first version.

## Screens

| Area | Screen | Purpose |
|---|---|---|
| Entry | Link this device | Shows a six-character code for a parent to approve |
| Entry | PIN pad | "Hi, Anush": four digits open his board |
| Anush | Today | The day on a clock timeline, this week's stack, the tray, the word and the encouragement, close-out |
| Anush | Week | Seven days, the week's focus, the load check, the Library |
| Anush | Month | Monthly goals, where the time went, a calendar of closed days, the last check-in |
| Parents | This week | What needs a parent, how the week went, time by category |
| Parents | Must-dos | Focus areas, must-dos, days off, a note for tomorrow |
| Parents | Settings | Devices, PIN, parent accounts, weekly e-mail key, backup and restore |
| Display | Kitchen screen | Read-only "now and next" (extra, January) |

`docs/05-design.md` describes each screen; `design/screens/` has the pictures.

## Deliberately not in the first version

Points, prizes, leaderboards or any reward for volume. Push notifications. Chat. Photos or
file uploads. More than one child on screen. Any AI feature. Any sharing outside the family.
Drag and drop (an extra: tapping always works). Editing the word list in the app.
