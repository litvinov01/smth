# Project Skills

Agent skills for this repository. Each folder is self-contained: an AI prompt (`SKILL.md`) and an executable script (`scripts/`).

| Skill | Script | Make target |
|-------|--------|-------------|
| [prisma-generate](./prisma-generate/) | `scripts/prisma-generate.sh` | `make prisma-generate` |
| [test-init](./test-init/) | `scripts/test-init.sh` | `make test-init` |

## Using with Cursor

Link skills into `.cursor/skills/` from the repository root:

```bash
mkdir -p .cursor/skills
for skill in .meta/skills/*/; do
  name="$(basename "$skill")"
  ln -sf "../../.meta/skills/$name" ".cursor/skills/$name"
done
```

Or copy individual skill folders into `.cursor/skills/`.

## Layout

```
.meta/
├── README.md, architecture.md, bootstrap.md, …
└── skills/
    ├── README.md
    ├── prisma-generate/
    │   ├── SKILL.md
    │   └── scripts/prisma-generate.sh
    └── test-init/
        ├── SKILL.md
        └── scripts/test-init.sh
```

Human-readable docs live alongside skills under `.meta/`; scripts are the canonical automation entry points referenced by the Makefile.
