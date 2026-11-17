#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
project_dir=$(pwd)
pg_bin=${POSTGRES_BIN:-/opt/homebrew/opt/postgresql@17/bin}
pg_data="$project_dir/.local/postgres"
if [ "${1:-start}" = stop ]; then
  exec "$pg_bin/pg_ctl" -D "$pg_data" stop -m fast
fi
if "$pg_bin/pg_ctl" -D "$pg_data" status >/dev/null 2>&1; then
  echo "PostgreSQL lokal sudah berjalan pada port 54329."
  exit 0
fi
if [ ! -f "$pg_data/PG_VERSION" ]; then
  "$pg_bin/initdb" -D "$pg_data" -U daurah_local --pwfile="$project_dir/.local/postgres-password" --auth=scram-sha-256 --encoding=UTF8 --locale=en_US.UTF-8
fi
exec "$pg_bin/pg_ctl" -D "$pg_data" -l "$project_dir/.local/postgres.log" -o "-h 127.0.0.1 -p 54329 -k '$project_dir/.local'" start
