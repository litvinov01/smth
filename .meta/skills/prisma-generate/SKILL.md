---
name: prisma-generate
description: >-
  Regenerates the Prisma TypeScript client from schema.prisma after schema or
  migration changes. Use when IDE or lint reports missing Prisma models
  (e.g. Property 'user' does not exist on PrismaService), after pulling
  schema changes, or when migrate was run but types are stale.
---

# Prisma Generate

## Problem

`prisma migrate` updates the **database** only. TypeScript and the IDE use the **generated client** in `orchestrator/node_modules/.prisma/client`, produced by `prisma generate`.

Symptoms of a stale client:
- `Property 'user' does not exist on type 'PrismaService'`
- `Property 'transaction' does not exist on type 'PrismaService'`
- Generated types still reference removed models (e.g. `BasicEntity`)

## Instructions

1. Run the skill script from the repository root:

```bash
```bash
.meta/skills/prisma-generate/scripts/prisma-generate.sh
```
```

Or via Make:

```bash
make prisma-generate
```

2. If the script fails with `EACCES` (root-owned `node_modules` from Docker):

```bash
sudo chown -R "$(whoami)" orchestrator/node_modules
make prisma-generate
```

3. Confirm the client includes current models:

```bash
grep -E "Model User|Model Transaction" orchestrator/node_modules/.prisma/client/index.d.ts
```

4. Do **not** confuse with `make migrate` — that applies SQL migrations to PostgreSQL, not TypeScript types.

## When to run

- After editing `orchestrator/prisma/schema.prisma`
- After pulling migration changes from git
- When lint/IDE errors mention missing Prisma delegate properties
- After `npm install` (also runs via `postinstall`, if permissions allow)

## References

- [bootstrap.md](../../.meta/bootstrap.md) — Prisma troubleshooting
- [infra.md](../../.meta/infra.md) — database layout
