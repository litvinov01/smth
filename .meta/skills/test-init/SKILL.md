---
name: test-init
description: >-
  Prepares the local test environment for the swap orchestrator: env files,
  npm dependencies, Prisma client, Docker test images (test-app, test-runner),
  and the swap-net network. Use before running unit or e2e tests, when
  Testcontainers fails due to missing images, or when setting up CI locally.
---

# Test Init

## Purpose

One-shot setup so unit and e2e tests can run on the host with Testcontainers.

## Instructions

1. Ensure Docker is running.

2. Execute from repository root:

```bash
```bash
.meta/skills/test-init/scripts/test-init.sh
```
```

Or:

```bash
make test-init
```

3. The script will:
   - Create `.env` and `orchestrator/.env` from examples (if missing)
   - Run `npm install` and `prisma generate` in `orchestrator/`
   - Build `swap-orchestrator:test-app` and `swap-orchestrator:test-runner` images
   - Create Docker network `swap-net` if absent

4. Run tests:

```bash
make test-unit    # application + adapter unit tests
make test-e2e     # Testcontainers e2e (requires test-app image)
```

## Troubleshooting

| Issue | Action |
|-------|--------|
| `EACCES` on `npm install` / `prisma generate` | Run [prisma-generate](../prisma-generate/SKILL.md) skill after fixing `node_modules` ownership |
| E2e cannot find `swap-orchestrator:test-app` | Re-run this skill |
| Docker not running | Start Docker Desktop / daemon |

## References

- [testing.md](../../.meta/testing.md) — full testing guide
- [Makefile](../../Makefile) — `test-unit`, `test-e2e`, `test-e2e-docker`
