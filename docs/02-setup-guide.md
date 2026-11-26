# Setup guide for parents

Everything here is done once. Parts 1 and 2 need no accounts and can be done on day one.
Parts 3 to 6 put the real board online (ticket T13) and take about an hour and a half.
Part 7 adds the weekly e-mail and backup (ticket T14).

Dashboards change their menus now and then. If a name below is not exactly what you see,
look for the closest match; the setting names themselves are stable.

**Placeholders used below.** Replace them with your own values:

| Placeholder | Meaning |
|---|---|
| `YOUR-REF` | Your Supabase project reference, the first part of its address (`https://YOUR-REF.supabase.co`) |
| `YOUR-SITE` | The name you give the site on Cloudflare (`https://YOUR-SITE.pages.dev`) |
| `parent1@gmail.com`, `parent2@gmail.com` | The two Google accounts that may act as parents |

## 1. What you need on the computer

- **Node.js 22.18 or newer** (nodejs.org, the LTS installer). Check with `node --version`.
- **Git** (git-scm.com). Check with `git --version`.
- **Claude Code**, opened in the unzipped `questboard` folder.

## 2. Try the demo (no accounts)

```
npm install
npx playwright install chromium
npm run check
npm run dev
```

`npm run check` should end with `CHECK PASSED`. `npm run dev` prints an address
(http://localhost:5173). Until the screens are built (tickets T02 onward) there is nothing
to see there; after T04 it opens a demo family with the PIN **1234**. Demo data lives only
in that browser.

## 3. Create the database (Supabase, free plan)

1. Go to supabase.com, sign up, and create a **new project**. Pick the region closest to
   home and let it generate a database password (save it in your password manager; the app
   never needs it). If the form shows a box such as "Automatically expose new tables and
   functions", either choice is fine.
2. Open **SQL Editor**. For each of these files, in this order, open the file on your
   computer, copy everything, paste it into a new query, and press **Run**:
   1. `db/migrations/001_schema.sql`
   2. `db/migrations/002_core.sql`
   3. `db/migrations/003_board.sql`
   4. `db/migrations/004_insights.sql`
   5. `db/migrations/005_grants.sql`: the result shows three rows, and every one must say `true`.

   Never run anything from `db/test/`. Those files are for the automated tests only.
3. Still in the SQL Editor, run this with your own values (the time zone is a name such as
   `America/Los_Angeles`; the e-mail addresses are the Google accounts of the two parents):

   ```sql
   select public.admin_setup(
     'Our family',
     'America/Los_Angeles',
     array['parent1@gmail.com', 'parent2@gmail.com'],
     'Anush');
   ```
4. Run `db/seed.sql` the same way. It loads the categories, about 100 library ideas, the
   words and encouragements, and the winter-break starter plan. It is safe to run twice.
5. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins** (this is
   how his devices are remembered). Leave "Allow new users to sign up" on. You can turn the
   **Email** provider off; Questboard does not use it.
6. **Project Settings → API Keys** (or the **Connect** button): copy the **Project URL** and
   the **publishable key** (it starts with `sb_publishable_`). Both are safe to put in a web
   page. Do **not** copy the secret key anywhere.

## 4. Let the two parents sign in with Google

1. Go to console.cloud.google.com with a parent's Google account. Create a project named
   "Questboard".
2. Open **Google Auth Platform** (older name: "APIs & Services → OAuth consent screen").
   Choose **External**, give the app the name "Questboard", and enter your e-mail where asked.
3. Under **Audience**, keep the status **Testing** and add both parents as **Test users**.
   Nobody else can then even start the Google sign-in.
4. Under **Clients**, create a client of type **Web application**:
   - Authorized JavaScript origins: `http://localhost:5173` and `https://YOUR-SITE.pages.dev`
   - Authorized redirect URI: `https://YOUR-REF.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**. In Supabase, **Authentication → Sign In /
   Providers → Google**: turn it on and paste both.
6. In Supabase, **Authentication → URL Configuration**: set **Site URL** to
   `https://YOUR-SITE.pages.dev` and add two **Redirect URLs**: `http://localhost:5173/**`
   and `https://YOUR-SITE.pages.dev/**`.

## 5. Connect the app and set up the family

1. In the `questboard` folder, copy `.env.example` to `.env.local` and fill in the two values
   from part 3, step 6. This file stays on your computer (Git ignores it).
2. Run `npm run dev` and open http://localhost:5173/parent. Choose **Sign in with Google**.
   You should land on "Anush's week". (A Google account that is not on your list is refused.)
3. **Settings → Anush's PIN → Set a PIN.** Four digits that he chooses and you know.
4. On the same computer, open http://localhost:5173. It shows **Link this device** and a
   six-character code. In the parent Settings, **Link a new device**: type the code, choose
   **His device**, name it, and press **Link**. The first page turns into the PIN pad.
5. Enter the PIN. You should see Today with the starter plan in this week's stack (from
   December 14) or an empty week before that.

