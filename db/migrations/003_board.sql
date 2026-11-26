-- Questboard 003: the board. Cards, placement, resolution with carry-over,
-- day close-out, goals and the task library.

create or replace function qb.get_card(p_card_id uuid) returns qb.cards
language plpgsql stable security definer set search_path = qb, pg_temp as $$
declare v_card qb.cards;
begin
  select * into v_card from qb.cards where id = p_card_id;
  if not found then perform qb.fail('not_found'); end if;
  return v_card;
end $$;

-- Minutes left over when pct of a card was done: nearest 5, at least 5.
create or replace function qb.carry_minutes(p_minutes int, p_pct int) returns int
language sql immutable as $$
  select greatest(5, (round((p_minutes * (100 - p_pct))::numeric / 100 / 5) * 5)::int)
$$;

-- ---------------------------------------------------------------------------
-- Reading the board
-- ---------------------------------------------------------------------------

create or replace function public.get_board(p_child_id uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
declare v_today date := qb.today(); v_w_from date;
begin
  perform qb.access(p_child_id);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    perform qb.fail('bad_input');
  end if;
  v_w_from := qb.monday(p_from);
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'today', v_today, 'now', qb.now(),
    'cards', (select coalesce(jsonb_agg(to_jsonb(c) order by c.date, c.start_min nulls last, c.sort, c.seq), '[]'::jsonb)
                from qb.cards c where c.child_id = p_child_id and c.place = 'day'
                 and c.date between p_from and p_to and c.status <> 'dropped'),
    'pool', (select coalesce(jsonb_agg(to_jsonb(c) order by c.week_start, c.sort, c.seq), '[]'::jsonb)
               from qb.cards c where c.child_id = p_child_id and c.place = 'week'
                and c.week_start between v_w_from and p_to and c.status = 'open'),
    'tray', (select coalesce(jsonb_agg(to_jsonb(c) order by c.seq), '[]'::jsonb)
               from qb.cards c where c.child_id = p_child_id and c.place = 'tray' and c.status = 'open'),
    'unconfirmed', (select coalesce(jsonb_agg(to_jsonb(c) order by c.date, c.start_min nulls last, c.sort, c.seq), '[]'::jsonb)
               from qb.cards c where c.child_id = p_child_id and c.place = 'day' and c.status = 'open' and c.date < v_today),
    'drop_requests', (select coalesce(jsonb_agg(to_jsonb(c) order by c.seq), '[]'::jsonb)
               from qb.cards c where c.child_id = p_child_id and c.status = 'open' and c.drop_requested_at is not null),
    'goals', (select coalesce(jsonb_agg(to_jsonb(g) order by g.scope, g.period_start, g.sort, g.seq), '[]'::jsonb)
               from qb.goals g where g.child_id = p_child_id and g.status <> 'dropped'
                and ((g.scope = 'week' and g.period_start between v_w_from and p_to)
                  or (g.scope = 'month' and g.period_start between date_trunc('month', p_from::timestamp)::date and p_to))),
    'day_marks', (select coalesce(jsonb_agg(to_jsonb(m) order by m.date), '[]'::jsonb)
               from qb.day_marks m where m.child_id = p_child_id and m.date between p_from and p_to),
    'closeouts', (select coalesce(jsonb_agg(to_jsonb(x) order by x.date), '[]'::jsonb)
               from qb.closeouts x where x.child_id = p_child_id and x.date between p_from and p_to));
end $$;

-- ---------------------------------------------------------------------------
-- Creating and editing cards
-- ---------------------------------------------------------------------------

