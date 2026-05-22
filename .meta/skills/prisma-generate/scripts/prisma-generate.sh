#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ORCHESTRATOR="$ROOT/orchestrator"

cd "$ORCHESTRATOR"

if npm run prisma:generate; then
  echo "Prisma client regenerated."
  exit 0
fi

cat <<'EOF' >&2
prisma generate failed (often EACCES when node_modules was created by Docker as root).

Fix ownership, then retry:

  sudo chown -R "$(whoami)" orchestrator/node_modules
  make prisma-generate

migrate deploy only updates the database — TypeScript types come from prisma generate.
EOF
exit 1
