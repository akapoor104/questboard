# T12 Polish: small screens, keyboard, dark theme, empty and error states

**Goal.** Every screen is comfortable on his tablet and laptop and on a parent's phone,
works without a mouse, and never leaves a blank or broken page.

**Needs.** T11.

**Read first.** `docs/05-design.md` ("Principles", "Layout", "States every screen needs");
`CLAUDE.md` ("Code conventions": accessibility).

**New package (dev only).** `@axe-core/playwright` (`npm install -D @axe-core/playwright`).

**Files.** Any file under `src/screens/`, `src/components/`, `src/ui/app.css`. Create
`public/manifest.webmanifest`, `public/icon.svg`, `e2e/a11y.spec.ts`,
`e2e/parent.a11y.spec.ts`, `e2e/states.spec.ts`. Change `index.html` (manifest and icon links).

## Steps

1. **Width pass.** Open each of his screens at 1280, 1024, 820 (tablet portrait) and 390px,
   and each parent screen at 390 and 820px. Fix overflow, cramped tap targets (under 44px),
   text that wraps badly, and sheets taller than the screen (they must scroll inside).
2. **Keyboard pass.** On every screen, with Tab, Shift+Tab, Enter, Space and Escape only:
   reach every control in a sensible order, see where focus is, open and close every sheet,
   complete the main task (resolve a card, add from the Library, add a must-do, link a device).
   Add a `Skip to content` link as the first focusable element of both layouts.
3. **Screen-reader names.** Every region has a name, every icon-only button an `aria-label`,
   every input a `<label>`, each page one `<h1>`, headings in order. The page title follows
   the screen: `Today · Questboard`, `Week · Questboard`, `Parents · Questboard`, and so on.
4. **Automated check.** `e2e/a11y.spec.ts` (kid) and `e2e/parent.a11y.spec.ts` (parent): for
   each route, and for the card sheet and the resolve dialog while open, run
   ```ts
   import AxeBuilder from '@axe-core/playwright';
   const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
   expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
   ```
   Fix what it finds in the app. If a finding is a color from `tokens.css`, do not change the
   token: write it in `tasks/STATUS.md` under Notes for a person to decide.
5. **Dark theme.** Week, Month and every sheet in dark. Repeat the automated check with the
   theme set to dark (press `Dark` in the profile first).
6. **States.** Make sure each screen has the loading, error and empty states from the design
   guide. `e2e/states.spec.ts`:
   - **Empty.** `openBoard(page)`, then set the clock eight weeks ahead
     (`page.clock.setFixedTime(new Date('2027-02-15T18:06:00Z'))`), reload and unlock. Today
     shows `Nothing planned yet. Pick a card from your stack.` and `Your stack is empty. Add
     cards from the Library.`; `/week` shows seven day regions and no error; `/month` shows
     `February 2027` and its tiles with zeros.
   - **Error.** Create `src/components/ErrorPanel.tsx` if earlier tickets did not (the
     sentence from `errorText`, and `Try again`). Add a route `/_error` that is registered
     only when `import.meta.env.DEV` is true and renders `ErrorPanel` with
     `new ApiError('network')`. The browser test opens `/_error` and expects
     `No connection. Check the internet and try again.` and the button.
7. **Motion.** Transitions at most 150 ms, none essential; `prefers-reduced-motion` already
   removes them in `tokens.css`. No animation loops.
8. **Home-screen icon.** `public/icon.svg`: the d20 mark (the `d20` icon nodes) in ink on the
   ground color, as plain SVG with the colors written out (this one file may use raw colors:
   put `qb-allow` in a comment on those lines). `public/manifest.webmanifest`: name
   `Questboard`, `display: "standalone"`, `start_url: "/"`, theme and background colors,
   the icon. Link both from `index.html`. No service worker (no offline mode in this version).
9. **Wording pass.** Read every sentence on every screen aloud once. Fix anything that
   scolds, anything in Title Case, any leftover placeholder text, any "T0x" mention.

## Done when

- [ ] `npm run check:e2e` passes, including the two accessibility files in both themes.
- [ ] The whole trial checklist in `docs/06-testing.md` can be done in demo mode on a
      820px-wide touch emulation without getting stuck (skip the lines that need a second device).
- [ ] `npm run build` output: the JavaScript is under 700 kB before compression
      (`ls -l dist/assets`). If it is larger, find out why before adding anything.
- [ ] No console errors or warnings on any screen.

## Not in this ticket

New features. Offline mode. Translations.
