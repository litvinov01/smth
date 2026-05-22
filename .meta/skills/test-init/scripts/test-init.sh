#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ORCHESTRATOR="$ROOT/orchestrator"
DOCKER_NETWORK="${DOCKER_NETWORK:-swap-net}"
IMAGE_NAME="${IMAGE_NAME:-swap-orchestrator}"

echo "==> Preparing test environment"

if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "    created $ROOT/.env"
fi
if [ ! -f "$ORCHESTRATOR/.env" ]; then
  cp "$ORCHESTRATOR/.example.env" "$ORCHESTRATOR/.env"
  echo "    created $ORCHESTRATOR/.env"
fi

echo "==> Installing orchestrator npm dependencies"
cd "$ORCHESTRATOR"
npm install
npm run prisma:generate

echo "==> Building test Docker images"
docker build -f "$ORCHESTRATOR/Dockerfile" --target test-app \
  -t "${IMAGE_NAME}:test-app" "$ORCHESTRATOR"
docker build -f "$ORCHESTRATOR/Dockerfile" --target test-runner \
  -t "${IMAGE_NAME}:test-runner" "$ORCHESTRATOR"

echo "==> Ensuring Docker network: ${DOCKER_NETWORK}"
if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
  docker network create "$DOCKER_NETWORK"
  echo "    created network ${DOCKER_NETWORK}"
else
  echo "    network ${DOCKER_NETWORK} already exists"
fi

echo
echo "Test environment ready."
echo "  make test-unit       # unit tests (host)"
echo "  make test-e2e        # e2e with Testcontainers"
echo "  make test-e2e-docker # e2e inside test-runner container"
