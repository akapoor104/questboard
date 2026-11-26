-- Questboard 004: daily content, stats, reviews, backup, automation, admin.

-- ---------------------------------------------------------------------------
-- Streak: consecutive days with a close-out. Away/rest days are skipped,
-- so they neither add to the streak nor break it.
-- ---------------------------------------------------------------------------

create or replace function qb.streak(p_child_id uuid, out cur int, out best int)
language plpgsql stable security definer set search_path = qb, pg_temp as $$
declare v_today date := qb.today(); d date; v_first date; v_run int := 0;
begin
  cur := 0; best := 0;
  select min(date) into v_first from qb.closeouts where child_id = p_child_id;
  if v_first is null then return; end if;
  d := v_first;
  while d <= v_today loop
    if exists (select 1 from qb.closeouts where child_id = p_child_id and date = d) then
      v_run := v_run + 1; best := greatest(best, v_run);
    elsif not exists (select 1 from qb.day_marks where child_id = p_child_id and date = d) then
      v_run := 0;
    end if;
    d := d + 1;
  end loop;
  d := v_today;
  if not exists (select 1 from qb.closeouts where child_id = p_child_id and date = d) then d := d - 1; end if;
  while d >= v_first loop
    if exists (select 1 from qb.closeouts where child_id = p_child_id and date = d) then
      cur := cur + 1;
    elsif not exists (select 1 from qb.day_marks where child_id = p_child_id and date = d) then
      exit;
    end if;
    d := d - 1;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Daily content: encouragement, word of the day, alerts
-- ---------------------------------------------------------------------------

-- Deterministic pick: day number since 2026-01-01, modulo the list length.
create or replace function qb.day_index(p_date date, p_count int) returns int
language sql immutable as $$
  select case when p_count <= 0 then 0 else (((p_date - date '2026-01-01') % p_count) + p_count) % p_count end
$$;

create or replace function qb.word_of_day(p_date date) returns qb.words
language sql stable security definer set search_path = qb, pg_temp as $$
  select w.* from qb.words w order by w.id
  offset qb.day_index(p_date, (select count(*)::int from qb.words)) limit 1
$$;

create or replace function public.get_today(p_child_id uuid) returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
declare
  v_role text := qb.access(p_child_id); v_today date := qb.today();
  v_word qb.words; v_enc text; v_alerts jsonb := '[]'::jsonb; v_n int; v_m int; v_cur int; v_best int;
begin
  v_word := qb.word_of_day(v_today);
  select e.text into v_enc from qb.encouragements e order by e.id
   offset qb.day_index(v_today, (select count(*)::int from qb.encouragements)) limit 1;
  select count(*) into v_n from qb.cards where child_id = p_child_id and place = 'day' and status = 'open' and date < v_today;
  if v_n > 0 then v_alerts := v_alerts || jsonb_build_object('type', 'unconfirmed', 'count', v_n); end if;
  select count(*), coalesce(sum(minutes), 0) into v_n, v_m from qb.cards where child_id = p_child_id and place = 'tray' and status = 'open';
  if v_n > 0 then v_alerts := v_alerts || jsonb_build_object('type', 'tray', 'count', v_n, 'minutes', v_m); end if;
  select count(*) into v_n from qb.cards where child_id = p_child_id and status = 'open' and kind = 'must'
     and due_date is not null and due_date <= v_today + 2 and not (place = 'day' and date <= due_date);
  if v_n > 0 then v_alerts := v_alerts || jsonb_build_object('type', 'due_soon', 'count', v_n); end if;
  if v_role = 'parent' then
    select count(*) into v_n from qb.cards where child_id = p_child_id and status = 'open' and drop_requested_at is not null;
    if v_n > 0 then v_alerts := v_alerts || jsonb_build_object('type', 'drop_requests', 'count', v_n); end if;
  end if;
  select s.cur, s.best into v_cur, v_best from qb.streak(p_child_id) s;
  return jsonb_build_object(
    'date', v_today,
    'encouragement', v_enc,
    'parent_note', (select n.text from qb.parent_notes n where n.child_id = p_child_id and n.date = v_today),
    'word', case when v_word.id is null then null else jsonb_build_object(
        'id', v_word.id, 'word', v_word.word, 'part_of_speech', v_word.part_of_speech,
        'definition', v_word.definition, 'example', v_word.example,
        'used', exists (select 1 from qb.word_uses u where u.child_id = p_child_id and u.date = v_today)) end,
    'streak', jsonb_build_object('current', v_cur, 'best', v_best),
    'alerts', v_alerts);
