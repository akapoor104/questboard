// The one command that says whether the project is healthy.
//
//   node scripts/check.mjs            sealed files, seed, guardrails, typecheck, tests, build
//   node scripts/check.mjs --quick    sealed files, seed and guardrails only (2 seconds)
//   node scripts/check.mjs --e2e      everything above, then the browser tests (Playwright)
//   node scripts/check.mjs --pg       also run the contract tests against PostgreSQL (maintainers)
//   node scripts/check.mjs --reseal   PEOPLE ONLY: accept the current sealed files as the new baseline
//
// It uses nothing but Node itself, so it works before `npm install`. Steps whose
// tools are not installed yet are reported as SKIP, never as PASS.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const flags = new Set(process.argv.slice(2));
const results = [];
const record = (status, name, detail = '') => {
  results.push({ status, name, detail });
  console.log(`${status.padEnd(4)} ${name}${detail ? '  ' + detail : ''}`);
};

const posix = (p) => p.split(sep).join('/');
function walk(dir, out = []) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(posix(rel));
  }
  return out;
}
const read = (rel) => readFileSync(join(root, rel), 'utf8');
// Line endings are normalised so a Windows checkout hashes the same as a Mac one.
const hash = (rel) => createHash('sha256').update(read(rel).replace(/\r\n/g, '\n')).digest('hex');

// ---------------------------------------------------------------------------
// 1. Sealed files: the tested backend and its tests. See CLAUDE.md, "Sealed files".
// ---------------------------------------------------------------------------
const SEALED_DIRS = ['db/migrations', 'db/test', 'src/api/memory', 'tests/contract', 'tests/parity'];
const SEALED_FILES = ['src/api/types.ts', 'src/api/client.ts', 'src/api/memoryBackend.ts', 'src/lib/dates.ts',
  'scripts/run-tests.mjs', 'scripts/check.mjs'];
const sealedNow = () => Object.fromEntries(
  [...SEALED_DIRS.flatMap((d) => walk(d)), ...SEALED_FILES].sort().map((f) => [f, hash(f)]));

if (flags.has('--reseal')) {
  const files = sealedNow();
  writeFileSync(join(root, 'sealed.json'), JSON.stringify({
    note: 'SHA-256 of the sealed files. Written by `node scripts/check.mjs --reseal`. Do not edit by hand.',
    files,
  }, null, 2) + '\n');
  console.log(`sealed.json written: ${Object.keys(files).length} files.`);
  process.exit(0);
}

{
  const want = JSON.parse(read('sealed.json')).files;
  const have = sealedNow();
  const problems = [];
  for (const f of Object.keys(want)) {
    if (!(f in have)) problems.push(`missing: ${f}`);
    else if (have[f] !== want[f]) problems.push(`changed: ${f}`);
  }
  for (const f of Object.keys(have)) if (!(f in want)) problems.push(`unexpected new file in a sealed folder: ${f}`);
  if (problems.length === 0) record('PASS', 'sealed files', `${Object.keys(want).length} files unchanged`);
  else {
    record('FAIL', 'sealed files', 'these must not change (see CLAUDE.md). Undo with `git checkout -- <file>`:');
    for (const p of problems) console.log('       ' + p);
  }
}

// ---------------------------------------------------------------------------
// 2. db/seed.sql must match seed/*.json
// ---------------------------------------------------------------------------
{
  const before = read('db/seed.sql');
  const r = spawnSync(process.execPath, ['scripts/build-seed-sql.mjs'], { cwd: root, encoding: 'utf8' });
  const after = read('db/seed.sql');
  if (r.status !== 0) record('FAIL', 'seed data', (r.stderr || r.stdout).trim().split('\n').pop());
  else if (before.replace(/\r\n/g, '\n') !== after.replace(/\r\n/g, '\n')) {
    record('FAIL', 'seed data', 'db/seed.sql was out of date and has been rebuilt from seed/*.json. Run the check again and commit it.');
  } else record('PASS', 'seed data', 'db/seed.sql matches seed/*.json');
}

