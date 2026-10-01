#!/usr/bin/env bash
# Prints every migration (in order) plus the seed as one SQL script, for pasting into the
# Supabase SQL Editor when the CLI is not linked. Usage: pnpm db:bundle > /tmp/edukemonos.sql
# Each migration runs once: if some were already applied, paste only the newer ones.
set -euo pipefail
cd "$(dirname "$0")"
for f in migrations/*.sql; do
  printf -- '-- ===== %s =====\n' "$f"
  cat "$f"
  printf '\n'
done
printf -- '-- ===== seed.sql =====\n'
cat seed.sql
