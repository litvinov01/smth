# Swap Orchestrator

Backend orchestrator for the **digital-fiat exchange** platform — coordinating swaps between tokenized fiat currencies (EUR, USD, GBP, and other ISO 4217 codes) via smart contracts on a blockchain VM.

## Description

NestJS application (Fastify adapter) that provides HTTP APIs and persistence for exchange operations. Currency-agnostic at the API layer: transactions store a 3-letter ISO 4217 `currency` code; the platform is not limited to EUR.

Hexagonal layout — see [../.meta/architecture.md](../.meta/architecture.md). Current bounded context: **transaction** (create / read).

## Installation

```bash
npm install
```

## Running the app

```bash
npm run start:dev    # development
npm run start:prod   # production
```

From repo root with Docker: `make bootstrap` / `make up` — see [../.meta/bootstrap.md](../.meta/bootstrap.md).

## Database

PostgreSQL via Prisma. Configure `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/swap_db?schema=public"
```

```bash
npm run prisma:generate
npm run prisma:migrate
```

## API (v1)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/transactions` | Create transaction (`CREATED`) |
| `GET` | `/api/v1/transactions/:id` | Read by md5 id |

Example body:

```json
{
  "currency": "USD",
  "amount": "100.50",
  "user": { "id": "a1b2c3d4e5f6789012345678901234ab" }
}
```

## Source layout

```
src/
├── shared/http/v1/          # @V1() decorator and response interceptor
├── transaction/             # Transaction bounded context (hexagonal)
│   ├── domain/
│   ├── application/
│   └── adapters/
├── prisma/
└── main.ts
prisma/
└── schema.prisma
```

## Docker

```bash
# from repository root
make bootstrap
make up
```

Standalone image: `docker build -t swap-orchestrator .`