// ---------------------------------------------------------------------------
// 3. Guardrails: cheap text rules that keep the app private, safe and on-design.
// ---------------------------------------------------------------------------
{
  const problems = [];
  const files = [...walk('src'), ...walk('public'), 'index.html'].filter((f) => existsSync(join(root, f)));
  const text = (f) => /\.(ts|tsx|css|html|json|svg|txt)$/.test(f) || f.endsWith('_redirects');
  const FORBIDDEN = [
    ['service_role', 'the secret database key must never be in the web app'],
    ['sb_secret_', 'the secret database key must never be in the web app'],
    ['dangerouslySetInnerHTML', 'render text as text; never inject HTML'],
    ['eval(', 'no eval'],
    ['new Function(', 'no dynamic code'],
    ['fonts.googleapis.com', 'no third-party requests: fonts are bundled (see docs/05-design.md)'],
    ['fonts.gstatic.com', 'no third-party requests: fonts are bundled'],
    ['googletagmanager', 'no analytics or tracking'],
    ['google-analytics', 'no analytics or tracking'],
    ['cdn.jsdelivr.net', 'no third-party scripts; install the package instead'],
    ['unpkg.com', 'no third-party scripts; install the package instead'],
    ['cdnjs.cloudflare.com', 'no third-party scripts; install the package instead'],
  ];
  for (const f of files.filter(text)) {
    const lines = read(f).split('\n');
    lines.forEach((line, i) => {
      const at = `${f}:${i + 1}`;
      if (line.includes('qb-allow')) return;                        // a reviewed exception, explained on that line
      for (const [needle, why] of FORBIDDEN) if (line.includes(needle)) problems.push(`${at}  "${needle}": ${why}`);
      if (line.includes('@supabase/supabase-js') && f !== 'src/api/supabaseBackend.ts') {
        problems.push(`${at}  only src/api/supabaseBackend.ts may import Supabase; screens use createApi()`);
      }
      if (/\.rpc\s*[<(]/.test(line) && !f.startsWith('src/api/')) {
        problems.push(`${at}  call the typed API (createApi) instead of rpc() directly`);
      }
      if (/\.(tsx|ts|css)$/.test(f) && f !== 'src/ui/tokens.css' && /#[0-9a-fA-F]{3,8}\b/.test(line)
          && /(color|background|border|fill|stroke|shadow|outline)/i.test(line)) {
        problems.push(`${at}  raw color: use a variable from src/ui/tokens.css`);
      }
      if (/\.(tsx|ts|css|html)$/.test(f) && /\p{Extended_Pictographic}/u.test(line)) {
        problems.push(`${at}  emoji or pictograph: use an icon from src/ui/icons.ts`);
      }
    });
  }
  if (problems.length === 0) record('PASS', 'guardrails', `${files.length} files scanned`);
  else {
    record('FAIL', 'guardrails', `${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.log('       ' + p);
  }
}

// ---------------------------------------------------------------------------
// 4-7. Typecheck, tests, build, browser tests
// ---------------------------------------------------------------------------
function run(name, script, args, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  record(r.status === 0 ? 'PASS' : 'FAIL', name);
}
const tool = (rel) => (existsSync(join(root, rel)) ? rel : null);

if (!flags.has('--quick')) {
  const tsc = tool('node_modules/typescript/bin/tsc');
  if (tsc) run('typecheck', tsc, ['-p', 'tsconfig.json']);
  else record('SKIP', 'typecheck', 'TypeScript is not installed yet (ticket T01: npm install)');

  run('unit and contract tests', 'scripts/run-tests.mjs', flags.has('--pg') ? ['--pg'] : []);

  const vite = tool('node_modules/vite/bin/vite.js');
  if (vite && existsSync(join(root, 'src/main.tsx'))) run('production build', vite, ['build']);
  else record('SKIP', 'production build', 'the app shell does not exist yet (tickets T01 and T02)');

  if (flags.has('--e2e')) {
    const pw = tool('node_modules/@playwright/test/cli.js');
    if (pw && existsSync(join(root, 'e2e'))) run('browser tests', pw, ['test']);
    else record('SKIP', 'browser tests', 'Playwright is not installed yet (ticket T01)');
  }
}

const failed = results.filter((r) => r.status === 'FAIL');
const skipped = results.filter((r) => r.status === 'SKIP');
console.log('');
console.log(failed.length === 0
  ? `CHECK PASSED (${results.length - skipped.length} passed${skipped.length ? `, ${skipped.length} skipped` : ''})`
  : `CHECK FAILED: ${failed.map((r) => r.name).join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
