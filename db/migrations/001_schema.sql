-- Questboard 001: schema. All tables live in the private schema "qb".
-- Supabase's Data API only exposes "public", so these tables cannot be reached
-- directly from the browser. Every read and write goes through the functions in
-- 002-004, which check who is calling. Do not add tables to "public".

create schema if not exists qb;
revoke all on schema qb from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema qb from anon, authenticated';
  end if;
end $$;

create table qb.app_config (
  id boolean primary key default true check (id),          -- exactly one row
  family_name text not null default 'Our family',
  timezone text not null default 'America/Los_Angeles',
  day_start_min smallint not null default 420 check (day_start_min between 0 and 1380),
  day_end_min smallint not null default 1260 check (day_end_min between 60 and 1440),
  parent_emails text[] not null default '{}',              -- lower-case allowlist
  unlock_minutes int not null default 720 check (unlock_minutes between 5 and 10080),
  catchup_alert_threshold int not null default 5 check (catchup_alert_threshold between 1 and 99),
  structured_weekly_max_min int not null default 540 check (structured_weekly_max_min between 0 and 6000),
  automation_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into qb.app_config (id) values (true);

create table qb.parents (
  user_id uuid primary key,                                -- auth.users.id (Google sign-in)
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table qb.children (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  avatar text not null default 'd20',
  theme text not null default 'forest',
  pin_salt text,
  pin_hash text,
  pin_failed int not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table qb.devices (
  user_id uuid primary key,                                -- auth.users.id (anonymous sign-in)
  label text,
  kind text not null default 'kid' check (kind in ('kid','display')),
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  child_id uuid references qb.children(id) on delete cascade,
  pair_code text unique,
  pair_expires_at timestamptz,
  unlocked_until timestamptz,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table qb.categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,23}$'),
  name text not null,
  color text not null,                                     -- design token name, e.g. 'blue'
  icon text not null,                                      -- icon key (see src/ui/icons)
  kind text not null default 'structured' check (kind in ('structured','free')),
  sort int not null default 0,
  active boolean not null default true
);

create table qb.library_items (
  id text primary key default gen_random_uuid()::text,
  title text not null check (length(title) between 1 and 120),
  category_id text not null references qb.categories(id),
  minutes int not null check (minutes between 5 and 480),
  description text,
  tags text[] not null default '{}',
  source text not null default 'parent' check (source in ('guide','parent','kid')),
  plan_ref text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table qb.goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references qb.children(id) on delete cascade,
  scope text not null check (scope in ('week','month')),
  period_start date not null,                              -- Monday (week) or first of month
  title text not null check (length(title) between 1 and 160),
  category_id text references qb.categories(id),
  note text,
  status text not null default 'active' check (status in ('active','done','dropped')),
  sort int not null default 0,
  created_by text not null default 'parent' check (created_by in ('parent','kid','system')),
  created_at timestamptz not null default now(),
  seq bigint generated always as identity                   -- stable insertion order
);
create index goals_child_period on qb.goals (child_id, period_start);

create table qb.cards (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references qb.children(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  category_id text not null references qb.categories(id),
  minutes int not null check (minutes between 5 and 480),
  kind text not null check (kind in ('must','choice')),
  created_by text not null check (created_by in ('parent','kid','system')),
  place text not null check (place in ('day','week','tray')),
  date date,
  start_min smallint check (start_min between 0 and 1435 and start_min % 5 = 0),
  week_start date,
  due_date date,
  status text not null default 'open' check (status in ('open','resolved','dropped')),
  pct smallint check (pct between 0 and 100),
  resolved_at timestamptz,
  note text,
  doing_since timestamptz,
  drop_requested_at timestamptz,
  drop_reason text,
  root_id uuid not null,
  carried_from_id uuid references qb.cards(id) on delete set null,
  library_item_id text references qb.library_items(id) on delete set null,
  goal_id uuid references qb.goals(id) on delete set null,
  details text,
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seq bigint generated always as identity,                  -- stable insertion order
  constraint cards_place_shape check (
    (place = 'day'  and date is not null and week_start is null) or
    (place = 'week' and week_start is not null and date is null and start_min is null) or
    (place = 'tray' and date is null and week_start is null and start_min is null)
  ),
  constraint cards_resolved_shape check ((status = 'resolved') = (pct is not null))
);
create index cards_child_date on qb.cards (child_id, date);
create index cards_child_week on qb.cards (child_id, week_start);
create index cards_child_place on qb.cards (child_id, place, status);

create table qb.day_marks (
  child_id uuid not null references qb.children(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('away','rest')),
  note text,
  primary key (child_id, date)
);

create table qb.closeouts (
  child_id uuid not null references qb.children(id) on delete cascade,
  date date not null,
  closed_at timestamptz not null default now(),
  mood smallint check (mood between 1 and 5),
  note text,
  primary key (child_id, date)
);

create table qb.words (
  id int primary key,
  word text not null,
  part_of_speech text not null,
  definition text not null,
  example text not null
);

create table qb.encouragements (
  id int primary key,
  text text not null
);

create table qb.word_uses (
  child_id uuid not null references qb.children(id) on delete cascade,
  date date not null,
  word_id int not null references qb.words(id) on delete cascade,
  primary key (child_id, date)
);

create table qb.parent_notes (
  child_id uuid not null references qb.children(id) on delete cascade,
  date date not null,
  text text not null check (length(text) between 1 and 500),
  primary key (child_id, date)
);

create table qb.reviews (
  child_id uuid not null references qb.children(id) on delete cascade,
  week_start date not null,
  keep text, change text, stop text, start text, notes text,
  updated_at timestamptz not null default now(),
  primary key (child_id, week_start)
);

-- Belt and braces: row-level security on, with no policies, and no grants.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'qb' loop
    execute format('alter table qb.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on qb.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
