#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
fi
sh scripts/local-db.sh
exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort
