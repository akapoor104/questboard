-- Questboard 002: identity helpers and session functions.
-- Convention: API functions live in "public", are SECURITY DEFINER, pin their
-- search_path, and raise errors as 'QB:<code>'. Internal helpers live in "qb".

-- ---------------------------------------------------------------------------
-- Internal helpers (schema qb, not reachable from the Data API)
-- ---------------------------------------------------------------------------

create or replace function qb.now() returns timestamptz
language sql stable as $$ select now() $$;

-- Row timestamps use the same clock as everything else (so tests can freeze time).
alter table qb.children alter column created_at set default qb.now();
alter table qb.devices  alter column created_at set default qb.now();
alter table qb.goals    alter column created_at set default qb.now();
alter table qb.cards    alter column created_at set default qb.now();
alter table qb.cards    alter column updated_at set default qb.now();
alter table qb.parents        alter column created_at set default qb.now();
alter table qb.library_items  alter column created_at set default qb.now();
alter table qb.closeouts      alter column closed_at  set default qb.now();
alter table qb.reviews        alter column updated_at set default qb.now();

create or replace function qb.today() returns date
language sql stable security definer set search_path = qb, pg_temp as $$
  select (qb.now() at time zone (select timezone from qb.app_config))::date
$$;

create or replace function qb.monday(d date) returns date
language sql immutable as $$ select date_trunc('week', d::timestamp)::date $$;

create or replace function qb.fail(code text) returns void
language plpgsql as $$ begin raise exception 'QB:%', code using errcode = 'P0001'; end $$;

-- Strict date parsing for JSON input: only 'YYYY-MM-DD' (PostgreSQL alone would accept 'tomorrow').
create or replace function qb.as_date(p text) returns date
language plpgsql immutable as $$
begin
  if p is null then return null; end if;
  if p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'not a date: %', p using errcode = 'invalid_datetime_format';
  end if;
  return p::date;
end $$;

create or replace function qb.pin_hash(salt text, pin text) returns text
language sql immutable as $$ select encode(sha256(convert_to(salt || ':' || pin, 'UTF8')), 'hex') $$;

create or replace function qb.random_hex() returns text
language sql volatile as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

create or replace function qb.is_parent() returns boolean
language sql stable security definer set search_path = qb, pg_temp as $$
  select auth.uid() is not null and exists (select 1 from qb.parents where user_id = auth.uid())
$$;

create or replace function qb.require_parent() returns void
language plpgsql stable security definer set search_path = qb, pg_temp as $$
begin
  if auth.uid() is null then perform qb.fail('not_signed_in'); end if;
  if not qb.is_parent() then perform qb.fail('not_parent'); end if;
end $$;

-- True when the caller signed in with Google using an allowlisted e-mail.
create or replace function qb.can_claim(c jsonb) returns boolean
language sql stable security definer set search_path = qb, pg_temp as $$
  select coalesce((c->>'is_anonymous')::boolean, false) = false
     and coalesce(c->'app_metadata'->>'provider', '') = 'google'
     and nullif(c->>'email', '') is not null
     and lower(c->>'email') = any (select unnest(parent_emails) from qb.app_config)
$$;

-- Who is calling, without reference to a particular child.
-- role: parent | kid (approved, unlocked kid device) | display | none
create or replace function qb.viewer(out role text, out child_id uuid)
language plpgsql stable security definer set search_path = qb, pg_temp as $$
declare v_dev qb.devices;
begin
  role := 'none'; child_id := null;
  if auth.uid() is null then return; end if;
  if qb.is_parent() then role := 'parent'; return; end if;
  select * into v_dev from qb.devices d where d.user_id = auth.uid() and d.status = 'approved';
  if not found then return; end if;
  child_id := v_dev.child_id;
  if v_dev.kind = 'display' then role := 'display';
  elsif v_dev.unlocked_until is not null and v_dev.unlocked_until > qb.now() then role := 'kid';
  else child_id := null;
  end if;
end $$;

-- Access check for one child. Returns the caller's role or raises.
-- p_write = true refuses read-only display devices.
create or replace function qb.access(p_child_id uuid, p_write boolean default false) returns text
language plpgsql stable security definer set search_path = qb, pg_temp as $$
declare v_dev qb.devices;
begin
  if auth.uid() is null then perform qb.fail('not_signed_in'); end if;
  if p_child_id is null or not exists (select 1 from qb.children where id = p_child_id) then
    perform qb.fail('not_found');
  end if;
  if qb.is_parent() then return 'parent'; end if;
  select * into v_dev from qb.devices d
   where d.user_id = auth.uid() and d.status = 'approved' and d.child_id = p_child_id;
  if not found then perform qb.fail('not_allowed'); end if;
  if v_dev.kind = 'display' then
    if p_write then perform qb.fail('not_allowed'); end if;
    return 'display';
  end if;
  if v_dev.unlocked_until is null or v_dev.unlocked_until <= qb.now() then
    perform qb.fail('locked');
  end if;
  return 'kid';
