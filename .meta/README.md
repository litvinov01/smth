# Project Meta

Central reference for infrastructure, onboarding, shared conventions, and agent skills.

## Documentation

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Hexagonal architecture — basic code design rule |
| [infra.md](./infra.md) | Services, ports, environment variables, Docker layout |
| [bootstrap.md](./bootstrap.md) | First-time setup and daily development workflow |
| [testing.md](./testing.md) | Unit / e2e tests, Testcontainers, `make test-init` |

## Agent skills

Executable workflows for AI agents: [skills/](./skills/) — each folder has a `SKILL.md` (prompt) and `scripts/*.sh` (implementation).

| Skill | Make target |
|-------|-------------|
| [prisma-generate](./skills/prisma-generate/) | `make prisma-generate` |
| [test-init](./skills/test-init/) | `make test-init` |

See [skills/README.md](./skills/README.md) for Cursor setup.

## Quick links

- Root [Makefile](../Makefile)
- [docker-compose.yml](../docker-compose.yml)
- [orchestrator/](../orchestrator/)
