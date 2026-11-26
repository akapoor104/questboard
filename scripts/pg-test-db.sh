#!/usr/bin/env bash
# Creates (or recreates) the local test database that `npm run test:pg` uses.
# Needs a PostgreSQL 15+ server you can reach with psql. Never point this at Supabase.
#   QB_PG_ADMIN_URL  connection to the "postgres" database (default: postgresql://postgres@127.0.0.1:5432/postgres)
#   QB_PG_URL        connection the tests use (default: postgresql://postgres@127.0.0.1:5432/qb_test)
set -euo pipefail
cd "$(dirname "$0")/.."
ADMIN="${QB_PG_ADMIN_URL:-postgresql://postgres@127.0.0.1:5432/postgres}"
TEST="${QB_PG_URL:-postgresql://postgres@127.0.0.1:5432/qb_test}"
psql -X -q -v ON_ERROR_STOP=1 "$ADMIN" -c "drop database if exists qb_test" -c "create database qb_test" >/dev/null
for f in db/test/supabase_stubs.sql db/migrations/001_schema.sql db/migrations/002_core.sql \
         db/migrations/003_board.sql db/migrations/004_insights.sql db/migrations/005_grants.sql db/test/test_helpers.sql; do
  psql -X -q -v ON_ERROR_STOP=1 "$TEST" -f "$f" >/dev/null || { echo "FAILED: $f"; exit 1; }
done
echo "Test database ready. Run:  QB_PG_URL=$TEST npm run test:pg"