end $$;

create or replace function qb.child_json(c qb.children, p_with_pin boolean default false) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'avatar', c.avatar, 'theme', c.theme)
      || case when p_with_pin then jsonb_build_object('pin_set', c.pin_hash is not null) else '{}'::jsonb end
$$;

-- ---------------------------------------------------------------------------
-- Session API
-- ---------------------------------------------------------------------------

create or replace function public.whoami() returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_cfg qb.app_config;
  v_dev qb.devices;
  v_role text := 'none';
  v_device jsonb := null;
  v_unlocked boolean := false;
  v_can_claim boolean := false;
  v_children jsonb := '[]'::jsonb;
  v_known boolean := false;                 -- may see family name and children
begin
  select * into v_cfg from qb.app_config;
  if v_uid is not null then
    if qb.is_parent() then
      v_role := 'parent'; v_known := true;
      select coalesce(jsonb_agg(qb.child_json(c, true) order by c.created_at, c.id), '[]'::jsonb)
        into v_children from qb.children c;
    else
      select * into v_dev from qb.devices d where d.user_id = v_uid;
      if found then
        v_unlocked := v_dev.status = 'approved' and v_dev.kind = 'kid'
                      and v_dev.unlocked_until is not null and v_dev.unlocked_until > qb.now();
        if v_dev.status = 'approved' and v_dev.kind = 'display' then v_role := 'display';
        elsif v_unlocked then v_role := 'kid';
        end if;
        v_device := jsonb_build_object(
          'status', v_dev.status, 'kind', v_dev.kind, 'label', v_dev.label,
          'child_id', case when v_dev.status = 'approved' then v_dev.child_id end,
          'unlocked', v_unlocked,
          'pair_code', case when v_dev.status = 'pending' then v_dev.pair_code end,
          'pair_expires_at', case when v_dev.status = 'pending' then v_dev.pair_expires_at end);
        if v_dev.status = 'approved' then
          v_known := true;
          select coalesce(jsonb_agg(qb.child_json(c, true)), '[]'::jsonb)
            into v_children from qb.children c where c.id = v_dev.child_id;
        end if;
      end if;
      v_can_claim := qb.can_claim(v_claims);
    end if;
  end if;
  return jsonb_build_object(
    'role', v_role,
    'email', lower(nullif(v_claims->>'email', '')),
    'device', v_device,
    'can_claim_parent', v_can_claim,
    'family_name', case when v_known then v_cfg.family_name end,
    'timezone', v_cfg.timezone,
    'day_start_min', v_cfg.day_start_min,
    'day_end_min', v_cfg.day_end_min,
    'today', qb.today(),
    'now', qb.now(),
    'children', v_children);
end $$;

create or replace function public.claim_parent() returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_email text := lower(nullif(v_claims->>'email', ''));
begin
  if v_uid is null then perform qb.fail('not_signed_in'); end if;
  if not qb.is_parent() then
    if not qb.can_claim(v_claims) then perform qb.fail('not_allowlisted'); end if;
    delete from qb.parents where email = v_email and user_id <> v_uid;
    insert into qb.parents (user_id, email, display_name)
    values (v_uid, v_email, coalesce(v_claims->'user_metadata'->>'full_name', v_claims->'user_metadata'->>'name'))
    on conflict (user_id) do update set email = excluded.email;
    delete from qb.devices where user_id = v_uid;
  end if;
  return public.whoami();
end $$;

create or replace function public.device_start_pairing(p_label text default null) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_dev qb.devices;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  if v_uid is null then perform qb.fail('not_signed_in'); end if;
  if qb.is_parent() or coalesce((v_claims->>'is_anonymous')::boolean, false) = false then
    perform qb.fail('not_allowed');
  end if;
  delete from qb.devices where status = 'pending' and pair_expires_at < qb.now() - interval '1 day';
  select * into v_dev from qb.devices where user_id = v_uid;
  if found and v_dev.status = 'approved' then
    return jsonb_build_object('status', 'approved', 'pair_code', null, 'pair_expires_at', null);
  end if;
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from qb.devices where pair_code = v_code);
  end loop;
  insert into qb.devices (user_id, label, status, pair_code, pair_expires_at)
  values (v_uid, nullif(left(trim(coalesce(p_label, '')), 40), ''), 'pending', v_code, qb.now() + interval '15 minutes')
  on conflict (user_id) do update
    set status = 'pending', pair_code = excluded.pair_code, pair_expires_at = excluded.pair_expires_at,
        label = coalesce(excluded.label, qb.devices.label), child_id = null, unlocked_until = null, approved_at = null;
  return jsonb_build_object('status', 'pending', 'pair_code', v_code,
                            'pair_expires_at', qb.now() + interval '15 minutes');