end $$;

create or replace function public.mark_word_used(p_child_id uuid, p_used boolean) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_today date := qb.today(); v_word qb.words;
begin
  perform qb.access(p_child_id, true);
  v_word := qb.word_of_day(v_today);
  if v_word.id is null then perform qb.fail('not_found'); end if;
  if coalesce(p_used, true) then
    insert into qb.word_uses (child_id, date, word_id) values (p_child_id, v_today, v_word.id)
    on conflict (child_id, date) do update set word_id = excluded.word_id;
  else
    delete from qb.word_uses where child_id = p_child_id and date = v_today;
  end if;
  return jsonb_build_object('used', coalesce(p_used, true));
end $$;

create or replace function public.set_parent_note(p_child_id uuid, p_date date, p_text text) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_text text := nullif(left(trim(coalesce(p_text, '')), 500), '');
begin
  if qb.access(p_child_id, true) <> 'parent' then perform qb.fail('not_parent'); end if;
  if p_date is null then perform qb.fail('bad_input'); end if;
  if v_text is null then
    delete from qb.parent_notes where child_id = p_child_id and date = p_date;
  else
    insert into qb.parent_notes (child_id, date, text) values (p_child_id, p_date, v_text)
    on conflict (child_id, date) do update set text = excluded.text;
  end if;
  return jsonb_build_object('date', p_date, 'text', v_text);
end $$;

-- ---------------------------------------------------------------------------
-- Stats: planned and spent minutes by category and by day
--   planned = sum of minutes of day cards in range (dropped excluded)
--   spent   = sum of round(minutes * pct / 100) of resolved cards
--   done = pct 100, partial = 1..99, missed = 0
--   unconfirmed = still open on a past day, open = still open today or later
-- ---------------------------------------------------------------------------

create or replace function qb.stats(p_child_id uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = qb, pg_temp as $$
declare v_today date := qb.today(); v_totals jsonb; v_cur int; v_best int;
begin
  select jsonb_build_object(
      'planned_min', coalesce(sum(c.minutes), 0),
      'spent_min', coalesce(sum(round((c.minutes * c.pct)::numeric / 100)) filter (where c.status = 'resolved'), 0),
      'structured_planned_min', coalesce(sum(c.minutes) filter (where k.kind = 'structured'), 0),
      'structured_spent_min', coalesce(sum(round((c.minutes * c.pct)::numeric / 100)) filter (where c.status = 'resolved' and k.kind = 'structured'), 0),
      'done', count(*) filter (where c.pct = 100),
      'partial', count(*) filter (where c.pct between 1 and 99),
      'missed', count(*) filter (where c.pct = 0),
      'unconfirmed', count(*) filter (where c.status = 'open' and c.date < v_today),
      'open', count(*) filter (where c.status = 'open' and c.date >= v_today),
      'must_planned', count(*) filter (where c.kind = 'must'),
      'must_done', count(*) filter (where c.kind = 'must' and c.pct = 100))
    into v_totals
    from qb.cards c join qb.categories k on k.id = c.category_id
   where c.child_id = p_child_id and c.place = 'day' and c.date between p_from and p_to and c.status <> 'dropped';
  select s.cur, s.best into v_cur, v_best from qb.streak(p_child_id) s;
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'today', v_today,
    'totals', v_totals,
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category_id', x.category_id, 'planned_min', x.planned, 'spent_min', x.spent)
                                order by x.sort, x.category_id collate "C"), '[]'::jsonb)
        from (select c.category_id, k.sort, sum(c.minutes) as planned,
                     coalesce(sum(round((c.minutes * c.pct)::numeric / 100)) filter (where c.status = 'resolved'), 0) as spent
                from qb.cards c join qb.categories k on k.id = c.category_id
               where c.child_id = p_child_id and c.place = 'day' and c.date between p_from and p_to and c.status <> 'dropped'
               group by c.category_id, k.sort) x),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', d.day,
               'planned_min', coalesce(a.planned, 0), 'spent_min', coalesce(a.spent, 0),
               'done', coalesce(a.done, 0), 'partial', coalesce(a.partial, 0), 'missed', coalesce(a.missed, 0),
               'unconfirmed', coalesce(a.unconfirmed, 0), 'open', coalesce(a.still_open, 0),
               'closed', exists (select 1 from qb.closeouts x where x.child_id = p_child_id and x.date = d.day),
               'mark', (select m.kind from qb.day_marks m where m.child_id = p_child_id and m.date = d.day))
             order by d.day), '[]'::jsonb)
        from (select g::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g) d
        left join (select c.date, sum(c.minutes) as planned,
                          coalesce(sum(round((c.minutes * c.pct)::numeric / 100)) filter (where c.status = 'resolved'), 0) as spent,
                          count(*) filter (where c.pct = 100) as done,
                          count(*) filter (where c.pct between 1 and 99) as partial,
                          count(*) filter (where c.pct = 0) as missed,
                          count(*) filter (where c.status = 'open' and c.date < v_today) as unconfirmed,
                          count(*) filter (where c.status = 'open' and c.date >= v_today) as still_open
                     from qb.cards c
                    where c.child_id = p_child_id and c.place = 'day' and c.date between p_from and p_to and c.status <> 'dropped'
                    group by c.date) a on a.date = d.day),
    'tray', (select jsonb_build_object('count', count(*), 'minutes', coalesce(sum(minutes), 0))
               from qb.cards where child_id = p_child_id and place = 'tray' and status = 'open'),
    'streak', jsonb_build_object('current', v_cur, 'best', v_best),
    'structured_weekly_max_min', (select structured_weekly_max_min from qb.app_config));
