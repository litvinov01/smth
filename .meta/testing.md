# Testing

How to run unit and e2e/integration tests for the orchestrator.

## Overview

| Layer | Location | Runner | Infrastructure |
|-------|----------|--------|----------------|
| Unit | `orchestrator/src/**/*.spec.ts` | Jest on host | None (mocked) |
| Application layer | `src/**/application/*.spec.ts` | Jest | Repository ports mocked |
| Inbound adapters | `src/**/adapters/inbound/**/*.spec.ts` | Jest | Services / formatters mocked |
| Outbound adapters | `src/**/adapters/outbound/**/*.spec.ts` | Jest | Prisma / gateways mocked |
| E2e / integration | `orchestrator/test/**/*.e2e-spec.ts` | Jest + [Testcontainers](https://node.testcontainers.org/) | Ephemeral Postgres + `test-app` container |

## First-time setup

Run once (or after dependency / Dockerfile changes):

```bash
make test-init
```

The init script (`.meta/skills/test-init/scripts/test-init.sh`) will:

1. Create `.env` and `orchestrator/.env` from examples if missing
2. Run `npm install` and `prisma generate` in `orchestrator/`
3. Build Docker images `swap-orchestrator:test-app` and `swap-orchestrator:test-runner`
4. Create the project Docker network `swap-net` (if it does not exist)

## Running tests

```bash
make test-init      # prepare environment (safe to re-run)
make test-unit      # unit tests only
make test-e2e       # e2e on host via Testcontainers
make test-e2e-docker # e2e inside test-runner container (Docker socket required)
make test           # unit tests (default test target)
```

From `orchestrator/` directly:

```bash
npm test                  # unit
npm run test:e2e          # e2e
npm run test:cov          # unit with coverage
```

## Docker images for tests

Multi-stage `orchestrator/Dockerfile` exposes three targets:

| Target | Tag | Role in tests |
|--------|-----|---------------|
| `test-app` | `swap-orchestrator:test-app` | Application under test — started by Testcontainers |
| `test-runner` | `swap-orchestrator:test-runner` | Full dev toolchain; runs `npm run test:e2e` |
| `production` | `swap-orchestrator:production` | Not used in automated tests; deploy / compose |

E2e tests build or reuse the `test-app` image and start it alongside a `PostgreSqlContainer` on an isolated Testcontainers network.

Example: [`orchestrator/test/app.e2e-spec.ts`](../orchestrator/test/app.e2e-spec.ts)

## Project Docker network

Compose declares a named bridge network so all stack services share DNS and future integration tests can attach to the same network.

| Setting | Default | Description |
|---------|---------|-------------|
| `DOCKER_NETWORK` | `swap-net` | Network name in `.env` / compose |

```yaml
# docker-compose.yml (excerpt)
networks:
  swap-net:
    name: ${DOCKER_NETWORK:-swap-net}
    driver: bridge
```

Both `db` and `orchestrator` join `swap-net`. Service hostnames (`db`, `orchestrator`) resolve inside the network.

`make test-init` creates `swap-net` before tests run so the network exists even when the compose stack is stopped. Testcontainers e2e tests use their own ephemeral network by default; the project network is available when you need containers to reach the compose stack (e.g. integration tests against `make up`).

## Requirements

- Docker running (Testcontainers controls containers via the Docker socket)
- Node.js 20+ on the host for `make test-unit` / `make test-e2e`
- Sufficient disk for Testcontainers image pulls (`postgres:16-alpine`, built `test-app`)

## CI notes

Typical pipeline:

```bash
make test-init
make test-unit
make test-e2e
```

For `test-e2e-docker`, mount the host socket:

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock swap-orchestrator:test-runner
```

## Troubleshooting

### Testcontainers cannot connect to Docker

Ensure Docker Desktop (or the daemon) is running. On Linux CI, the job needs access to `/var/run/docker.sock`.

### `test-app` build fails

Run `make build-test-app` and fix Nest/Prisma compile errors. Production build excludes `orchestrator/test/` via `tsconfig.build.json`.

### Port conflicts during e2e

Testcontainers maps random host ports; conflicts are rare. Compose port clashes are separate — adjust `POSTGRES_PORT` / `ORCHESTRATOR_PORT` in `.env`.

### Slow first e2e run

The first run pulls `postgres:16-alpine` and builds `test-app`. Subsequent runs reuse layers.

## See also

- [infra.md](./infra.md) — Docker image targets and compose layout
- [bootstrap.md](./bootstrap.md) — local dev setup
- [Makefile](../Makefile) — all test-related targets