end $$;

create or replace function qb.device_json(d qb.devices) returns jsonb
language sql stable as $$
  select jsonb_build_object('user_id', d.user_id, 'label', d.label, 'kind', d.kind, 'status', d.status,
    'child_id', d.child_id, 'approved_at', d.approved_at, 'created_at', d.created_at,
    'unlocked', d.unlocked_until is not null and d.unlocked_until > qb.now())
$$;

create or replace function public.device_approve(
  p_code text, p_child_id uuid, p_kind text default 'kid', p_label text default null) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_dev qb.devices; v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  perform qb.require_parent();
  if p_kind not in ('kid', 'display') then perform qb.fail('bad_input'); end if;
  if not exists (select 1 from qb.children where id = p_child_id) then perform qb.fail('not_found'); end if;
  select * into v_dev from qb.devices
   where pair_code = v_code and status = 'pending' and pair_expires_at > qb.now() for update;
  if not found then perform qb.fail('bad_code'); end if;
  update qb.devices set status = 'approved', child_id = p_child_id, kind = p_kind,
         label = coalesce(nullif(left(trim(coalesce(p_label, '')), 40), ''), label),
         approved_at = qb.now(), pair_code = null, pair_expires_at = null, unlocked_until = null
   where user_id = v_dev.user_id returning * into v_dev;
  return qb.device_json(v_dev);
end $$;

create or replace function public.device_revoke(p_device_id uuid) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_dev qb.devices;
begin
  perform qb.require_parent();
  update qb.devices set status = 'revoked', unlocked_until = null, pair_code = null, pair_expires_at = null
   where user_id = p_device_id returning * into v_dev;
  if not found then perform qb.fail('not_found'); end if;
  return qb.device_json(v_dev);
end $$;

create or replace function public.device_list() returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
begin
  perform qb.require_parent();
  return (select coalesce(jsonb_agg(qb.device_json(d) order by d.created_at, d.user_id), '[]'::jsonb)
            from qb.devices d where d.status = 'approved');
end $$;

create or replace function public.set_child_pin(p_child_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_salt text := qb.random_hex();
begin
  perform qb.require_parent();
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then perform qb.fail('bad_input'); end if;
  update qb.children set pin_salt = v_salt, pin_hash = qb.pin_hash(v_salt, p_pin),
         pin_failed = 0, pin_locked_until = null where id = p_child_id;
  if not found then perform qb.fail('not_found'); end if;
  update qb.devices set unlocked_until = null where child_id = p_child_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.kid_unlock(p_pin text) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); v_dev qb.devices; v_child qb.children; v_cfg qb.app_config;
  v_failed int; v_until timestamptz;
begin
  if v_uid is null then perform qb.fail('not_signed_in'); end if;
  select * into v_dev from qb.devices where user_id = v_uid and status = 'approved' and kind = 'kid';
  if not found then perform qb.fail('not_allowed'); end if;
  select * into v_cfg from qb.app_config;
  select * into v_child from qb.children where id = v_dev.child_id for update;
  if v_child.pin_hash is null then perform qb.fail('pin_not_set'); end if;
  if v_child.pin_locked_until is not null and v_child.pin_locked_until > qb.now() then
    return jsonb_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_child.pin_locked_until);
  end if;
  if p_pin is not null and qb.pin_hash(v_child.pin_salt, p_pin) = v_child.pin_hash then
    v_until := qb.now() + make_interval(mins => v_cfg.unlock_minutes);
    update qb.children set pin_failed = 0, pin_locked_until = null where id = v_child.id;
    update qb.devices set unlocked_until = v_until where user_id = v_uid;
    return jsonb_build_object('ok', true, 'unlocked_until', v_until);
  end if;
  v_failed := v_child.pin_failed + 1;
  if v_failed >= 5 then
    v_until := qb.now() + interval '5 minutes';
    update qb.children set pin_failed = 0, pin_locked_until = v_until where id = v_child.id;
    return jsonb_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_until);
  end if;
  update qb.children set pin_failed = v_failed where id = v_child.id;
  return jsonb_build_object('ok', false, 'attempts_left', 5 - v_failed, 'locked_until', null);
end $$;

create or replace function public.kid_lock() returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
begin
  if auth.uid() is null then perform qb.fail('not_signed_in'); end if;
  update qb.devices set unlocked_until = null where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Settings API
-- ---------------------------------------------------------------------------