end $$;

create or replace function public.get_stats(p_child_id uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.access(p_child_id);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then perform qb.fail('bad_input'); end if;
  return qb.stats(p_child_id, p_from, p_to);
end $$;

-- ---------------------------------------------------------------------------
-- Weekly review notes (keep / change / stop / start)
-- ---------------------------------------------------------------------------

create or replace function public.get_review(p_child_id uuid, p_week_start date) returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.access(p_child_id);
  if p_week_start is null then perform qb.fail('bad_input'); end if;
  return (select to_jsonb(r) from qb.reviews r where r.child_id = p_child_id and r.week_start = qb.monday(p_week_start));
end $$;

create or replace function public.save_review(p_child_id uuid, p_week_start date, p_review jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_row qb.reviews;
begin
  perform qb.access(p_child_id, true);
  if p_week_start is null or p_review is null or jsonb_typeof(p_review) <> 'object' then perform qb.fail('bad_input'); end if;
  insert into qb.reviews (child_id, week_start, keep, change, stop, start, notes, updated_at)
  values (p_child_id, qb.monday(p_week_start),
          nullif(left(coalesce(p_review->>'keep', ''), 2000), ''), nullif(left(coalesce(p_review->>'change', ''), 2000), ''),
          nullif(left(coalesce(p_review->>'stop', ''), 2000), ''), nullif(left(coalesce(p_review->>'start', ''), 2000), ''),
          nullif(left(coalesce(p_review->>'notes', ''), 4000), ''), qb.now())
  on conflict (child_id, week_start) do update set
    keep = excluded.keep, change = excluded.change, stop = excluded.stop, start = excluded.start,
    notes = excluded.notes, updated_at = excluded.updated_at
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- ---------------------------------------------------------------------------
-- Backup: one JSON document. The same format is used for seed data, test
-- fixtures and migration to another project. Secrets are never exported.
-- ---------------------------------------------------------------------------

create or replace function qb.export() returns jsonb
language sql stable security definer set search_path = qb, pg_temp as $$
  select jsonb_build_object('version', 1, 'exported_at', qb.now(), 'tables', jsonb_build_object(
    'app_config', (select jsonb_agg(jsonb_build_object('family_name', family_name, 'timezone', timezone,
        'day_start_min', day_start_min, 'day_end_min', day_end_min, 'unlock_minutes', unlock_minutes,
        'catchup_alert_threshold', catchup_alert_threshold, 'structured_weekly_max_min', structured_weekly_max_min)) from qb.app_config),
    'children', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'avatar', avatar, 'theme', theme) order by created_at, id), '[]'::jsonb) from qb.children),
    'categories', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort, t.id collate "C"), '[]'::jsonb) from qb.categories t),
    'library_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id collate "C"), '[]'::jsonb) from qb.library_items t),
    'goals', (select coalesce(jsonb_agg(to_jsonb(t) - 'seq' order by t.seq), '[]'::jsonb) from qb.goals t),
    'cards', (select coalesce(jsonb_agg(to_jsonb(t) - 'seq' order by t.seq), '[]'::jsonb) from qb.cards t),
    'day_marks', (select coalesce(jsonb_agg(to_jsonb(t) order by t.child_id, t.date), '[]'::jsonb) from qb.day_marks t),
    'closeouts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.child_id, t.date), '[]'::jsonb) from qb.closeouts t),
    'words', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from qb.words t),
    'encouragements', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from qb.encouragements t),
    'word_uses', (select coalesce(jsonb_agg(to_jsonb(t) order by t.child_id, t.date), '[]'::jsonb) from qb.word_uses t),
    'parent_notes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.child_id, t.date), '[]'::jsonb) from qb.parent_notes t),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(t) order by t.child_id, t.week_start), '[]'::jsonb) from qb.reviews t)))
