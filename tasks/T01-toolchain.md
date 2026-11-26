# T01 Install and check the toolchain

**Goal.** The project installs, the checks run, and the work is under version control.
No app code is written in this ticket.

**Needs.** Nothing.

**Read first.** `README.md`, `CLAUDE.md`, `package.json`, `scripts/check.mjs` (top comment).

**Files.** `package-lock.json` (created by npm), `tasks/STATUS.md`. Nothing else.

## Steps

1. `node --version` must print v22.18 or newer. If it does not, stop and say so (a person
   installs Node; see `docs/02-setup-guide.md`, part 1).
2. If there is no `.git` folder: `git init`, then `git add -A` and
   `git commit -m "Questboard build package"`.
3. `npm run check:quick`. It must print `CHECK PASSED`. (This works before anything is
   installed. If it fails now, the package was changed after it was made: stop and write it
   in `tasks/BLOCKED.md`.)
4. `npm install`.
   - If npm reports that a version cannot be found or two packages conflict, install that
     one package at its newest version (`npm install <name>@latest`, add `-D` for the ones
     under `devDependencies`) and write what you changed under Notes in `tasks/STATUS.md`.
   - Do not add packages that are not already listed in `package.json`.
5. `npx playwright install chromium`.
6. `npm run check`. Expected: `PASS` for sealed files, seed data, guardrails, typecheck, and
   unit and contract tests; `SKIP` for production build only (there is no app yet).
   - A typecheck error at this point can only come from a newer package version. Fix it only
     if the fix is in `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `e2e/` or
     `src/app/`; never in a sealed file. Otherwise write it in `tasks/BLOCKED.md`.
7. Fill in the "Installed versions" table in `tasks/STATUS.md` (`npm ls --depth=0` shows them).
8. Commit: `T01: Install and check the toolchain` (include `package-lock.json`).

## Done when

- [ ] `npm run check` ends with `CHECK PASSED (5 passed, 1 skipped)`.
- [ ] `git status` is clean and `node_modules` is not committed.
- [ ] The versions table in `tasks/STATUS.md` is filled in.
