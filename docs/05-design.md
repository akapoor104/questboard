# Design guide

The pictures in `design/screens/` are the target. `design/mock/*.html` are the same screens
as static pages you can open and inspect (they use raw colors and inline styles because
they are an export; the app uses the tokens). This file says how to build them, and fixes
the exact wording that the browser tests rely on.

| Picture | Screen | Designed at |
|---|---|---|
| `unlock.png` | PIN pad | 520 x 720 |
| `kid-today.png` | Today | 1280 wide |
| `resolve.png` | "How did it go?" dialog | 520 x 720 |
| `kid-week.png` | Week | 1280 wide |
| `kid-month.png` | Month | 1280 wide |
| `parent-home.png` | Parent: This week | 390 x 844 (phone) |
| `parent-plan.png` | Parent: Must-dos | 390 x 844 |
| `parent-settings.png` | Parent: Settings | 390 x 844 |

## Principles

1. **Color belongs to categories.** Everything else is ink on paper: dark text, white
   panels, a pale ground. Do not add accent colors, gradients or shadows.
2. **A category is icon + name + color**, never color alone.
3. **His screens are calm and big.** One main thing per panel, 44px touch targets, no dense
   tables. Parent screens are compact and factual.
4. **No points, no confetti, no red marks.** A missed card is stated plainly ("0%") in the
   same ink as everything else. The only streak is the campfire.
5. **Words are short and kind.** "Half done is still half done." Never "failed", "overdue",
   "late" or "behind". Sentence case everywhere.

## Tokens and icons

- `src/ui/tokens.css` has every color, radius, space and font. Use `var(--ink)`,
  `var(--space-3)` and so on. `npm run check` fails on raw color values outside that file.
- Category color: put the class `cat-<color>` (from `category.color`: `cat-blue`,
  `cat-orange`, ...) on the element, then use `var(--cat)` (solid), `var(--cat-tint)`
  (card background), `var(--cat-tint2)` (the "planned" part of a bar) and `var(--cat-deep)`
  (text and icons on a tint). Unknown color names fall back to `cat-slate`.
- Fonts: `var(--font-display)` for h1/h2 and big numbers, `var(--font-ui)` for the rest.
  They are bundled by `src/main.tsx` (ticket T02); nothing is fetched from another site.
- Icons: `<Icon name="tent" size={16} />` draws `iconNodes(name)` from `src/ui/icons.ts`
  inside `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`. An icon next to text is
  decorative; an icon-only button needs an `aria-label`.
- Dark theme: set `data-theme="dark"` on `<html>` when `child.theme === 'dark'`. The tokens
  do the rest. Parent screens are always light.
- Shared classes already in `tokens.css`: `.btn`, `.btn-primary`, `.btn-small`, `.panel`,
  `.label`, `.muted`, `.card`, `.card-meta`, `.card-title`, `.chip`, `.bar-track`,
  `.bar-fill`, `.sr-only`.

## Layout

| Width | His screens | Parent screens |
|---|---|---|
| 1100px and up | As drawn: page padding 28px, Today in three columns (280px, flexible, 260px) | One 480px column, centered |
| 700 to 1099px (tablet) | Two columns: the timeline, and beside it the stack above the tray | Same |
| under 700px | One column in this order: reminders, Today, Catch-up tray, stack, word of the day | As drawn, bottom tab bar |

The top bar wraps instead of scrolling. Nothing scrolls sideways except the week's seven
day columns below 900px (they become a horizontal strip with scroll-snap).

## Shared pieces (`src/components/`)

| Component | What it is |
|---|---|
| `Icon` | See above |
| `CardTile` | One card. Root element: `<article class="card cat-<color>" data-testid="card" data-card-id data-status="open|resolved" data-kind="must|choice" data-doing="true|false">`. Inside: a `<button>` covering the title that opens the card sheet. Variants: `full` (stack, tray: category line, title, meta line, action buttons), `row` (any-time strip, week columns), `timed` (timeline block) |
| `Sheet` | The only dialog. `<div role="dialog" aria-modal="true" aria-labelledby>`; centered panel up to 520px on wide screens, bottom sheet under 700px. Focus moves in on open and back on close, Tab stays inside, Escape and the "Close" button close it, the page behind does not scroll |
| `Toast` | One line at the bottom for results ("Added to this week's stack") in an `aria-live="polite"` region; disappears after 4 seconds. Errors use `role="alert"` and stay until dismissed |
| `PercentPicker` | The five percent buttons with the live preview line |
| `PlaceForm` | Pick a day and a time; used by "Move", "Give it a time", "Give it a day" and the resolve dialog |
| `CategoryBar` | A bar per category: solid = spent, pale = planned, with "4 h 15 of 5 h" |
| `CampfireChip` | "Campfire: 6 days" with the flame icon; `data-testid="campfire"` |