$$;

-- Loads a document in the export format.
--   p_replace = true : board data is wiped first (children and devices are kept and matched by id).
--   p_replace = false: rows that already exist are left alone (safe to re-run; used for seed data).
create or replace function qb.load(p_data jsonb, p_replace boolean) returns jsonb
language plpgsql security definer set search_path = qb, pg_temp as $$
declare t jsonb := coalesce(p_data->'tables', '{}'::jsonb); v_cfg jsonb; v_counts jsonb := '{}'::jsonb; n int;
begin
  if p_data is null or (p_data->>'version')::int is distinct from 1 then perform qb.fail('bad_input'); end if;
  if p_replace then
    delete from qb.reviews; delete from qb.parent_notes; delete from qb.word_uses; delete from qb.closeouts;
    delete from qb.day_marks; delete from qb.cards; delete from qb.goals; delete from qb.library_items;
    delete from qb.categories; delete from qb.words; delete from qb.encouragements;
  end if;
  v_cfg := t->'app_config'->0;
  if v_cfg is not null then
    update qb.app_config set
      family_name = coalesce(v_cfg->>'family_name', family_name),
      timezone = coalesce(v_cfg->>'timezone', timezone),
      day_start_min = coalesce((v_cfg->>'day_start_min')::smallint, day_start_min),
      day_end_min = coalesce((v_cfg->>'day_end_min')::smallint, day_end_min),
      unlock_minutes = coalesce((v_cfg->>'unlock_minutes')::int, unlock_minutes),
      catchup_alert_threshold = coalesce((v_cfg->>'catchup_alert_threshold')::int, catchup_alert_threshold),
      structured_weekly_max_min = coalesce((v_cfg->>'structured_weekly_max_min')::int, structured_weekly_max_min),
      updated_at = qb.now();
  end if;
  -- Restore or migration: the children in the file replace any others (their devices go with them).
  if p_replace and jsonb_array_length(coalesce(t->'children', '[]'::jsonb)) > 0 then
    delete from qb.children
     where id not in (select (x->>'id')::uuid from jsonb_array_elements(t->'children') x);
  end if;
  insert into qb.children (id, name, avatar, theme)
    select r.id, r.name, coalesce(r.avatar, 'd20'), coalesce(r.theme, 'forest')
      from jsonb_populate_recordset(null::qb.children, coalesce(t->'children', '[]'::jsonb)) r
  on conflict (id) do update set name = excluded.name, avatar = excluded.avatar, theme = excluded.theme
    where p_replace;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('children', n);

  insert into qb.categories (id, name, color, icon, kind, sort, active)
    select r.id, r.name, r.color, r.icon, coalesce(r.kind, 'structured'), coalesce(r.sort, 0), coalesce(r.active, true)
      from jsonb_populate_recordset(null::qb.categories, coalesce(t->'categories', '[]'::jsonb)) r
  on conflict (id) do nothing;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('categories', n);

  insert into qb.library_items (id, title, category_id, minutes, description, tags, source, plan_ref, active)
    select r.id, r.title, r.category_id, r.minutes, r.description, coalesce(r.tags, '{}'), coalesce(r.source, 'parent'), r.plan_ref, coalesce(r.active, true)
      from jsonb_populate_recordset(null::qb.library_items, coalesce(t->'library_items', '[]'::jsonb)) r
  on conflict (id) do nothing;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('library_items', n);

  insert into qb.words (id, word, part_of_speech, definition, example)
    select r.id, r.word, r.part_of_speech, r.definition, r.example
      from jsonb_populate_recordset(null::qb.words, coalesce(t->'words', '[]'::jsonb)) r
  on conflict (id) do nothing;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('words', n);

  insert into qb.encouragements (id, text)
    select r.id, r.text from jsonb_populate_recordset(null::qb.encouragements, coalesce(t->'encouragements', '[]'::jsonb)) r
  on conflict (id) do nothing;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('encouragements', n);

  insert into qb.goals (id, child_id, scope, period_start, title, category_id, note, status, sort, created_by, created_at)
    select r.id, r.child_id, r.scope, r.period_start, r.title, r.category_id, r.note, coalesce(r.status, 'active'),
           coalesce(r.sort, 0), coalesce(r.created_by, 'parent'), coalesce(r.created_at, qb.now())
      from jsonb_populate_recordset(null::qb.goals, coalesce(t->'goals', '[]'::jsonb)) with ordinality as r
     order by r.ordinality
  on conflict (id) do nothing;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('goals', n);

  insert into qb.cards (id, child_id, title, category_id, minutes, kind, created_by, place, date, start_min, week_start,
                        due_date, status, pct, resolved_at, note, doing_since, drop_requested_at, drop_reason, root_id,
                        library_item_id, goal_id, details, sort, created_at, updated_at)
    select r.id, r.child_id, r.title, r.category_id, r.minutes, r.kind, r.created_by, r.place, r.date, r.start_min, r.week_start,
           r.due_date, coalesce(r.status, 'open'), r.pct, r.resolved_at, r.note, r.doing_since, r.drop_requested_at, r.drop_reason,
           coalesce(r.root_id, r.id), r.library_item_id, r.goal_id, r.details, coalesce(r.sort, 0),
           coalesce(r.created_at, qb.now()), coalesce(r.updated_at, qb.now())
      from jsonb_populate_recordset(null::qb.cards, coalesce(t->'cards', '[]'::jsonb)) with ordinality as r
     order by r.ordinality
  on conflict (id) do nothing;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('cards', n);
  update qb.cards c set carried_from_id = r.carried_from_id
    from jsonb_populate_recordset(null::qb.cards, coalesce(t->'cards', '[]'::jsonb)) r
   where c.id = r.id and r.carried_from_id is not null and c.carried_from_id is null
     and exists (select 1 from qb.cards o where o.id = r.carried_from_id);

  insert into qb.day_marks (child_id, date, kind, note)
    select r.child_id, r.date, r.kind, r.note from jsonb_populate_recordset(null::qb.day_marks, coalesce(t->'day_marks', '[]'::jsonb)) r
  on conflict do nothing;
  insert into qb.closeouts (child_id, date, closed_at, mood, note)
    select r.child_id, r.date, coalesce(r.closed_at, qb.now()), r.mood, r.note from jsonb_populate_recordset(null::qb.closeouts, coalesce(t->'closeouts', '[]'::jsonb)) r
  on conflict do nothing;
  insert into qb.word_uses (child_id, date, word_id)
    select r.child_id, r.date, r.word_id from jsonb_populate_recordset(null::qb.word_uses, coalesce(t->'word_uses', '[]'::jsonb)) r
  on conflict do nothing;
  insert into qb.parent_notes (child_id, date, text)
    select r.child_id, r.date, r.text from jsonb_populate_recordset(null::qb.parent_notes, coalesce(t->'parent_notes', '[]'::jsonb)) r
  on conflict do nothing;
  insert into qb.reviews (child_id, week_start, keep, change, stop, start, notes, updated_at)
    select r.child_id, r.week_start, r.keep, r.change, r.stop, r.start, r.notes, coalesce(r.updated_at, qb.now())
      from jsonb_populate_recordset(null::qb.reviews, coalesce(t->'reviews', '[]'::jsonb)) r
  on conflict do nothing;
  return v_counts;
