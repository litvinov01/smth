# Infrastructure

Local development runs three containers via Docker Compose: the **orchestrator** (Node.js / NestJS), **PostgreSQL**, and **Redpanda** (Kafka-compatible messaging).

## Architecture

```mermaid
flowchart LR
  Client -->|HTTP :3000/api| Orchestrator
  Orchestrator -->|DATABASE_URL| PostgreSQL
  Orchestrator -->|KAFKA_BROKERS| Redpanda
  PostgreSQL[(postgres_data volume)]
  subgraph swap-net["swap-net (bridge)"]
    Orchestrator
    PostgreSQL
    Redpanda
  end
```

## Services

| Service | Image / build | Host port | Purpose |
|---------|---------------|-----------|---------|
| `orchestrator` | Build `orchestrator/Dockerfile` target `production` | `3000` | NestJS API (Fastify), global prefix `/api` |
| `db` | `postgres:16-alpine` | `5432` | PostgreSQL 16 |
| `redpanda` | `redpandadata/redpanda:v24.2.4` | `9092` | Kafka-compatible event bus |

The orchestrator container runs `prisma migrate deploy` on startup, then starts the compiled NestJS app.

## Docker image targets

Multi-stage `orchestrator/Dockerfile` produces three images from shared build layers:

| Target | Tag | Purpose |
|--------|-----|---------|
| `production` | `swap-orchestrator:production` | Deploy / docker compose — minimal runtime |
| `test-app` | `swap-orchestrator:test-app` | Application container for Testcontainers e2e |
| `test-runner` | `swap-orchestrator:test-runner` | Jest e2e suite with full dev toolchain |

Build stages (bottom-up):

```
base → deps → builder ──→ test-runner
         ↓
    production-deps → production → test-app
```

```bash
make build-images     # build all targets
make build-prod       # production only
make build-test-app   # for Testcontainers
make test-e2e         # run e2e on host (starts TC containers)
make test-e2e-docker  # run e2e inside test-runner image
```

E2e tests live in `orchestrator/test/` and spin up PostgreSQL + the `test-app` image via [Testcontainers](https://node.testcontainers.org/). See [testing.md](./testing.md).

## Docker network

All compose services join a named bridge network so containers resolve each other by service name (`db`, `orchestrator`, `redpanda`).

| Setting | Default | Description |
|---------|---------|-------------|
| `DOCKER_NETWORK` | `swap-net` | Network name (set in root `.env`) |

```yaml
networks:
  swap-net:
    name: ${DOCKER_NETWORK:-swap-net}
    driver: bridge
```

`make test-init` and `make network-create` ensure the network exists before tests run, even when the compose stack is stopped.

## Environment variables

### Compose (repo root `.env`)

Copy from [`.env.example`](../.env.example):

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_DB` | `swap_db` | Database name |
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL |
| `ORCHESTRATOR_PORT` | `3000` | Host port for the API |
| `KAFKA_PORT` | `9092` | Host port for Redpanda/Kafka |
| `DOCKER_NETWORK` | `swap-net` | Shared Docker network name |

Inside Compose, the orchestrator receives:

```
DATABASE_URL=postgresql://<user>:<password>@db:5432/<db>?schema=public
KAFKA_BROKERS=redpanda:9092
PROCESS_ROLE=all
```

See `orchestrator/.example.env` for optional messaging tuning (`KAFKA_CLIENT_ID`, check delays, consumer retries, deployment claim TTL).

### Local development (without Docker)

Copy `orchestrator/.example.env` to `orchestrator/.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/swap_db?schema=public"
KAFKA_BROKERS="localhost:9092"
```

Use this when running `npm run start:dev` on the host while only the `db` and `redpanda` services run in Docker.

## Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | Persistent database storage |

Removing volumes (`make clean`) deletes all local database data.

## Health checks

- **db**: `pg_isready` — orchestrator starts only after the database is healthy.
- **redpanda**: `rpk cluster health` — orchestrator starts only after the broker is healthy.

## Useful commands

```bash
make up          # start stack
make down        # stop stack
make logs        # tail logs
make migrate     # run Prisma migrations manually
make db-shell    # psql into PostgreSQL
make test-init   # prepare test environment
make clean       # stop and wipe DB volume
```

## Testing

See [testing.md](./testing.md) for unit/e2e workflows. Quick start:

```bash
make test-init
make test-unit
make test-e2e
```

## API endpoints (current)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api` | Health/hello response |
| `POST` | `/api/v1/transactions` | Create transaction (status `CREATED`) |
| `GET` | `/api/v1/transactions/:id` | Read transaction by UUID |
| `POST` | `/api/v1/transactions/:id/submit` | Submit transaction for on-chain deployment |

## Tech stack

- **Runtime**: Node.js 20 (Alpine)
- **Framework**: NestJS 11 + Fastify 5
- **ORM**: Prisma 5
- **Database**: PostgreSQL 16
- **Messaging**: Redpanda (Kafka protocol)