### Card text

| Situation | Meta line |
|---|---|
| On a day with a time | `9:00 AM · 30 min` (`formatClock`, `formatDuration`) |
| On a day, any time | `30 min` |
| Must-do | add the pin icon and `Must-do` |
| His pick, in the stack | `My pick` |
| Doing now | `Doing now · started 9:45 AM` and `data-doing="true"` (2px outline) |
| Resolved at 100 | `done`, title struck through, check icon |
| Resolved below 100 | `50% done` (0: `not started`), title struck through |
| Drop requested | `Waiting for a parent to decide` |
| In the tray | `25 min left`, and, when the original card is in the loaded range, where it came from: `Saturday: 50% done. "Play date ran long."` |

## Wording contract

These exact strings are used by the browser tests. `{}` marks a value.

### Top bar (his screens)

- Brand text `Questboard`. `<nav aria-label="Main">` with links `Today`, `Week`, `Month`
  (`aria-current="page"` on the active one).
- `Campfire: {n} days` (`1 day`; with no streak: `Campfire: light it today`).
- A button with his avatar and name opens the **profile sheet** (title `My profile`): avatar
  choices (one button per `AVATAR_ICONS` entry, `aria-pressed`), `Light` / `Dark` buttons,
  and a link `Parent sign-in` to `/parent`.
- Icon button `aria-label="Lock my board"`.
- In demo mode, a small chip with the text `Demo` (`data-testid="demo-badge"`).

### Link this device

- h1 `Link this device`
- `Ask a parent to open Questboard on their phone, go to Settings, and type this code:`
- The code as `K7M-2QX` (three, dash, three) in `data-testid="pair-code"`.
- `This code works for 15 minutes.` Button `New code`. Link `Parent sign-in`.
- Revoked device: the same screen, with `This device was removed. A parent can link it again.`

### PIN pad

- h1 `Hi, {name}`; `Enter your PIN to open your board.`
- Four dots; the group has `aria-label="{n} of 4 digits entered"`.
- Buttons named `1` to `9` and `0`, and an icon button `aria-label="Delete"`. The pad
  submits by itself on the fourth digit and clears. Keyboard digits and Backspace work too.
- Wrong PIN, in `role="alert"`: `That PIN did not match. {n} tries left.` (`1 try left.`)
- Locked out: `Too many tries. Try again at {clock time}.` and the pad is disabled.
- No PIN yet: `Ask a parent to set your PIN.`
- Footer: `This device: {label}` and a link `Parent sign-in`.

### Today (`/`)

- h1: `formatLongDate(today)`, for example `Monday, December 21`.
- Under it the encouragement (`data-testid="encouragement"`).
- If there is a parent note: a panel with the label `A note from Mom or Dad` and the text.
- Region `Today's time`: `{planned} planned` · `{spent} done so far`, one stacked bar
  (a segment per category, widths by planned minutes) and a legend `Math & School 30`.
- Region `Word of the day`: the word, part of speech, definition, the example in quotes,
  and a button `I used it today` (`aria-pressed`; when pressed it reads `Used today`).
- Region `Reminders` (only when there is something), one row per alert, each
  `data-testid="alert-{type}"`:
  - `{n} cards from earlier days still need a percent.` (`1 card ... still needs`) button `Sort them out`
  - One due-soon card: `Must-do due {weekday}: "{title}" is not on a day yet.` button `Give it a day`.
    Several: `{n} must-dos are due soon and not on a day yet.` button `Show them`.
    (Use `dueSoonCards(board)` from `src/lib/board.ts` to name them.)
