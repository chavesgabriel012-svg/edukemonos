#!/usr/bin/env bash
# Starts the app for the end-to-end tests against the LOCAL Supabase only. The values go on the
# command line because variables already exported in the shell (e.g. production keys) beat .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(pnpm exec supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
case "${API_URL:-}" in
  http://127.0.0.1*|http://localhost*) ;;
  *) echo "Refusing to start: API_URL '${API_URL:-}' is not local. Run e2e/setup.sh first." >&2; exit 1 ;;
esac
exec env NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  OPENAI_API_KEY= ANTHROPIC_API_KEY= pnpm --filter web dev --hostname 127.0.0.1 --port 3000
