# Blocked

Empty is good. When a ticket cannot be finished, add an entry here, leave the ticket
unticked in STATUS.md, commit, and stop. A person (or a stronger model) answers under
"Answer", and the next session carries on.

Template:

```
## T07, 2026-11-20
What I was doing: (one sentence)
What happens: (the exact error or the wrong behaviour, copied)
What I tried: (up to three things)
What I think is needed: (the smallest decision or change, and in which file)
Sealed file involved? (no / yes: which, and why the screen cannot adapt)
Answer:
```

## T13, 2026-11-26
What I was doing: Setup guide part 7 (weekly e-mail key) on the real Supabase project, with a parent.
What happens: Settings → Weekly e-mail and Drive backup → New key shows "Something went wrong. Try again."
The request `POST /rest/v1/rpc/rotate_automation_token` returns 400 with
`{"code":"21000","details":null,"hint":null,"message":"UPDATE requires a WHERE clause"}`.
Supabase turns on the `safeupdate` extension for the role the Data API connects as
(`authenticator`), and it refuses every `UPDATE` or `DELETE` that has no `WHERE`, also inside
`security definer` functions. The contract tests ran on plain PostgreSQL, which does not have it.
(The Apps Script error "The automation key is wrong or was replaced" was a result of this:
`select bool_or(automation_token_hash is not null) from qb.app_config` is `false`; the keys
pasted earlier were made in demo mode.)
Statements the API calls that Supabase will refuse (found by scanning db/migrations):
- `002_core.sql:427` `rotate_automation_token`: `update qb.app_config set automation_token_hash = ...` (seen failing)
- `002_core.sql:381` `update_settings`: `update qb.app_config set ...` (family settings, parent list)
- `004_insights.sql:253-255` `qb.load` (Restore from a backup): 11 `delete from qb.<table>;`
- `004_insights.sql:259` `qb.load`: `update qb.app_config set ...`
- (`004_insights.sql:454` `admin_setup` has one too, but it runs in the SQL Editor as `postgres`, where it works.)
What I tried: confirmed QB_TOKEN format and SUPABASE_URL in Apps Script (64 hex, right project);
confirmed the app is connected to the real project (no Demo chip, request goes to supabase.co);
read the error body from the browser's Network tab. No change is possible in the screens.
What I think is needed (one of):
1. Add a `where` to each statement above in the sealed migrations (`app_config` has one row,
   `id = true`, so `where id` works; for the deletes, `where true`), rerun the contract tests,
   reseal, and have a parent rerun the changed `create or replace function`s in the SQL Editor.
2. A parent decides to turn `safeupdate` off for the Data API role in the SQL Editor (first look:
   `select rolconfig from pg_roles where rolname = 'authenticator';`). This weakens a Supabase
   safety setting; tables have RLS with no policies, so the API cannot reach them directly anyway.
Sealed file involved? yes: db/migrations/002_core.sql and 004_insights.sql. The screen cannot
adapt: the refusal happens inside the server function, before anything returns.
Answer: 2026-11-26, a parent chose option 1. `where id` added to the `app_config` updates in
`update_settings`, `rotate_automation_token`, `qb.load` and `admin_setup`; `where true` added to
the 11 deletes in `qb.load` (no change in behaviour: `app_config` has exactly one row, `id = true`).
The parent copied the files in and ran `--reseal` (only those two hashes changed). `npm run
check:e2e` passes; `npm run test:pg` was not run (no local PostgreSQL). The live project gets the
same four functions from a SQL Editor paste (`create or replace`, which keeps their grants), then
`005_grants.sql` again as a check. Still to confirm on the real project: New key, saving family
settings, and Restore from a backup.
