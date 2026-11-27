# Repeating cards (series)

Agreed with a parent on 2026-11-27. Tickets T18 (backend), T19 (the repeat form) and T20
(managing a series) build it. This page is the reference for all three; where a ticket and
this page disagree, stop and ask.

**Why.** Lessons, classes, daily habits and monthly events take many identical cards. A
parent (or Anush, for his own picks) describes the pattern once and the board fills itself.

## Words

- **Series**: a pattern that makes cards: title, category, minutes, kind, details, a
  *repeat rule*, an *end*, and two switches (*If missed*, *Allows reschedule*).
- **Occurrence**: one date the rule produces. Each card a series makes remembers its series
  and its occurrence (`series_id`, `series_date`, `series_slot`).
- **Look-ahead**: the server keeps every active series filled **28 days** ahead of today
  (today through today + 27). A series with an end date or a count is never filled past its end.

## Repeat rules

| Rule | Examples |
|---|---|
| Every day | Reading, 20 min, any time |
| Every weekday (Mon to Fri) | Math Academy lesson, 9:00 AM |
| Chosen weekdays, every N weeks (N = 1 to 4) | Piano Tue 4:00 PM; swim Mon and Wed every 2 weeks |
| Twice a month (or more): chosen days of the month | The 1st and the 15th |
| Twice a month (or more): chosen *nth weekdays* | The 1st and 3rd Saturday; scouts every 2nd Saturday |
| Every N months (N = 1 to 12) on a day or an nth weekday | Monthly review on the last Sunday |
| A number of times each week, he picks the days | Music practice, 3 times a week (cards go to that week's stack) |

"Bimonthly" means **twice a month**. "Last" is allowed as an nth weekday (`n = -1`). A day
of the month past the month's end (the 31st in February) is skipped that month.

**Where the card goes**, one of:

- *At a time*: the same time every day, or a time per weekday (Mon 4:00 PM, Wed 5:30 PM);
  5-minute steps, as everywhere.
- *Any time that day*.
- *Some day that week*: the week's stack (only for "a number of times each week").

**Ends**, one of: *never* (filled 28 days ahead, forever), *on a date*, *after N times*
(1 to 200). Occurrences are counted from the series' first date; skipped occurrences
**count** (10 classes with one skipped means 9 cards happen). The end never moves by itself.

## Rules (enforced by the server)

1. **Who.** A parent can make, change, skip in and end any series; its cards are must-dos
   unless the parent chooses "my pick". Anush can make series of his own picks and change,
   skip in and end **his own** series only *(assumed; confirm with a parent before T18)*.
2. **One card at a time.** Every card a series makes is a normal card: he can start it, move
   it (rule 2 of the product: not into the past), resolve it, and ask to drop it, as today.
   Moving one card never changes the series.
3. **Changing a series** ("from {date}"): every open, not-started card of that series on or
   after the date is removed and made again from the new pattern, **including cards he moved
   by hand**. Resolved, started and dropped cards are left alone. For a count series, the
   number still to come is the count minus the occurrences before that date.
4. **Skipping a date.** The occurrence is recorded as skipped and its card (if made) is
   removed. If the series *allows reschedule*, the card is not removed but goes to the
   catch-up tray marked "needs a new day"; he or a parent gives it a day as with any tray card.
5. **Rest and Away days.** An occurrence on a date marked Rest or Away is skipped (rule 4).
   This also applies when a parent marks the day after the card was made, as long as the
   card is still open and not started.
6. **If missed.** Each series is either *Make a catch-up card* (today's rule: below 100 %,
   the rest becomes a smaller card) or *Let it pass* (below 100 %, the percent is recorded and
   no leftover is made, for must-dos too, with no parent needed). Defaults: *Let it pass* for
   cards at a time or any time that day, *Make a catch-up card* for "a number of times each week".
7. **Unanswered occurrences** are like any card: an open card on a past day is unconfirmed
   and he is asked for a percent.
8. **Ending a series** ("from {date}", default today): no more cards; open, not-started
   cards from that date on are removed. Everything already done stays.
9. **Load check and stats** count series cards like any other card.
10. **Backup** includes series and skipped dates; restoring an older backup without them works.

## Screens (summary; exact wording in `docs/05-design.md` once T19 and T20 add it)

- A **Repeats** field (default `Does not repeat`) in `Add a must-do` (parents), his
  `New card` (Week), and `Make it repeat` in a card's sheet.
- Presets from the chosen date, then `Custom...` with weekday chips, a
  `Same time each day` switch, ends, *If missed* and *Allows reschedule*.
- A **preview** from the server before saving: the first dates, how many cards, and the
  dates that will be skipped (Rest/Away) or that clash with a timed card. One button:
  `Add {n} cards` (or `Start repeating` for a series that never ends).
- A **Repeating** panel on parent Must-dos (all series) and on his Week (his own series,
  and a parent's shown without buttons). A row: title, the rule in words, what is left.
- A series card's sheet shows `Repeats: {rule}`; the owner (or a parent) also gets
  `Change the series`.

## Deliberately not included

Exceptions such as "every Tuesday except school holidays" beyond Rest/Away marks; series
for several children at once; importing a school or Google calendar; reminders or
notifications for series.