- Region `This week's stack`: h2, `{n} cards`, the hint `Planned for any day this week. Move a
  card to today when you are ready.`, the cards (identical must-dos collapse into one tile
  with `{n} more this week`), each with a button `To today`, and a link
  `Add from the Library` (to `/week#library`). Empty: `Your stack is empty. Add cards from the Library.`
  Open cards still sitting in an earlier week's stack are listed below, under the label
  `Left from earlier weeks`, so nothing disappears when a week ends.
- Region `Today`: h2 `Today`, hint `Tap a card to start it or to say how it went`. First a
  block labelled `Any time today`, then the timeline from `day_start_min` to `day_end_min`:
  one row per hour (`8 AM`), `var(--slot)` per 15 minutes, cards placed with `layoutDay()`,
  overlapping cards side by side. A thin "now" line with the time; it sits behind the cards,
  and the hour label next to it is hidden when they would touch (the mock gets this wrong).
  Empty day: `Nothing planned yet. Pick a card from your stack.`
- Region `Catch-up tray`: h2, `{n} cards · {minutes}`, hint `Leftovers wait here until you give
  them a new time.` Each card: buttons `Give it a time` and `Drop it` (his pick) or
  `Ask to drop` (must-do). Empty: `Nothing left over. Nice.`
- Region `Close out the day`: `{n} cards still need a percent. When every card has one, close
  the day to keep the campfire burning.` and a button `Close out today`, disabled until no
  card of today is open. When closed: `Today is closed out.` and a button `Change my note`.

### Card sheet (tap any card)

Title = the card title. Shows category, time, minutes, details, kind. Buttons by state:

| Card is | Buttons |
|---|---|
| Open, on today | `Start` (or `Stop` when doing), `Done`, `How did it go?`, `Move`, `Edit` (his picks; parents always), `Drop it` or `Ask to drop` |
| Open, on a later day | `Move`, `Edit`, `Drop it` or `Ask to drop` |
| Open, on an earlier day | `Done`, `How did it go?`, `Move` |
| Open, in the stack | `To today`, `Move`, `Edit`, `Drop it` or `Ask to drop` |
| Open, in the tray | `Give it a time`, `Drop it` or `Ask to drop` |
| Resolved, today or yesterday | the percent and note, and `Undo` |
| Resolved, older | the percent and note only |
| Drop requested | `Waiting for a parent to decide.` (no drop button) |

