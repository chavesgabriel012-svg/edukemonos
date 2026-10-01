#!/usr/bin/env bash
# Prepares the end-to-end environment: local Supabase (Docker), demo keys in apps/web/.env.local,
# the official Mathematics PDF in a cache, and the fixture units loaded as drafts.
# Then: pnpm --filter web dev --hostname 127.0.0.1 & ; pnpm test:e2e
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm exec supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,postgres-meta,supavisor >/dev/null
eval "$(pnpm exec supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
cat > apps/web/.env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ENV
export INGEST_CACHE_DIR="${INGEST_CACHE_DIR:-$PWD/scripts/ingest/.cache-e2e}"
mkdir -p "$INGEST_CACHE_DIR/units"
cp e2e/fixtures/extraction-mat-g7.json "$INGEST_CACHE_DIR/units/mep-prog-matematicas-g7.json"
pnpm ingest load --source mep-prog-matematicas --grade 7
