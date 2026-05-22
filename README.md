# Digital-Fiat Exchange

A platform for exchanging **digital fiat currencies** — tokenized representations of government-issued money (EUR, USD, GBP, and other ISO 4217 fiats) — via smart contracts on a blockchain VM. The orchestrator backend coordinates swaps between any supported digital-fiat pair, not a single currency.

## Quick start

```bash
make bootstrap   # first-time setup (Docker + PostgreSQL + migrations)
curl http://localhost:3000/api
```

See [.meta/bootstrap.md](./.meta/bootstrap.md) for detailed onboarding.

## Project structure

```
.
├── .meta/                  # Project meta: docs, agent skills, conventions
│   ├── architecture.md     # Hexagonal architecture rules
│   ├── bootstrap.md        # Onboarding and troubleshooting
│   ├── infra.md            # Docker, ports, env vars
│   ├── testing.md          # Unit and e2e testing
│   └── skills/             # Agent skills (SKILL.md + scripts per workflow)
├── orchestrator/           # Backend (NestJS + Fastify + PostgreSQL + Prisma)
├── contracts/              # Solidity contracts (on-chain settlement)
├── docker-compose.yml      # Local stack: orchestrator + PostgreSQL
├── Makefile                # Common dev and ops commands
└── README.md
```

## Common commands

| Command | Description |
|---------|-------------|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make logs` | Follow container logs |
| `make migrate` | Apply database migrations |
| `make prisma-generate` | Regenerate Prisma client (fixes IDE types) |
| `make test-init` | Prepare test environment (deps, images, network) |
| `make test` | Run unit tests |
| `make test-e2e` | Run e2e tests with Testcontainers |
| `make clean` | Remove containers and DB volume |

## Documentation

| Topic | Location |
|-------|----------|
| Architecture (hexagonal) | [.meta/architecture.md](./.meta/architecture.md) |
| Infrastructure | [.meta/infra.md](./.meta/infra.md) |
| Bootstrap / local dev | [.meta/bootstrap.md](./.meta/bootstrap.md) |
| Testing | [.meta/testing.md](./.meta/testing.md) |
| Agent skills | [.meta/skills/README.md](./.meta/skills/README.md) |
| Orchestrator app | [orchestrator/README.md](./orchestrator/README.md) |
| On-chain contracts | [contracts/README.md](./contracts/README.md) |

## Scope

- **In scope**: multi-currency digital-fiat exchange, transaction orchestration, ISO 4217 currency codes (e.g. `EUR`, `USD`).
- **Out of scope (for now)**: crypto-native assets, FX rate engines — the orchestrator models transactions; swap logic lives in on-chain contracts and future modules.