create or replace function public.get_settings() returns jsonb
language plpgsql stable security definer set search_path = qb, public, pg_temp as $$
declare v_cfg qb.app_config; v_role text; v_child uuid; v_base jsonb;
begin
  select v.role, v.child_id into v_role, v_child from qb.viewer() v;
  if v_role = 'none' then perform qb.fail('not_allowed'); end if;
  select * into v_cfg from qb.app_config;
  v_base := jsonb_build_object('family_name', v_cfg.family_name, 'timezone', v_cfg.timezone,
    'day_start_min', v_cfg.day_start_min, 'day_end_min', v_cfg.day_end_min);
  if v_role <> 'parent' then
    return v_base || jsonb_build_object('children',
      (select coalesce(jsonb_agg(qb.child_json(c, true)), '[]'::jsonb) from qb.children c where c.id = v_child));
  end if;
  return v_base || jsonb_build_object(
    'parent_emails', to_jsonb(v_cfg.parent_emails),
    'unlock_minutes', v_cfg.unlock_minutes,
    'catchup_alert_threshold', v_cfg.catchup_alert_threshold,
    'structured_weekly_max_min', v_cfg.structured_weekly_max_min,
    'automation_token_set', v_cfg.automation_token_hash is not null,
    'children', (select coalesce(jsonb_agg(qb.child_json(c, true) order by c.created_at, c.id), '[]'::jsonb) from qb.children c),
    'parents', (select coalesce(jsonb_agg(jsonb_build_object('email', p.email, 'display_name', p.display_name) order by p.created_at, p.email), '[]'::jsonb) from qb.parents p));
end $$;

create or replace function public.update_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_emails text[]; v_me text;
begin
  perform qb.require_parent();
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then perform qb.fail('bad_input'); end if;
  if p_patch ? 'timezone' and not exists (select 1 from pg_timezone_names where name = p_patch->>'timezone') then
    perform qb.fail('bad_input');
  end if;
  if p_patch ? 'family_name' and length(trim(coalesce(p_patch->>'family_name', ''))) not between 1 and 60 then
    perform qb.fail('bad_input');
  end if;
  if p_patch ? 'parent_emails' then
    if jsonb_typeof(p_patch->'parent_emails') <> 'array' then perform qb.fail('bad_input'); end if;
    select coalesce(array_agg(distinct lower(trim(x))), '{}') into v_emails
      from jsonb_array_elements_text(p_patch->'parent_emails') x where trim(x) <> '';
    select email into v_me from qb.parents where user_id = auth.uid();
    if not (v_me = any (v_emails)) or exists (select 1 from unnest(v_emails) e where e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
      perform qb.fail('bad_input');           -- you cannot remove yourself; e-mails must look valid
    end if;
  end if;
  begin
    update qb.app_config set
      family_name = coalesce(trim(p_patch->>'family_name'), family_name),
      timezone = coalesce(p_patch->>'timezone', timezone),
      day_start_min = coalesce((p_patch->>'day_start_min')::smallint, day_start_min),
      day_end_min = coalesce((p_patch->>'day_end_min')::smallint, day_end_min),
      unlock_minutes = coalesce((p_patch->>'unlock_minutes')::int, unlock_minutes),
      catchup_alert_threshold = coalesce((p_patch->>'catchup_alert_threshold')::int, catchup_alert_threshold),
      structured_weekly_max_min = coalesce((p_patch->>'structured_weekly_max_min')::int, structured_weekly_max_min),
      parent_emails = coalesce(v_emails, parent_emails),
      updated_at = qb.now();
    if exists (select 1 from qb.app_config where day_start_min >= day_end_min) then
      raise check_violation;
    end if;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
    perform qb.fail('bad_input');
  end;
  if v_emails is not null then
    delete from qb.parents where not (email = any (v_emails));
  end if;
  return public.get_settings();
end $$;

create or replace function public.update_child(p_child_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_role text := qb.access(p_child_id, true); v_child qb.children;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then perform qb.fail('bad_input'); end if;
  if p_patch ? 'name' and v_role <> 'parent' then perform qb.fail('not_allowed'); end if;
  if (p_patch ? 'name' and length(trim(coalesce(p_patch->>'name', ''))) not between 1 and 40)
     or (p_patch ? 'avatar' and length(coalesce(p_patch->>'avatar', '')) not between 1 and 16)
     or (p_patch ? 'theme' and coalesce(p_patch->>'theme', '') !~ '^[a-z]{2,20}$') then
    perform qb.fail('bad_input');
  end if;
  update qb.children set
    name = coalesce(trim(p_patch->>'name'), name),
    avatar = coalesce(p_patch->>'avatar', avatar),
    theme = coalesce(p_patch->>'theme', theme)
  where id = p_child_id returning * into v_child;
  return qb.child_json(v_child, true);
end $$;

create or replace function public.rotate_automation_token() returns jsonb
language plpgsql security definer set search_path = qb, public, pg_temp as $$
declare v_token text := qb.random_hex();
begin
  perform qb.require_parent();
  update qb.app_config set automation_token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), updated_at = qb.now();
  return jsonb_build_object('token', v_token);
end $$;