create or replace function public.add_cards(p_child_id uuid, p_cards jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare
  v_role text := qb.access(p_child_id, true);
  v_today date := qb.today();
  v_item jsonb; v_out jsonb := '[]'::jsonb; v_card qb.cards; v_id uuid;
  v_place text; v_date date; v_week date; v_start smallint; v_kind text;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array'
     or jsonb_array_length(p_cards) not between 1 and 60 then
    perform qb.fail('bad_input');
  end if;
  for v_item in select * from jsonb_array_elements(p_cards) loop
    begin
      v_place := v_item->>'place';
      if v_place = 'day' then
        v_date := qb.as_date(v_item->>'date'); v_week := null;
        v_start := (v_item->>'start_min')::smallint;
        if v_date is null then perform qb.fail('bad_input'); end if;
      elsif v_place = 'week' then
        v_date := null; v_start := null;
        v_week := qb.monday(coalesce(qb.as_date(v_item->>'week_start'), v_today));
      else
        perform qb.fail('bad_input');
      end if;
      if v_role = 'kid' and (v_date < v_today or v_week < qb.monday(v_today)) then
        perform qb.fail('past_date');
      end if;
      v_kind := case when v_role = 'kid' then 'choice' else coalesce(v_item->>'kind', 'must') end;
      if v_item ? 'goal_id' and v_item->>'goal_id' is not null and not exists
         (select 1 from qb.goals where id = (v_item->>'goal_id')::uuid and child_id = p_child_id) then
        perform qb.fail('bad_input');
      end if;
      v_id := gen_random_uuid();
      insert into qb.cards (id, child_id, title, category_id, minutes, kind, created_by, place, date, start_min,
                            week_start, due_date, root_id, library_item_id, goal_id, details, sort)
      values (v_id, p_child_id, trim(v_item->>'title'), v_item->>'category_id', (v_item->>'minutes')::int,
              v_kind, case when v_role = 'kid' then 'kid' else 'parent' end, v_place, v_date, v_start,
              v_week, qb.as_date(v_item->>'due_date'), v_id, v_item->>'library_item_id',
              (v_item->>'goal_id')::uuid, nullif(left(coalesce(v_item->>'details', ''), 2000), ''),
              coalesce((v_item->>'sort')::double precision, 0))
      returning * into v_card;
    exception when check_violation or foreign_key_violation or not_null_violation
                or invalid_text_representation or numeric_value_out_of_range
                or datetime_field_overflow or invalid_datetime_format then
      perform qb.fail('bad_input');
    end;
    v_out := v_out || to_jsonb(v_card);
  end loop;
  return v_out;
end $$;

create or replace function public.update_card(p_card_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_card qb.cards := qb.get_card(p_card_id); v_role text;
begin
  v_role := qb.access(v_card.child_id, true);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then perform qb.fail('bad_input'); end if;
  if v_card.status <> 'open' then perform qb.fail('not_open'); end if;
  if v_role = 'kid' and (v_card.kind = 'must' or p_patch ? 'kind') then perform qb.fail('not_allowed'); end if;
  if p_patch ? 'goal_id' and p_patch->>'goal_id' is not null and not exists
     (select 1 from qb.goals where id = (p_patch->>'goal_id')::uuid and child_id = v_card.child_id) then
    perform qb.fail('bad_input');
  end if;
  begin
    update qb.cards set
      title = coalesce(trim(p_patch->>'title'), title),
      category_id = coalesce(p_patch->>'category_id', category_id),
      minutes = coalesce((p_patch->>'minutes')::int, minutes),
      kind = coalesce(p_patch->>'kind', kind),
      details = case when p_patch ? 'details' then nullif(left(coalesce(p_patch->>'details', ''), 2000), '') else details end,
      due_date = case when p_patch ? 'due_date' then qb.as_date(p_patch->>'due_date') else due_date end,
      goal_id = case when p_patch ? 'goal_id' then (p_patch->>'goal_id')::uuid else goal_id end,
      updated_at = qb.now()
    where id = p_card_id returning * into v_card;
  exception when check_violation or foreign_key_violation or not_null_violation
              or invalid_text_representation or numeric_value_out_of_range
              or datetime_field_overflow or invalid_datetime_format then
    perform qb.fail('bad_input');
  end;
  return to_jsonb(v_card);
end $$;

create or replace function public.place_card(
  p_card_id uuid, p_place text, p_date date default null, p_start_min int default null,
  p_week_start date default null, p_sort double precision default null) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_card qb.cards := qb.get_card(p_card_id); v_role text; v_today date := qb.today(); v_week date;
begin
  v_role := qb.access(v_card.child_id, true);
  if v_card.status <> 'open' then perform qb.fail('not_open'); end if;
  if p_place = 'day' then
    if p_date is null then perform qb.fail('bad_input'); end if;
    if v_role = 'kid' and p_date < v_today then perform qb.fail('past_date'); end if;
    if p_start_min is not null and (p_start_min not between 0 and 1435 or p_start_min % 5 <> 0) then
      perform qb.fail('bad_input');
    end if;
    update qb.cards set place = 'day', date = p_date, start_min = p_start_min, week_start = null,
           doing_since = case when p_date = v_today then doing_since else null end,
           sort = coalesce(p_sort, sort), updated_at = qb.now()
     where id = p_card_id returning * into v_card;
  elsif p_place = 'week' then
    v_week := qb.monday(coalesce(p_week_start, v_today));
    if v_role = 'kid' and v_week < qb.monday(v_today) then perform qb.fail('past_date'); end if;
    update qb.cards set place = 'week', week_start = v_week, date = null, start_min = null, doing_since = null,
           sort = coalesce(p_sort, sort), updated_at = qb.now()
     where id = p_card_id returning * into v_card;
  else
    perform qb.fail('bad_input');
  end if;
  return to_jsonb(v_card);
end $$;

create or replace function public.start_card(p_card_id uuid) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_card qb.cards := qb.get_card(p_card_id); v_today date := qb.today();
begin
  perform qb.access(v_card.child_id, true);
  if v_card.status <> 'open' then perform qb.fail('not_open'); end if;
  update qb.cards set doing_since = null, updated_at = qb.now()
   where child_id = v_card.child_id and doing_since is not null and id <> p_card_id;
  update qb.cards set place = 'day', date = v_today, week_start = null,
         start_min = case when place = 'day' and date = v_today then start_min else null end,
         doing_since = qb.now(), updated_at = qb.now()
   where id = p_card_id returning * into v_card;
  return to_jsonb(v_card);
end $$;

create or replace function public.stop_card(p_card_id uuid) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_card qb.cards := qb.get_card(p_card_id);
begin
  perform qb.access(v_card.child_id, true);
  update qb.cards set doing_since = null, updated_at = qb.now() where id = p_card_id returning * into v_card;
  return to_jsonb(v_card);
end $$;

-- ---------------------------------------------------------------------------
-- Resolving: percent done, with the remainder carried to the Catch-up tray
-- ---------------------------------------------------------------------------

create or replace function public.resolve_card(
  p_card_id uuid, p_pct int, p_note text default null, p_remainder text default 'tray',
  p_new_date date default null, p_new_start_min int default null) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare
  v_card qb.cards := qb.get_card(p_card_id); v_role text; v_today date := qb.today();
  v_carry qb.cards; v_has_carry boolean := false; v_id uuid;
begin
  v_role := qb.access(v_card.child_id, true);
  if v_card.status <> 'open' then perform qb.fail('not_open'); end if;
  if p_pct is null or p_pct not between 0 and 100 then perform qb.fail('bad_input'); end if;
  if coalesce(p_remainder, 'tray') not in ('tray', 'day', 'let_go') then perform qb.fail('bad_input'); end if;
  if v_card.place = 'day' and v_card.date > v_today then perform qb.fail('future_card'); end if;
  if p_pct < 100 then
    if p_remainder = 'let_go' and v_role = 'kid' and v_card.kind = 'must' then
      perform qb.fail('must_needs_parent');
    end if;
    if p_remainder = 'day' then
      if p_new_date is null or (v_role = 'kid' and p_new_date < v_today)
         or (p_new_start_min is not null and (p_new_start_min not between 0 and 1435 or p_new_start_min % 5 <> 0)) then
        perform qb.fail('bad_input');
      end if;
    end if;
  end if;
  update qb.cards set
    place = 'day', date = case when place = 'day' then date else v_today end, week_start = null,
    start_min = case when place = 'day' then start_min else null end,
    status = 'resolved', pct = p_pct, resolved_at = qb.now(), doing_since = null,
    drop_requested_at = null,
    note = nullif(left(trim(coalesce(p_note, '')), 500), ''), updated_at = qb.now()
  where id = p_card_id returning * into v_card;
  if p_pct < 100 and coalesce(p_remainder, 'tray') <> 'let_go' then
    v_id := gen_random_uuid();
    insert into qb.cards (id, child_id, title, category_id, minutes, kind, created_by, place, date, start_min,
                          due_date, root_id, carried_from_id, library_item_id, goal_id, details)
    values (v_id, v_card.child_id, v_card.title, v_card.category_id, qb.carry_minutes(v_card.minutes, p_pct),
            v_card.kind, v_card.created_by,
            case when p_remainder = 'day' then 'day' else 'tray' end,
            case when p_remainder = 'day' then p_new_date end,
            case when p_remainder = 'day' then p_new_start_min::smallint end,
            v_card.due_date, v_card.root_id, v_card.id, v_card.library_item_id, v_card.goal_id, v_card.details)
    returning * into v_carry;
    v_has_carry := true;
  end if;
  return jsonb_build_object('card', to_jsonb(v_card),
                            'carry', case when v_has_carry then to_jsonb(v_carry) end);
end $$;

create or replace function public.reopen_card(p_card_id uuid) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_card qb.cards := qb.get_card(p_card_id); v_role text; v_carry qb.cards;
begin
  v_role := qb.access(v_card.child_id, true);
  if v_card.status <> 'resolved' then perform qb.fail('not_resolved'); end if;
  if v_role = 'kid' and v_card.date < qb.today() - 1 then perform qb.fail('not_allowed'); end if;
  for v_carry in select * from qb.cards where carried_from_id = p_card_id loop
    if v_carry.status <> 'open' or v_carry.doing_since is not null
       or exists (select 1 from qb.cards where carried_from_id = v_carry.id) then
      perform qb.fail('carry_in_use');
    end if;
  end loop;
  delete from qb.cards where carried_from_id = p_card_id;
  delete from qb.closeouts where child_id = v_card.child_id and date = v_card.date;
  update qb.cards set status = 'open', pct = null, resolved_at = null, note = null, updated_at = qb.now()
   where id = p_card_id returning * into v_card;
  return to_jsonb(v_card);
end $$;

create or replace function public.drop_card(p_card_id uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_card qb.cards := qb.get_card(p_card_id); v_role text; v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  v_role := qb.access(v_card.child_id, true);
  if v_card.status <> 'open' then perform qb.fail('not_open'); end if;
  if v_role = 'kid' and v_card.kind = 'must' then
    update qb.cards set drop_requested_at = qb.now(), drop_reason = v_reason, updated_at = qb.now()
     where id = p_card_id returning * into v_card;
    return jsonb_build_object('requested', true, 'card', to_jsonb(v_card));
  end if;
  update qb.cards set status = 'dropped', doing_since = null, drop_requested_at = null,
         drop_reason = v_reason, updated_at = qb.now()
   where id = p_card_id returning * into v_card;
  return jsonb_build_object('requested', false, 'card', to_jsonb(v_card));
end $$;

create or replace function public.decide_drop(p_card_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_card qb.cards := qb.get_card(p_card_id);
begin
  perform qb.require_parent();
  if v_card.status <> 'open' or v_card.drop_requested_at is null then perform qb.fail('not_found'); end if;
  if coalesce(p_approve, false) then
    update qb.cards set status = 'dropped', doing_since = null, drop_requested_at = null, updated_at = qb.now()
     where id = p_card_id returning * into v_card;
  else
    update qb.cards set drop_requested_at = null, drop_reason = null, updated_at = qb.now()
     where id = p_card_id returning * into v_card;
  end if;
  return to_jsonb(v_card);
end $$;

create or replace function public.delete_card(p_card_id uuid) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.require_parent();
  delete from qb.cards where id = p_card_id;
  if not found then perform qb.fail('not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Day close-out and day marks
-- ---------------------------------------------------------------------------

create or replace function public.close_day(
  p_child_id uuid, p_date date default null, p_mood int default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_date date := coalesce(p_date, qb.today()); v_row qb.closeouts;
begin
  perform qb.access(p_child_id, true);
  if v_date > qb.today() or (p_mood is not null and p_mood not between 1 and 5) then
    perform qb.fail('bad_input');
  end if;
  if exists (select 1 from qb.cards where child_id = p_child_id and place = 'day' and date = v_date and status = 'open') then
    perform qb.fail('open_cards');
  end if;
  insert into qb.closeouts (child_id, date, closed_at, mood, note)
  values (p_child_id, v_date, qb.now(), p_mood::smallint, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict (child_id, date) do update set closed_at = excluded.closed_at, mood = excluded.mood, note = excluded.note
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.set_day_mark(
  p_child_id uuid, p_date date, p_kind text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_row qb.day_marks;
begin
  if qb.access(p_child_id, true) <> 'parent' then perform qb.fail('not_parent'); end if;
  if p_date is null then perform qb.fail('bad_input'); end if;
  if p_kind is null then
    delete from qb.day_marks where child_id = p_child_id and date = p_date;
    return 'null'::jsonb;
  end if;
  if p_kind not in ('away', 'rest') then perform qb.fail('bad_input'); end if;
  insert into qb.day_marks (child_id, date, kind, note)
  values (p_child_id, p_date, p_kind, nullif(left(trim(coalesce(p_note, '')), 200), ''))
  on conflict (child_id, date) do update set kind = excluded.kind, note = excluded.note
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- ---------------------------------------------------------------------------
-- Goals (weekly focus areas and monthly goals)
-- ---------------------------------------------------------------------------

create or replace function public.save_goal(p_child_id uuid, p_goal jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_role text := qb.access(p_child_id, true); v_goal qb.goals; v_scope text; v_start date;
begin
  if p_goal is null or jsonb_typeof(p_goal) <> 'object' then perform qb.fail('bad_input'); end if;
  begin
    if p_goal ? 'id' and p_goal->>'id' is not null then
      select * into v_goal from qb.goals where id = (p_goal->>'id')::uuid and child_id = p_child_id;
      if not found then perform qb.fail('not_found'); end if;
      v_scope := coalesce(p_goal->>'scope', v_goal.scope);
      v_start := coalesce(qb.as_date(p_goal->>'period_start'), v_goal.period_start);
    else
      v_scope := p_goal->>'scope';
      v_start := coalesce(qb.as_date(p_goal->>'period_start'), qb.today());
    end if;
    if v_scope = 'week' then v_start := qb.monday(v_start);
    elsif v_scope = 'month' then v_start := date_trunc('month', v_start::timestamp)::date;
    else perform qb.fail('bad_input');
    end if;
    if v_goal.id is not null then
      update qb.goals set
        scope = v_scope, period_start = v_start,
        title = coalesce(trim(p_goal->>'title'), title),
        category_id = case when p_goal ? 'category_id' then p_goal->>'category_id' else category_id end,
        note = case when p_goal ? 'note' then nullif(left(coalesce(p_goal->>'note', ''), 500), '') else note end,
        status = coalesce(p_goal->>'status', status),
        sort = coalesce((p_goal->>'sort')::int, sort)
      where id = v_goal.id returning * into v_goal;
    else
      insert into qb.goals (child_id, scope, period_start, title, category_id, note, status, sort, created_by)
      values (p_child_id, v_scope, v_start, trim(p_goal->>'title'), p_goal->>'category_id',
              nullif(left(coalesce(p_goal->>'note', ''), 500), ''), coalesce(p_goal->>'status', 'active'),
              coalesce((p_goal->>'sort')::int, 0), case when v_role = 'kid' then 'kid' else 'parent' end)
      returning * into v_goal;
    end if;
  exception when check_violation or foreign_key_violation or not_null_violation
              or invalid_text_representation or numeric_value_out_of_range
              or datetime_field_overflow or invalid_datetime_format then
    perform qb.fail('bad_input');
  end;
  return to_jsonb(v_goal);
end $$;

-- ---------------------------------------------------------------------------
-- Library and categories
-- ---------------------------------------------------------------------------

create or replace function public.get_library() returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
declare v_role text;
begin
  select v.role into v_role from qb.viewer() v;
  if v_role = 'none' then perform qb.fail('not_allowed'); end if;
  return jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort, c.id collate "C"), '[]'::jsonb) from qb.categories c),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by c.sort, c.id collate "C", i.title collate "C", i.id collate "C"), '[]'::jsonb)
                from qb.library_items i join qb.categories c on c.id = i.category_id where i.active));
end $$;

create or replace function public.save_library_item(p_item jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_role text; v_item qb.library_items;
begin
  select v.role into v_role from qb.viewer() v;
  if v_role not in ('parent', 'kid') then perform qb.fail('not_allowed'); end if;
  if p_item is null or jsonb_typeof(p_item) <> 'object' then perform qb.fail('bad_input'); end if;
  begin
    if p_item ? 'id' and p_item->>'id' is not null then
      select * into v_item from qb.library_items where id = p_item->>'id';
      if not found then perform qb.fail('not_found'); end if;
      if v_role = 'kid' and v_item.source <> 'kid' then perform qb.fail('not_allowed'); end if;
      update qb.library_items set
        title = coalesce(trim(p_item->>'title'), title),
        category_id = coalesce(p_item->>'category_id', category_id),
        minutes = coalesce((p_item->>'minutes')::int, minutes),
        description = case when p_item ? 'description' then nullif(left(coalesce(p_item->>'description', ''), 1000), '') else description end,
        tags = case when p_item ? 'tags' then coalesce((select array_agg(x) from jsonb_array_elements_text(p_item->'tags') x), '{}') else tags end
      where id = v_item.id returning * into v_item;
    else
      insert into qb.library_items (title, category_id, minutes, description, tags, source)
      values (trim(p_item->>'title'), p_item->>'category_id', (p_item->>'minutes')::int,
              nullif(left(coalesce(p_item->>'description', ''), 1000), ''),
              coalesce((select array_agg(x) from jsonb_array_elements_text(p_item->'tags') x), '{}'),
              case when v_role = 'kid' then 'kid' else 'parent' end)
      returning * into v_item;
    end if;
  exception when check_violation or foreign_key_violation or not_null_violation
              or invalid_text_representation or numeric_value_out_of_range then
    perform qb.fail('bad_input');
  end;
  return to_jsonb(v_item);
end $$;

create or replace function public.archive_library_item(p_id text) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_role text; v_item qb.library_items;
begin
  select v.role into v_role from qb.viewer() v;
  if v_role not in ('parent', 'kid') then perform qb.fail('not_allowed'); end if;
  select * into v_item from qb.library_items where id = p_id;
  if not found then perform qb.fail('not_found'); end if;
  if v_role = 'kid' and v_item.source <> 'kid' then perform qb.fail('not_allowed'); end if;
  update qb.library_items set active = false where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.save_category(p_cat jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_cat qb.categories;
begin
  perform qb.require_parent();
  if p_cat is null or jsonb_typeof(p_cat) <> 'object' or p_cat->>'id' is null then perform qb.fail('bad_input'); end if;
  begin
    insert into qb.categories (id, name, color, icon, kind, sort, active)
    values (p_cat->>'id', trim(p_cat->>'name'), p_cat->>'color', p_cat->>'icon',
            coalesce(p_cat->>'kind', 'structured'), coalesce((p_cat->>'sort')::int, 0),
            coalesce((p_cat->>'active')::boolean, true))
    on conflict (id) do update set
      name = coalesce(trim(p_cat->>'name'), qb.categories.name),
      color = coalesce(p_cat->>'color', qb.categories.color),
      icon = coalesce(p_cat->>'icon', qb.categories.icon),
      kind = coalesce(p_cat->>'kind', qb.categories.kind),
      sort = coalesce((p_cat->>'sort')::int, qb.categories.sort),
      active = coalesce((p_cat->>'active')::boolean, qb.categories.active)
    returning * into v_cat;
  exception when check_violation or not_null_violation or invalid_text_representation then
    perform qb.fail('bad_input');
  end;
  return to_jsonb(v_cat);
end $$;
