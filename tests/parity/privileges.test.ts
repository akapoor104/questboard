// PostgreSQL only: proves the database refuses everything except the API functions.
// Runs with `npm run test:pg` (see docs/06-testing.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const url = process.env.QB_PG_URL ?? 'postgresql://postgres@127.0.0.1:5432/qb_test';
const psql = process.env.QB_PSQL ?? 'psql';

/** Runs SQL as one of the Data API roles and returns psql's exit status and error text. */
function as(role: 'anon' | 'authenticated', sql: string): { ok: boolean; err: string; out: string } {
  const r = spawnSync(psql, ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', url],
    { input: `set role ${role};\n${sql}\n`, encoding: 'utf8' });
  if (r.error) throw r.error;
  return { ok: r.status === 0, err: r.stderr, out: r.stdout };
}

const pgOnly = { skip: (process.env.QB_BACKEND ?? 'memory') === 'memory' ? 'needs PostgreSQL' : false };

test('postgres: API roles cannot read or write any table directly', pgOnly, () => {
  for (const role of ['anon', 'authenticated'] as const) {
    for (const sql of [
      'select * from qb.cards limit 1;',
      'select * from qb.children limit 1;',
      'select pin_hash from qb.children;',
      'select automation_token_hash from qb.app_config;',
      "update qb.app_config set parent_emails = '{evil@example.com}';",
      "insert into qb.parents (user_id, email) values (gen_random_uuid(), 'evil@example.com');",
      'delete from qb.cards;',
    ]) {
      const r = as(role, sql);
      assert.equal(r.ok, false, `${role} was allowed to run: ${sql}`);
      assert.match(r.err, /permission denied/, `${role}: ${sql} -> ${r.err}`);
    }
  }
});

test('postgres: API roles cannot call internal or admin functions', pgOnly, () => {
  for (const role of ['anon', 'authenticated'] as const) {
    for (const sql of [
      "select public.admin_setup('X', 'UTC', array['evil@example.com'], 'Kid');",
      `select qb.load('{"version":1,"tables":{}}'::jsonb, true);`,
      'select qb.export();',
      "select qb.load_starter_plan(gen_random_uuid(), '{}'::jsonb);",
      'select qb.is_parent();',
    ]) {
      const r = as(role, sql);
      assert.equal(r.ok, false, `${role} was allowed to run: ${sql}`);
      assert.match(r.err, /permission denied/, `${role}: ${sql} -> ${r.err}`);
    }
  }
});

test('postgres: every API function is callable, and answers "not signed in" without a session', pgOnly, () => {
  const r = as('anon', "select public.whoami()->>'role';");
  assert.equal(r.ok, true, r.err);
  assert.equal(r.out.trim(), 'none');
  const denied = as('anon', 'select public.export_data();');
  assert.equal(denied.ok, false);
  assert.match(denied.err, /QB:not_signed_in/);
  const count = as('authenticated', `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname not like 'test\\_%' and has_function_privilege('authenticated', p.oid, 'execute');`);
  assert.equal(count.out.trim(), '42');
});

test('postgres: every table has row-level security on and no policies', pgOnly, () => {
  const r = spawnSync(psql, ['-X', '-q', '-At', url], {
    input: `select count(*) filter (where not c.relrowsecurity), count(*),
                   (select count(*) from pg_policies where schemaname = 'qb')
              from pg_class c where c.relnamespace = 'qb'::regnamespace and c.relkind = 'r';`,
    encoding: 'utf8',
  });
  assert.equal(r.stdout.trim(), '0|15|0');
});
