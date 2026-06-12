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
├── agent smith/            # Internal RAG assistant for contributors (LlamaIndex)
├── docker-compose.yml      # Local stack: orchestrator + PostgreSQL + Redpanda
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

## Agent Smith — ask the repo anything

New to the project? [Agent Smith](./agent%20smith/README.md) is an internal RAG assistant that indexes this repository (`.meta` docs, orchestrator source, Prisma schema, contracts) and answers contributor questions like *"how does a transaction reach FUNDED?"* or *"what does `make test-init` do?"*. It needs an `OPENAI_API_KEY` (see its README for setup).

```bash
# host (one-time setup, then chat)
make agent-init
make agent                                    # interactive
make agent q="How does settlement checking work?"   # one-shot

# or fully containerized (key goes in the root .env)
make agent-build
make agent-docker q="What services run in docker compose?"

make agent-reindex   # refresh the index after docs/code change
```

The agent is isolated from the swap stack: it runs on demand only (compose profile `agent`), mounts the repo read-only, and keeps its vector index in a local volume.

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
| Agent Smith (RAG assistant) | [agent smith/README.md](./agent%20smith/README.md) |

## Scope

- **In scope**: multi-currency digital-fiat exchange, transaction orchestration, ISO 4217 currency codes (e.g. `EUR`, `USD`).
- **Out of scope (for now)**: crypto-native assets, FX rate engines — the orchestrator models transactions; swap logic lives in on-chain contracts and future modules.
