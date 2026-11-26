-- TEST ONLY. Makes a plain PostgreSQL database look enough like Supabase for
-- the migrations and tests to run: the three API roles and the auth.* helpers.
-- Never run this on a real Supabase project (it already has all of this).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- New Supabase projects do NOT expose new objects in "public" automatically,
-- and this test database is stricter still: nothing is executable unless a
-- migration grants it by name (db/migrations/005_grants.sql).
alter default privileges revoke execute on functions from public;
