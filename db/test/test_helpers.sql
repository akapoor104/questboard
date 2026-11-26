-- TEST ONLY. Run after the migrations on a local test database.
--  * qb.now() becomes settable through the "app.test_now" setting.
--  * test_rpc() calls an API function the way Supabase's Data API does:
--    JSON keys become named arguments, missing keys use the defaults.
--  * test_reset() wipes everything and loads a fixture in the export format.

create or replace function qb.now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('app.test_now', true), '')::timestamptz, now())
$$;

create or replace function public.test_rpc(p_fn text, p_args jsonb) returns jsonb
language plpgsql as $$
declare
  v_proc record; v_cols text := ''; v_call text := ''; v_name text; v_sql text; v_out jsonb; i int;
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
begin
  select p.proargnames, p.proargtypes into v_proc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = p_fn;
  if not found then raise exception 'QB:no_such_function'; end if;
  if exists (select 1 from jsonb_object_keys(v_args) k
              where not (k = any (coalesce(v_proc.proargnames, '{}'::text[])))) then
    raise exception 'QB:unknown_argument';
  end if;
  if v_proc.proargnames is not null then
    for i in 1..array_length(v_proc.proargnames, 1) loop
      v_name := v_proc.proargnames[i];
      if v_args ? v_name then
        v_cols := v_cols || case when v_cols = '' then '' else ', ' end
                  || format('%I %s', v_name, format_type(v_proc.proargtypes[i - 1], null));
        v_call := v_call || case when v_call = '' then '' else ', ' end
                  || format('%I => r.%I', v_name, v_name);
      end if;
    end loop;
  end if;
  if v_cols = '' then
    v_sql := format('select to_jsonb(public.%I())', p_fn);
  else
    v_sql := format('select to_jsonb(public.%I(%s)) from jsonb_to_record($1) as r(%s)', p_fn, v_call, v_cols);
  end if;
  execute v_sql using v_args into v_out;
  return v_out;
end $$;

create or replace function public.test_reset(p_fixture jsonb) returns void
language plpgsql as $$
declare k text; v text;
begin
  truncate qb.reviews, qb.parent_notes, qb.word_uses, qb.closeouts, qb.day_marks, qb.cards, qb.goals,
           qb.library_items, qb.categories, qb.words, qb.encouragements, qb.devices, qb.children,
           qb.parents, qb.app_config restart identity cascade;
  insert into qb.app_config (id) values (true);
  perform qb.load(p_fixture, false);
  update qb.app_config set parent_emails = coalesce(
    (select array_agg(lower(x)) from jsonb_array_elements_text(p_fixture->'test'->'parent_emails') x), '{}');
  for k, v in select * from jsonb_each_text(coalesce(p_fixture->'test'->'pins', '{}'::jsonb)) loop
    update qb.children set pin_salt = 'testsalt', pin_hash = qb.pin_hash('testsalt', v) where id = k::uuid;
  end loop;
end $$;

grant execute on function public.test_rpc(text, jsonb) to anon, authenticated;
