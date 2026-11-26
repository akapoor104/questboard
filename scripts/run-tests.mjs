// Runs the automated tests with Node's built-in test runner (no extra packages).
//   node scripts/run-tests.mjs          unit + contract tests against the in-memory backend
//   node scripts/run-tests.mjs --pg     the same contract tests against memory AND PostgreSQL, plus the parity fuzz
// The --pg run needs a local PostgreSQL prepared by scripts/pg-test-db.sh (see docs/06-testing.md).
import { spawnSync } from 'node:child_process';

const pg = process.argv.includes('--pg');
const files = ['tests/unit/*.test.ts', 'tests/contract/*.test.ts', ...(pg ? ['tests/parity/*.test.ts'] : [])];
const env = { ...process.env, QB_BACKEND: pg ? 'both' : 'memory' };
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env });
process.exit(r.status ?? 1);
