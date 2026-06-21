# Agent Smith

Internal RAG assistant for contributors. It indexes this repository (the `.meta` docs, READMEs, orchestrator source, Prisma schema, contracts, compose/Make files) with [LlamaIndex](https://docs.llamaindex.ai/) and answers questions like "how does a transaction reach FUNDED?" or "what does `make test-init` do?".

Under the hood it is an **agent**: the corpus is split into six architectural **areas** (each a separate vector index). A cheap embedding **classifier autodetects** which area(s) your question targets *before* retrieval, the `FunctionCallingAgent` answers grounded in just those areas — telling you *which part of the project* the answer lives in — and can call read-only **code tools** to point at and quote concrete files for a problem.

## Quick start (Make, from the repo root)

```bash
make agent-init                  # venv + deps + .env (then set OPENAI_API_KEY in "agent smith/.env")
make agent                       # interactive session
make agent q="How does the deployment claim mechanism work?"   # one-shot
make agent-reindex               # rebuild the index after the repo changed
```

## Docker

The agent ships with its own `Dockerfile` and is wired into the root `docker-compose.yml` under the `agent` profile, so `make up` / `docker compose up` never starts it implicitly. The repo is bind-mounted read-only at `/repo` and the vector index persists in the `agent_smith_index` volume. Set `OPENAI_API_KEY` in the root `.env` first.

```bash
make agent-build                 # build the image
make agent-docker                # interactive session in a container
make agent-docker q="What services run in docker compose?"   # one-shot

# plain compose equivalents
docker compose build agent-smith
docker compose run --rm agent-smith
docker compose run --rm agent-smith --rebuild "How do e2e tests work?"
```

## Manual setup (without Make)

Requires Python 3.9+ and an OpenAI API key. On Python 3.9 the requirements pin LlamaIndex to 0.12.x (newer releases use 3.10-only syntax at runtime); with 3.10+ you get the current release line.

```bash
cd "agent smith"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .example.env .env   # then fill in OPENAI_API_KEY
```

## Usage

```bash
# one-shot question
python main.py "How does the deployment claim mechanism work?"

# interactive session
python main.py

# re-index after the repo changed
python main.py --rebuild

# hide source fragments under answers
python main.py --no-sources "What services run in docker compose?"

# restrict the answer to a single area
python main.py --area contracts "How does the claim work on-chain?"

# agent diagnostics on stderr (LlamaIndex load, routing, tool calls)
python main.py --logs-enabled
make agent logs=1
```

Per-area vector indexes are built on first run and persisted under `.storage/<area>/` (gitignored), with a small `.storage/areas.json` manifest; subsequent runs reuse them. Run with `--rebuild` whenever docs or code change significantly.

> Upgrading from the single flat index? The storage layout changed to one index per area, so run `make agent-reindex` (or `python main.py --rebuild`) once.

## Architecture

Same hexagonal rules as the rest of the repo (see [.meta/architecture.md](../.meta/architecture.md)): the IO layer and the retrieval engine are both adapters behind ports, so either can be replaced without touching business logic.

```
agent smith/
├── main.py                          # composition root (wires everything)
└── agent_smith/
    ├── config.py                    # env-driven settings + area/topic definitions
    ├── system_log.py                # diagnostics logging (stderr); quiet by default
    ├── domain/
    │   ├── models.py                # Answer, SourceChunk, Area, CodeReference
    │   └── ports.py                 # KnowledgeBasePort, CodeNavigatorPort
    ├── application/
    │   └── assistant.py             # ContributorAssistant + agent persona (SYSTEM_PROMPT)
    └── adapters/
        ├── inbound/
        │   ├── cli.py               # argv/stdin orchestration
        │   └── cli_io.py            # contributor-facing stdout (answers, echoes)
            └── outbound/
            ├── llamaindex_knowledge_base.py  # per-area indexes + FunctionCallingAgent
            ├── llamaindex_io.py              # LlamaIndex print/warning isolation (stderr if logs on)
            ├── embedding_area_classifier.py  # autodetects target area(s) before retrieval
            └── repo_code_navigator.py        # read-only repo scan behind CodeNavigatorPort
```

### Areas (the "graph chain")

The corpus is partitioned into areas; each file is assigned to the **first** area whose globs match (so specific layers win over catch-alls). Each area becomes a `search_<area>` retrieval tool whose description is the routing hint the agent sees. Areas are defined in [`config.py`](agent_smith/config.py) (`DEFAULT_AREAS`):

| Area | What it holds |
|------|---------------|
| `contracts` | Solidity contracts + their docs (`contracts/**`, `**/*.sol`) |
| `agent_smith` | The Agent Smith package itself (`agent smith/agent_smith/`, `main.py`, README) — routing, RAG, CLI, config |
| `domain` | Entities, value objects, enums, ports (`**/domain/**`) |
| `application` | Use cases, services, state transitions (`**/application/**`) |
| `io` | Adapters, DI wiring, shared transport (`**/adapters/**`, `**/*.module.ts`, `**/shared/**`) |
| `infra` | Compose, Makefile, Prisma schema, app config (`docker-compose.yml`, `Makefile`, `**/prisma/**`, `**/config/**`) |
| `glossary` | Fintech domain terms (`agent smith/glossary/`) — `fintech.txt` is split into RAG chunks; `domain_prompt.txt` is injected into the system prompt |
| `docs` | `.meta` guides + READMEs (catch-all for docs) |

For each question, `EmbeddingAreaClassifier` embeds it once and cosine-ranks it against the area descriptions to pick the target area(s) (the top area plus any runner-up within `AGENT_SMITH_AUTODETECT_MARGIN`, capped at `AGENT_SMITH_AUTODETECT_TOP_K`). Only those `search_<area>` tools are handed to the agent, and the detection is printed above each answer (`detected area(s): domain, io`). Pass `--area <name>` to skip autodetection and force one area.

### Glossary (`agent smith/glossary/`)

- **`domain_prompt.txt`** — canonical definitions always injected into the system prompt (Transaction vs blockchain tx, Invoice, Quote, etc.).
- **`fintech.txt`** — full domain glossary; at index time it is split into ~14 section chunks tagged with ids like `chunk_002_transactions_orders_invoices` (no CSV/pandas — section headers in the txt file drive chunking).

Questions mentioning domain terms (invoice, order, quote, payment, …) autodetect to `glossary` + `application` + `domain`. Questions about Agent Smith itself (make agent, reindex, routing, tools) autodetect to `agent_smith` + `docs` + `infra`. **Reindex after corpus changes:** `make agent-reindex`.

### Code tools

Read-only tools the agent can call to highlight concrete code for a problem (implemented by `RepoCodeNavigator` behind `CodeNavigatorPort`, a pure-Python scan over the indexed files — no shell-out):

| Tool | Purpose |
|------|---------|
| `find_in_repo(pattern, area?)` | Regex/substring search returning `file:line` matches |
| `read_file(path, start?, end?)` | Quote exact code from an indexed file |
| `echo_code(path, start?, end?)` | Print a numbered code slice from the **current git branch** to the terminal (shown above the answer) |
| `list_area_files(area)` | List the files that make up an area |
| `key_files_for(topic)` | Surface the key files for a problem (curated `DEFAULT_TOPICS`, with a path-matching fallback) |

### Swapping the IO layer

`cli.py` is the only inbound adapter. To expose the assistant over HTTP, Slack, etc., add a new adapter under `adapters/inbound/` that accepts a `ContributorAssistant` and wire it in `main.py`. Nothing else changes.

### Swapping the retrieval engine

`LlamaIndexKnowledgeBase` is the only module importing LlamaIndex. Any class implementing `KnowledgeBasePort` (`ask`, `rebuild`) can replace it — e.g. a hosted RAG API or a different framework. Likewise, the code tools sit behind `CodeNavigatorPort`, so the filesystem scan can be swapped for a code-search API without touching the agent.

## Token usage per Make target (most expensive first)

Indexing embeds the whole corpus once (split across the per-area indexes — total embedding cost is the same as a single index since each file lands in exactly one area). Asking now runs an agent loop: it embeds the question for each area tool it consults and may make a few extra LLM/tool round-trips for routing and code lookups, so a question costs a bit more than the old single-shot query. The host (`.storage/`) and Docker (`agent_smith_index` volume) keep **separate** indexes, so building both doubles the indexing cost.

| Rank | Target | What hits the API | Approx. tokens |
|------|--------|-------------------|----------------|
| 1 | `make agent-reindex` | Re-embeds every chunk of the corpus (all areas) | ~100–200k embedding tokens |
| 1 | first `make agent` / `make agent-docker` (cold index) | Same full indexing, plus one question | same as reindex + ~10–20k |
| 2 | `make agent q="..."` / question in the REPL (warm index) | Agent routing + per-area retrieval + tool calls | ~10–20k LLM tokens, ~20 embedding tokens/area |
| 3 | `make agent` startup with warm index, no questions | Nothing — indexes load from disk | 0 |
| 4 | `make agent-init`, `make agent-build`, `docker compose build agent-smith` | Nothing — local/pip/docker only | 0 |

Cheap habits: keep the persisted indexes warm and reindex only after meaningful doc/code changes; prefer one-shot `q="..."` over exploratory REPL sessions when you just need a fact; use `--area <name>` to skip routing and consult a single area; lower `AGENT_SMITH_SIMILARITY_TOP_K` (5 → 3) to shrink each answer's LLM context.

### Rate limits (429 "Request too large")

Embedding requests are batched; worst case tokens per request ≈ `AGENT_SMITH_EMBED_BATCH_SIZE × AGENT_SMITH_CHUNK_SIZE`. The defaults (10 × 512 ≈ 5k) fit the free 40k TPM tier; raise the batch size on paid tiers for faster indexing.

## Configuration

All settings come from `agent smith/.env` (see `.example.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Required; used for LLM + embeddings |
| `AGENT_SMITH_LLM_MODEL` | `gpt-4o-mini` | Chat model for answers |
| `AGENT_SMITH_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `AGENT_SMITH_SIMILARITY_TOP_K` | `5` | Retrieved chunks per question |
| `AGENT_SMITH_AUTODETECT_TOP_K` | `3` | Max areas a question is auto-routed to |
| `AGENT_SMITH_AUTODETECT_MARGIN` | `0.04` | Similarity gap within which a runner-up area is also included |
| `AGENT_SMITH_EMBED_BATCH_SIZE` | `10` | Chunks per embedding request (rate-limit knob) |
| `AGENT_SMITH_CHUNK_SIZE` | `512` | Tokens per indexed chunk |
| `AGENT_SMITH_SOURCES` | docs + source dirs | Comma-separated repo-relative paths to index |
| `AGENT_SMITH_STORAGE_DIR` | `.storage` | Persisted index location (one `<area>/` subdir per area + `areas.json`) |
| `AGENT_SMITH_REPO_ROOT` | repo root | Checkout to index |

`node_modules`, `dist`, `generated`, and the index storage itself are always excluded.

The **areas** (their globs and routing descriptions) and the **curated topics** for `key_files_for` are defined in code — `DEFAULT_AREAS` and `DEFAULT_TOPICS` in [`agent_smith/config.py`](agent_smith/config.py) — since they describe the repo's structure rather than per-user settings. Edit them there to add or reshape an area.