## 6. Put it online (Cloudflare Pages, free plan)

1. Run `npm run build`. It creates the folder `dist`.
2. Go to dash.cloudflare.com, sign up, then **Workers & Pages → Create → Pages → Upload
   assets** (direct upload). Name the project `YOUR-SITE`, upload the `dist` folder, and deploy.
3. Open `https://YOUR-SITE.pages.dev/parent` on your phone and sign in. Add it to the home
   screen (browser menu → "Add to Home screen").
4. On each of his devices, open `https://YOUR-SITE.pages.dev`, read the code, and link it
   from your phone (**Settings → Link a new device**). Do the same for the family computer.
5. To publish a newer version later: `npm run build`, then in the Pages project choose
   **Create deployment** and upload `dist` again.

The address is not a secret and does not need to be: without a linked device and the PIN,
or a parent's Google account, the board answers nothing. Search engines are told not to list it.

## 7. Weekly e-mail and Drive backup (Google Apps Script)

1. In Questboard: **Settings → Weekly e-mail and Drive backup → New key**. Copy the key; it
   is shown only once.
2. Go to script.google.com with the parent account that should send the e-mail. **New
   project**, name it "Questboard automation".
3. Delete the sample code, paste all of `automation/apps-script/Code.gs`, and save.
4. **Project Settings → Script properties**, add:

   | Property | Value |
   |---|---|
   | `SUPABASE_URL` | `https://YOUR-REF.supabase.co` |
   | `SUPABASE_KEY` | the publishable key |
   | `QB_TOKEN` | the key from step 1 |
   | `APP_URL` | `https://YOUR-SITE.pages.dev` (optional; adds a link to the e-mail) |
5. Back in the editor, choose the function **`install`** and press **Run**. Google asks for
   permission to send e-mail as you, to create files in your Drive, and to connect to an
   outside service (your Supabase project). Allow it.
6. Choose **`sendTestToMe`** and press **Run**. The week's summary arrives in your inbox
   within a minute.

From then on: the summary goes to both parents on Sunday around 6 PM, a backup file is
saved to the Drive folder "Questboard backups" on Sunday around 7 PM (the newest twelve are
kept), and one small request a day keeps the free database from being paused.

## Everyday jobs

| Job | How |
|---|---|
| Link another device | Open the site on it, then Settings → Link a new device |
| A device was reset or its browser data cleared | It shows a new code; link it again |
| He forgot his PIN | Settings → PIN → Change |
| A device is lost | Settings → Linked devices → Remove |
| Change who the parents are | Settings → Parents → Edit |
| Download a backup now | Settings → Backup and moving → Download a backup |
| Restore, or move to a new Supabase project | Parts 3 to 5 on the new project, then Settings → Restore from a backup; set the PIN and link the devices again |
| The site says the project is paused | Supabase dashboard → the project → Restore. Then check that the Apps Script trigger `keepAwake` is running |
| Replace the automation key | Settings → New key, then update `QB_TOKEN` in the script properties |

## If something does not work

| What you see | Likely cause | Fix |
|---|---|---|
| `005_grants.sql` stops with "run migrations 001 to 004 first" | A file was skipped or failed | Run the missing file, then 005 again |
| "Unknown time zone" from `admin_setup` | The zone must be a full name | Use a name like `America/Los_Angeles` |
| The site shows a "Demo" badge after part 5 | `.env.local` is missing or empty, or the dev server was not restarted | Check the two values, stop and start `npm run dev`. For the online site, rebuild and upload again |
| Device screen: "could not start" or it never shows a code | Anonymous sign-ins are off | Part 3, step 5 |
| Google: "Access blocked" or "not a test user" | That Google account is not a test user | Part 4, step 3 |
| Google: "redirect_uri_mismatch" | The redirect URI in Google does not match your project | Part 4, step 4: it must be exactly `https://YOUR-REF.supabase.co/auth/v1/callback` |
| After Google sign-in you land on the wrong address | Site URL or redirect URLs in Supabase | Part 4, step 6 |
| "This Google account is not on the parent list" | The address is not in the allowlist | Sign in with a listed account, or re-run `admin_setup` with the right addresses |
| "permission denied for function ..." in the browser console | `005_grants.sql` was not run | Run it |
| "Could not find the function public.whoami in the schema cache" | The Data API has not noticed the new functions yet | In the SQL Editor run `notify pgrst, 'reload schema';` and reload the page |
| Apps Script: "The automation key is wrong or was replaced" | `QB_TOKEN` is old | Make a new key and update the property |
| Supabase "Security Advisor" lists the `qb` tables as "RLS enabled, no policy" | That is the design: no policy means nobody gets through | Nothing to do |