end $$;

create or replace function public.export_data() returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.require_parent();
  return qb.export();
end $$;

create or replace function public.import_data(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.require_parent();
  begin
    return qb.load(p_data, true);
  exception when check_violation or foreign_key_violation or not_null_violation or unique_violation
              or invalid_text_representation or numeric_value_out_of_range
              or datetime_field_overflow or invalid_datetime_format then
    perform qb.fail('bad_input');
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Automation (weekly e-mail, backup to Drive, calendar bridge). These are
-- called without a signed-in user, so each one checks a secret token.
-- ---------------------------------------------------------------------------

create or replace function qb.check_token(p_token text) returns void
language plpgsql stable security definer set search_path = qb, pg_temp as $$
declare v_hash text;
begin
  select automation_token_hash into v_hash from qb.app_config;
  if v_hash is null or p_token is null or length(p_token) < 32
     or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> v_hash then
    perform qb.fail('bad_token');
  end if;
end $$;

create or replace function public.automation_export(p_token text) returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.check_token(p_token);
  return qb.export();
end $$;

create or replace function public.automation_summary(p_token text, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
declare v_cfg qb.app_config;
begin
  perform qb.check_token(p_token);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then perform qb.fail('bad_input'); end if;
  select * into v_cfg from qb.app_config;
  return jsonb_build_object(
    'family_name', v_cfg.family_name, 'timezone', v_cfg.timezone, 'parent_emails', to_jsonb(v_cfg.parent_emails),
    'catchup_alert_threshold', v_cfg.catchup_alert_threshold,
    'generated_at', qb.now(), 'today', qb.today(), 'from', p_from, 'to', p_to,
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'icon', k.icon) order by k.sort, k.id collate "C"), '[]'::jsonb) from qb.categories k),
    'children', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'child', qb.child_json(ch),
        'stats', qb.stats(ch.id, p_from, p_to),
        'tray', (select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'minutes', c.minutes, 'kind', c.kind, 'category_id', c.category_id) order by c.seq), '[]'::jsonb)
                   from qb.cards c where c.child_id = ch.id and c.place = 'tray' and c.status = 'open'),
        'drop_requests', (select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'reason', c.drop_reason) order by c.seq), '[]'::jsonb)
                   from qb.cards c where c.child_id = ch.id and c.status = 'open' and c.drop_requested_at is not null),
        'must_open', (select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'due_date', c.due_date, 'place', c.place, 'date', c.date) order by c.due_date nulls last, c.seq), '[]'::jsonb)
                   from qb.cards c where c.child_id = ch.id and c.status = 'open' and c.kind = 'must'),
        'goals', (select coalesce(jsonb_agg(jsonb_build_object('title', g.title, 'scope', g.scope, 'status', g.status, 'category_id', g.category_id) order by g.scope, g.sort, g.seq), '[]'::jsonb)
                   from qb.goals g where g.child_id = ch.id and g.status <> 'dropped'
                    and ((g.scope = 'week' and g.period_start between qb.monday(p_from) and p_to)
                      or (g.scope = 'month' and g.period_start between date_trunc('month', p_from::timestamp)::date and p_to))),
        'closeouts', (select coalesce(jsonb_agg(jsonb_build_object('date', x.date, 'mood', x.mood, 'note', x.note) order by x.date), '[]'::jsonb)
                   from qb.closeouts x where x.child_id = ch.id and x.date between p_from and p_to),
        'partial_notes', (select coalesce(jsonb_agg(jsonb_build_object('date', c.date, 'title', c.title, 'pct', c.pct, 'note', c.note) order by c.date, c.seq), '[]'::jsonb)
                   from qb.cards c where c.child_id = ch.id and c.place = 'day' and c.status = 'resolved' and c.pct < 100
                    and c.date between p_from and p_to),
        'review', (select to_jsonb(r) from qb.reviews r where r.child_id = ch.id and r.week_start = qb.monday(p_from))
      ) order by ch.created_at, ch.id), '[]'::jsonb) from qb.children ch));
