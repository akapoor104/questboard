-- Questboard 005: explicit privileges for the Data API.
--
-- Supabase no longer exposes new objects in "public" to the Data API
-- automatically (new projects since mid-2026, every project from 2026-10-30),
-- so each API function is granted by name here. Nothing else is granted: the
-- tables in "qb" stay unreachable, and admin_setup stays closed.
-- Safe to run more than once.

do $$
declare
  v_api constant text[] := array[
    -- session and settings (002)
    'whoami', 'claim_parent', 'device_start_pairing', 'device_approve', 'device_revoke', 'device_list',
    'set_child_pin', 'kid_unlock', 'kid_lock', 'get_settings', 'update_settings', 'update_child',
    'rotate_automation_token',
    -- board (003)
    'get_board', 'add_cards', 'update_card', 'place_card', 'start_card', 'stop_card', 'resolve_card',
    'reopen_card', 'drop_card', 'decide_drop', 'delete_card', 'close_day', 'set_day_mark', 'save_goal',
    'get_library', 'save_library_item', 'archive_library_item', 'save_category',
    -- insights, backup, automation (004)
    'get_today', 'mark_word_used', 'set_parent_note', 'get_stats', 'get_review', 'save_review',
    'export_data', 'import_data', 'automation_export', 'automation_summary', 'automation_schedule'];
  f record;
  v_missing text;
begin
  select string_agg(x, ', ') into v_missing
    from unnest(v_api) x
   where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = x);
  if v_missing is not null then
    raise exception 'Questboard: run migrations 001 to 004 first. Missing functions: %', v_missing;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    return;                                  -- plain PostgreSQL without the Supabase roles
  end if;
  execute 'grant usage on schema public to anon, authenticated, service_role';
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (v_api) loop
    execute format('grant execute on function %s to anon, authenticated, service_role', f.sig);
  end loop;
  execute 'revoke execute on function public.admin_setup(text, text, text[], text) from public, anon, authenticated';
end $$;

-- Tell the Data API (PostgREST) to notice the new functions right away.
notify pgrst, 'reload schema';

-- A quick self-check you can read in the SQL editor: every row should say true.
select 'api functions granted' as check, count(*) = 42 as ok
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
   and p.proname not in ('admin_setup') and p.proname not like 'test\_%'
union all
select 'admin_setup closed', not has_function_privilege('authenticated', 'public.admin_setup(text, text, text[], text)', 'execute')
union all
select 'tables private', not exists (
  select 1 from pg_class c
   where c.relnamespace = 'qb'::regnamespace and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')));
