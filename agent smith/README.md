# Agent Smith

Internal RAG assistant for contributors. It indexes this repository (the `.meta` docs, READMEs, orchestrator source, Prisma schema, contracts, compose/Make files) with [LlamaIndex](https://docs.llamaindex.ai/) and answers questions like "how does a transaction reach FUNDED?" or "what does `make test-init` do?".

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
```

The vector index is built on first run and persisted to `.storage/` (gitignored); subsequent runs reuse it. Run with `--rebuild` whenever docs or code change significantly.

## Architecture

Same hexagonal rules as the rest of the repo (see [.meta/architecture.md](../.meta/architecture.md)): the IO layer and the retrieval engine are both adapters behind ports, so either can be replaced without touching business logic.

```
agent smith/
├── main.py                          # composition root (wires everything)
└── agent_smith/
    ├── config.py                    # env-driven settings
    ├── domain/
    │   ├── models.py                # Answer, SourceChunk
    │   └── ports.py                 # KnowledgeBasePort
    ├── application/
    │   └── assistant.py             # ContributorAssistant (question framing)
    └── adapters/
        ├── inbound/
        │   └── cli.py               # CLI — the only module touching argv/stdin/stdout
        └── outbound/
            └── llamaindex_knowledge_base.py  # LlamaIndex vector index + query engine
```

### Swapping the IO layer

`cli.py` is the only inbound adapter. To expose the assistant over HTTP, Slack, etc., add a new adapter under `adapters/inbound/` that accepts a `ContributorAssistant` and wire it in `main.py`. Nothing else changes.

### Swapping the retrieval engine

`LlamaIndexKnowledgeBase` is the only module importing LlamaIndex. Any class implementing `KnowledgeBasePort` (`ask`, `rebuild`) can replace it — e.g. a hosted RAG API or a different framework.

## Token usage per Make target (most expensive first)

Indexing embeds the whole corpus; asking embeds ~20 tokens and pays for one completion. The host (`.storage/`) and Docker (`agent_smith_index` volume) keep **separate** indexes, so building both doubles the indexing cost.

| Rank | Target | What hits the API | Approx. tokens |
|------|--------|-------------------|----------------|
| 1 | `make agent-reindex` | Re-embeds every chunk of the corpus | ~100–200k embedding tokens |
| 1 | first `make agent` / `make agent-docker` (cold index) | Same full indexing, plus one question | same as reindex + ~5–10k |
| 2 | `make agent q="..."` / question in the REPL (warm index) | Embeds the question + one LLM completion with top-k context | ~5–10k LLM tokens, ~20 embedding tokens |
| 3 | `make agent` startup with warm index, no questions | Nothing — index loads from disk | 0 |
| 4 | `make agent-init`, `make agent-build`, `docker compose build agent-smith` | Nothing — local/pip/docker only | 0 |

Cheap habits: keep the persisted index warm and reindex only after meaningful doc/code changes; prefer one-shot `q="..."` over exploratory REPL sessions when you just need a fact; lower `AGENT_SMITH_SIMILARITY_TOP_K` (5 → 3) to shrink each answer's LLM context.

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
| `AGENT_SMITH_EMBED_BATCH_SIZE` | `10` | Chunks per embedding request (rate-limit knob) |
| `AGENT_SMITH_CHUNK_SIZE` | `512` | Tokens per indexed chunk |
| `AGENT_SMITH_SOURCES` | docs + source dirs | Comma-separated repo-relative paths to index |
| `AGENT_SMITH_STORAGE_DIR` | `.storage` | Persisted index location |
| `AGENT_SMITH_REPO_ROOT` | repo root | Checkout to index |

`node_modules`, `dist`, `generated`, and the index storage itself are always excluded.