end $$;

create or replace function public.automation_schedule(p_token text, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.check_token(p_token);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then perform qb.fail('bad_input'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'card_id', c.id, 'child_id', c.child_id, 'child_name', ch.name, 'title', c.title,
             'category_id', c.category_id, 'category_name', k.name, 'icon', k.icon, 'kind', c.kind,
             'date', c.date, 'start_min', c.start_min, 'minutes', c.minutes, 'status', c.status, 'pct', c.pct)
           order by c.date, c.start_min, c.seq), '[]'::jsonb)
      from qb.cards c join qb.children ch on ch.id = c.child_id join qb.categories k on k.id = c.category_id
     where c.place = 'day' and c.start_min is not null and c.status <> 'dropped' and c.date between p_from and p_to);
end $$;

-- ---------------------------------------------------------------------------
-- Admin functions: run from the Supabase SQL editor only (never from the app).
-- ---------------------------------------------------------------------------

create or replace function public.admin_setup(
  p_family_name text, p_timezone text, p_parent_emails text[], p_child_name text) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_emails text[];
begin
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown time zone: %. Use a name such as America/Los_Angeles.', p_timezone;
  end if;
  select coalesce(array_agg(distinct lower(trim(e))), '{}') into v_emails from unnest(p_parent_emails) e where trim(e) <> '';
  if cardinality(v_emails) = 0 then raise exception 'Give at least one parent e-mail address.'; end if;
  update qb.app_config set family_name = trim(p_family_name), timezone = p_timezone, parent_emails = v_emails, updated_at = qb.now();
  if not exists (select 1 from qb.children) then
    insert into qb.children (name) values (trim(p_child_name));
  end if;
  return jsonb_build_object('family_name', trim(p_family_name), 'timezone', p_timezone, 'parent_emails', to_jsonb(v_emails),
    'children', (select jsonb_agg(qb.child_json(c)) from qb.children c));
