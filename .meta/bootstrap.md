# Bootstrap Guide

Step-by-step instructions to run the swap system locally.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- [Make](https://www.gnu.org/software/make/) (optional but recommended)
- Node.js 20+ (only for host-side development without Docker)

## Option A — Full stack with Make (recommended)

From the repository root:

```bash
make bootstrap
```

This will:

1. Create `.env` and `orchestrator/.env` from examples (if missing)
2. Build the orchestrator image
3. Start PostgreSQL and wait until it is ready
4. Apply Prisma migrations
5. Start the orchestrator

Verify:

```bash
curl http://localhost:3000/api
```

## Option B — Manual Docker Compose

```bash
cp .env.example .env
cp orchestrator/.example.env orchestrator/.env

docker compose build
docker compose up -d db

# wait for postgres, then migrate
docker compose run --rm orchestrator npx prisma migrate deploy

docker compose up -d orchestrator
```

## Option C — Hybrid (DB in Docker, app on host)

Useful for fast iteration with `npm run start:dev`:

```bash
cp orchestrator/.example.env orchestrator/.env
docker compose up -d db

cd orchestrator
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

The API listens on `http://localhost:3000/api`.

## Daily workflow

```bash
make up       # start services
make logs     # watch logs
make down     # stop services
make restart  # restart after code changes (rebuild with make rebuild)
```

After changing the Prisma schema:

```bash
cd orchestrator
npm run prisma:migrate        # host development
# or
make migrate                  # containerized deployment
```

## Reset local database

```bash
make clean    # removes containers and postgres_data volume
make bootstrap
```

## Troubleshooting

### Port already in use

Change `ORCHESTRATOR_PORT` or `POSTGRES_PORT` in `.env`, then run `make up`.

### Permission errors in `node_modules`

If `node_modules` was created by Docker as root, remove it and reinstall on the host:

```bash
sudo rm -rf orchestrator/node_modules
cd orchestrator && npm install
```

To allow passwordless `sudo npm` / `sudo npx` when fixing root-owned `node_modules`, add a local sudoers drop-in manually or create a skill under `.meta/skills/` — see [skills/README.md](./skills/README.md).

### Migration failures

Ensure PostgreSQL is running and reachable:

```bash
make ps
make db-shell
```

Re-apply migrations:

```bash
make migrate
```

### Build errors (NestJS types)

All `@nestjs/*` packages must share the same major version (v11). Run `npm install` in `orchestrator/` after pulling dependency changes.

### Prisma lint errors (`Property 'user' does not exist on PrismaService`)

`prisma migrate` updates the **database**; the IDE and TypeScript use the **generated client** in `node_modules/.prisma/client`, which comes from `prisma generate`.

After changing `schema.prisma` or pulling migrations:

```bash
cd orchestrator && npm run prisma:generate
# or from repo root:
make prisma-generate
```

If `npm run prisma:generate` fails with `EACCES` (root-owned `node_modules` from Docker):

```bash
sudo rm -rf orchestrator/node_modules/.prisma
cd orchestrator && npm run prisma:generate
```

`npm install` also runs `prisma generate` automatically via `postinstall`.

## Next steps

- Read [infra.md](./infra.md) for ports, env vars, and service details
- Read [testing.md](./testing.md) for unit and e2e test setup
- See [orchestrator/README.md](../orchestrator/README.md) for application-specific commands