`Done` is the main button: one tap records 100 % (no form, nothing left over) and shows the
toast `Done. Nice work.` with an `Undo` button when he may still undo it (today's and
yesterday's cards; parents always). The doing-now card on the timeline and each row of
`Cards that still need a percent` show `Done` next to `How did it go?`.

`Ask to drop` opens a small form: label `Why should it go? (optional)`, button `Ask a parent`.
`Drop it` asks `Drop this card?` with `Drop it` / `Keep it`.

### "How did it go?" dialog

- h2 `How did it go?`, then `Be honest. Half done is still half done.`
- The card summary (category, planned time, title).
- Group `How much did you get done?`: five buttons with `aria-pressed`, named `0%`, `25%`,
  `50%`, `75%`, `100%`, with the small words `Not started`, `A little`, `Half`, `Most`,
  `Done`. Nothing is selected at first and `Save` is disabled until one is.
- Preview line from `previewResolve()`: `About {x} done.` + `{y} left over.`; at 100:
  `All {planned} done. Nice work.` + `Nothing left over.`; at 0: `Nothing done this time.`
- Input `What got in the way? (optional)` (at 100: `Anything to remember? (optional)`).
- Below 100, a fieldset `What happens to the time left?` with radios:
  `Put it in my Catch-up tray` (selected), `Give it a new day and time now` (reveals a
  `PlaceForm`), and `Let it go` for his picks or `Ask a parent to let it go` for must-dos.
- Buttons `Cancel` and `Save`.

### PlaceForm

- Group `Which day?`: buttons for today and the next six days (`Today`, `Tue 22`, ...,
  `aria-pressed`), and `This week's stack` when moving back is allowed. Days marked Rest or
  Away show the mark but can be picked.
- Group `What time?`: `Any time`, or a time from two selects (`Hour`, `Minute` in 5-minute
  steps). It starts on the first free slot from `nextFreeSlot()` (from now for today, from
  the day's start otherwise) and says `{clock} is free`. Overlaps are allowed.
- Button `Save`.

### Close-out dialog

- h2 `Close out today`; group `How was today?` with five buttons `Rough`, `Meh`, `OK`,
  `Good`, `Great` (mood 1 to 5, optional); input `One thing to remember (optional)`;
  button `Close the day`. Afterwards a toast: `Day closed. Campfire: {n} days.`

### Week (`/week`)

- h1 `Week of {Month D}` (the Monday). Icon buttons `aria-label="Previous week"` and `"Next week"`.
- Label `This week's focus`; one chip per active week goal; button `Edit focus` opens a sheet
  `Focus for this week` (rename, mark done, remove, add; at most three active; hint
  `Agreed at the Sunday check-in. It can change every week.`).
- Panel `Is this week too full?`: `Structured time planned: {x} of a {y} weekly guide. Fun,
  rest and outdoors do not count.`, a `role="meter"` bar (`data-testid="load-meter"`), and one of
  `Room to spare. Leave some of it empty.` (under 80%), `A full week. Nothing more needs
  adding.` (80 to 100%), `Over the guide by {z}. What could wait?` (above).
- Region `Any day this week`: hint `Tap a card to give it a day and time.` (not "drag").
- Seven regions named by `formatLongDate(date)`: header `Mon 21` + planned total, `Today`
  on today, chips `Rest day` / `Away` with the note, the day's cards as rows, and an icon
  button `aria-label="Add a card to {weekday}"`.
- Region `Library` (`id="library"`): hint `About 100 ideas from your plan. Add any card to this
  week, or make your own.`; filter buttons `All` + one per category (`aria-pressed`); items
  with title, minutes, description and a button `Add` (`aria-label="Add {title}"`); toast
  `Added to this week's stack`; button `New card` opens a form: `Title`, `Category`,
  `Minutes` (5 to 480, step 5), checkbox `Keep it in my Library`, button `Add card`.

### Month (`/month`)

- h1 `{Month YYYY}`; `aria-label="Previous month"` / `"Next month"`; line
  `{n} days on the board so far. Here is where the time went.`
- Panel `Goals for the month`: a checkbox per goal (done = struck through), button `Add a goal`.
- Five tiles (`data-testid="stat-finished|partial|missed|closed|time"`): `{n}` `cards
  finished`; `{n}` `partly done, carried on`; `{n}` `missed`; `{a} of {b}` `days closed
  out`; `{spent}` `spent of {planned} planned`.
- Panel `Where my time went`: a `CategoryBar` per category with planned time.
- Panel `Day by day`: hint `A check means the day was closed out.`; a Monday-first grid from
  `monthGrid()`; each day of the month shows its number, time spent, a check when closed,
  `Rest day` / `Away`, `Today`, or `Not closed` (a past day with cards and no close-out).
  Days with more time spent get a stronger tint of blue (three steps).
- Panel `Sunday check-in`: hint `You lead it. Four short answers, agreed with Mom and Dad.`;
  the four answers `Keep`, `Change`, `Stop`, `Start` for the latest week that has any, and a
  button `Write this week's check-in` (or `Edit this week's check-in`) opening a form with
  those four fields plus `Notes`, and `Save check-in`.

### Parent sign-in and frame

- Signed out: h1 `Parents`, button `Sign in with Google` (demo mode: `Enter as demo parent`),
  link `Back to the board`.
- Not on the list: `This Google account is not on the parent list.`, the e-mail, button `Sign out`.
- Frame: `<nav aria-label="Parent">` fixed at the bottom with `This week`, `Must-dos`, `Settings`.

### Parent: This week (`/parent`)

- h1 `{name}'s week`; `{Month D} to {D}`; previous/next week buttons as on Week.
- Panel `Needs you`: per drop request `He asked to drop a must-do`, the title, minutes, his
  reason in quotes, buttons `Keep it` and `Let it go`; `{n} cards from earlier days have no
  percent yet.`; due-soon must-dos (`"{title}" is due {weekday} and is not on a day yet.`);
  and the tray line `Catch-up tray: {n} cards, {minutes}. You are alerted at {threshold}
  cards.` (`1 card` for one). At or above the threshold the line is bold, has the alert
  icon and `data-testid="alert-tray"`.
  Nothing to show: `Nothing needs you right now.`
- Tiles: `{pct}%` `of planned time done`; `{a} of {b}` `days closed out`; `{a} of {b}` `must-dos done`.
- Panel `Load check`: `Structured time planned: {x}. Your guide is {y}, so this week ran {z}
  over.` or `... so there is {z} to spare.`
- Panel `Time by category`: hint `solid spent, pale planned`; a `CategoryBar` per category.
- Panel `Check-in`: the week's four answers, or `No check-in notes for this week yet.`

### Parent: Must-dos (`/parent/plan`)

- h1 `Week of {Month D}`; `You set the must-dos. {name} plans everything else.`
- Panel `Focus areas (up to three)` with `Edit` (same sheet as his).
- Panel `Must-dos this week`: one row per group from `groupMustDos()`: title, `{minutes},
  {n} times`, and `{placed} placed, {toPlace} to place` (or `{n} done`). Button
  `Add a must-do` opens: `Title` (with `Pick from the Library`), `Category`, `Minutes`,
  `How many times this week?` (1 to 7), `Due by (optional)`, and `Add`. A row opens a sheet
  with `Remove one` and `Remove all that are still open`.
- Panel `Days off`: seven buttons; each press moves a day through none → `Rest` → `Away` →
  none (`aria-label="{weekday}: no mark|Rest day|Away"`). Hint `On Rest and Away days the
  campfire is safe.`
- Panel `A note he will see`: buttons `Today` / `Tomorrow`, an input, `Save`.

### Parent: Settings (`/parent/settings`)

- h1 `Settings`; `Signed in with Google as {email}`.
- Panel `Linked devices`: label, `His board, unlocked now` / `His board, locked` /
  `Display only, no PIN, cannot change anything`, button `Remove` (confirm `Remove this device?`).
- Panel `Link a new device`: `Open Questboard on the device and type the six-letter code it
  shows.`; input `Code`; radios `His device` / `Display only`; input `Name for this device
  (optional)`; button `Link`. Success toast `Device linked.`
- Panel `{name}'s PIN`: `Set. Changing it locks all his devices.` or `Not set yet.`; button
  `Change` (or `Set a PIN`) → two inputs `New PIN (4 digits)` and `Type it again`, `Save PIN`.
- Panel `Parents`: the allowlist; `Edit` → add or remove an address (not your own).
- Panel `Weekly e-mail and Drive backup`: `Sundays, from your own Google account.`; status
  `Key created` or `No key yet`; button `New key` → the key once in a read-only field
  (`data-testid="token-value"`), `Copy`, and `This replaces the old key. It is shown only once.`
- Panel `Backup and moving`: `One file holds the whole board. Use it to restore, or to move to
  a new home.`; buttons `Download a backup` and `Restore from a backup` (choose a file, then
  type `RESTORE` to confirm; `This replaces everything on the board.`).
- Panel `Family`: `Family name`, `Time zone`, `Day starts`, `Day ends`, `Unlock lasts (hours)`,
  `Alert me when the tray holds (cards)`, `Weekly guide for structured time (hours)`; `Save`.
- Button `Sign out`. Demo mode only: button `Reset the demo`.

## States every screen needs

- **Loading**: the page frame with `Loading...` in place of content (no spinners that jump).
- **Error**: a panel with `errorText(code)` and a `Try again` button that calls `reload()`.
- **Empty**: the sentences given above. An empty state always says what to do next.
- **Busy**: while a change is being saved, the pressed button is disabled.

## Where the mock is wrong (follow this file, not the picture)

- Today: the "now" label overlaps the hour label and crosses a button.
- Week: says "Drag a card onto a day". Dragging is an optional extra (ticket T16); the text
  is `Tap a card to give it a day and time.`
- "How did it go?": the picture has 50% preselected; start with nothing selected.
- Parent Must-dos: the picture's note panel says "tomorrow" only; build the Today/Tomorrow switch.
- Month: the picture's heading says "Last Sunday's check-in"; the panel is `Sunday check-in`.