end $$;

-- Starter plan: goals and cards for one child. Skipped if the child already has cards or goals.
--   plan = { "goals": [{scope, period_start, title, category_id?, note?}],
--            "cards": [{title, category_id, minutes, kind, place: 'week'|'day', week_start?, date?,
--                       start_min?, due_date?, details?, library_item_id?, count?}] }
create or replace function qb.load_starter_plan(p_child_id uuid, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = qb, pg_temp as $$
declare v_item jsonb; v_id uuid; v_goals int := 0; v_cards int := 0; i int;
begin
  if p_child_id is null then perform qb.fail('not_found'); end if;
  if exists (select 1 from qb.cards where child_id = p_child_id) or exists (select 1 from qb.goals where child_id = p_child_id) then
    return jsonb_build_object('skipped', true, 'goals', 0, 'cards', 0);
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'goals', '[]'::jsonb)) loop
    insert into qb.goals (child_id, scope, period_start, title, category_id, note, created_by)
    values (p_child_id, v_item->>'scope',
            case when v_item->>'scope' = 'week' then qb.monday((v_item->>'period_start')::date)
                 else date_trunc('month', (v_item->>'period_start')::timestamp)::date end,
            v_item->>'title', v_item->>'category_id', v_item->>'note', 'system');
    v_goals := v_goals + 1;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'cards', '[]'::jsonb)) loop
    for i in 1..coalesce((v_item->>'count')::int, 1) loop
      v_id := gen_random_uuid();
      insert into qb.cards (id, child_id, title, category_id, minutes, kind, created_by, place, date, start_min, week_start,
                            due_date, root_id, library_item_id, details)
      values (v_id, p_child_id, v_item->>'title', v_item->>'category_id', (v_item->>'minutes')::int,
              coalesce(v_item->>'kind', 'choice'), case when coalesce(v_item->>'kind', 'choice') = 'must' then 'parent' else 'system' end,
              v_item->>'place',
              case when v_item->>'place' = 'day' then (v_item->>'date')::date end,
              case when v_item->>'place' = 'day' then (v_item->>'start_min')::smallint end,
              case when v_item->>'place' = 'week' then qb.monday((v_item->>'week_start')::date) end,
              (v_item->>'due_date')::date, v_id, v_item->>'library_item_id', v_item->>'details');
      v_cards := v_cards + 1;
    end loop;
  end loop;
  return jsonb_build_object('skipped', false, 'goals', v_goals, 'cards', v_cards);
end $$;

revoke execute on function public.admin_setup(text, text, text[], text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.admin_setup(text, text, text[], text) from anon, authenticated';
  end if;
end $$;
