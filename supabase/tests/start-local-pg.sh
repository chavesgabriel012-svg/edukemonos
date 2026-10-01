#!/usr/bin/env bash
# Starts a throwaway Postgres cluster for the RLS tests and prints TEST_DATABASE_URL.
# Usage: eval "$(supabase/tests/start-local-pg.sh)"
set -euo pipefail
PORT="${PGPORT_TEST:-54329}"
DIR="${PGDATA_TEST:-/tmp/edukemonos-pg-test}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -x "$BIN/initdb" ] || { echo "initdb not found; set TEST_DATABASE_URL instead" >&2; exit 1; }
run() { if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
if [ ! -f "$DIR/PG_VERSION" ]; then
  mkdir -p "$DIR"; [ "$(id -u)" = "0" ] && chown postgres "$DIR"
  run "$BIN/initdb" -D "$DIR" -U postgres --auth=trust >/dev/null
fi
if ! run "$BIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then
  run "$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DIR/log" -w start >/dev/null
fi
echo "export TEST_DATABASE_URL=postgres://postgres@127.0.0.1:$PORT/postgres"
