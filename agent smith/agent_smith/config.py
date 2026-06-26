from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv

from .domain.models import Area

# Directory containing this package ("agent smith/").
PACKAGE_ROOT = Path(__file__).resolve().parent.parent
# Repository root ("smth/") — Agent Smith indexes the repo it lives in.
DEFAULT_REPO_ROOT = PACKAGE_ROOT.parent

DEFAULT_SOURCES = [
    ".meta",
    "README.md",
    "docker-compose.yml",
    "Makefile",
    "contracts",
    "orchestrator/README.md",
    "orchestrator/prisma",
    "orchestrator/src",
    "agent smith/glossary",
    "agent smith/agent_smith",
    "agent smith/README.md",
    "agent smith/main.py",
]

# File types worth embedding when a source entry is a directory.
DEFAULT_INCLUDED_EXTENSIONS = [".md", ".ts", ".sol", ".prisma", ".yml", ".yaml", ".sql", ".json", ".txt", ".py"]

# Never index these (dependency trees, build output, the agent's own index).
# Hidden-path reading is enabled so that ".meta" can be indexed, hence the explicit dot-dir excludes.
EXCLUDED_GLOBS = [
    "**/node_modules/**",
    "**/dist/**",
    "**/generated/**",
    "**/.storage/**",
    "**/.git/**",
    "**/.venv/**",
    "**/__pycache__/**",
    "**/package-lock.json",
]

# Architectural slices of the repo. Order matters: a file is assigned to the
# FIRST area whose globs match, so more specific areas come before catch-alls.
# Each description doubles as the routing hint the agent sees for that area.
DEFAULT_AREAS: List[Area] = [
    Area(
        name="contracts",
        description=(
            "On-chain Solidity contracts and their docs (the EVM escrow/settlement layer, "
            "e.g. Transactor.sol). Use for questions about on-chain logic, deployment, claims, "
            "and settlement at the contract level."
        ),
        include_globs=["contracts/**", "**/*.sol"],
    ),
    Area(
        name="agent_smith",
        description=(
            "Agent Smith itself: the internal RAG assistant (agent smith/agent_smith/), its hexagonal "
            "layout, area routing, LlamaIndex adapters, glossary integration, CLI, config env vars, and "
            "Makefile targets (make agent, agent-reindex, logs=1). Use when contributors ask how the "
            "agent works, how to configure or extend it, or what retrieval/routing/tools it uses."
        ),
        include_globs=[
            "agent smith/agent_smith/**",
            "agent smith/main.py",
            "agent smith/README.md",
        ],
    ),
    Area(
        name="domain",
        description=(
            "Pure business core: entities, value objects, enums, and port interfaces under "
            "**/domain/**. Use for questions about domain models, invariants, statuses, and the "
            "contracts (ports) that adapters must implement."
        ),
        include_globs=["**/domain/**"],
    ),
    Area(
        name="application",
        description=(
            "Use cases and orchestration under **/application/** — services that implement "
            "create/update commands, business operations, state transitions, and event processors. "
            "Primary layer for 'where do we create X' and 'how does an operation run' questions: "
            "e.g. TransactionService.create, settlement orchestration, event handling."
        ),
        include_globs=["**/application/**"],
    ),
    Area(
        name="io",
        description=(
            "Inbound and outbound adapters plus DI wiring and shared transport: **/adapters/**, "
            "NestJS *.module.ts, and **/shared/** (HTTP controllers/formatters, Kafka "
            "consumers/publishers, Prisma persistence, blockchain clients). Use for questions about "
            "wiring to the outside world, transport, and integrations."
        ),
        include_globs=[
            "**/adapters/inbound/**",
            "**/adapters/outbound/**",
            "**/shared/**",
            "**/*.module.ts",
            "**/app.*.ts",
        ],
    ),
    Area(
        name="infra",
        description=(
            "Local stack, operations, and configuration: docker-compose, Makefile targets, the "
            "Prisma schema, app config schemas, and infra docs. Use for questions about running, "
            "building, migrating, ports, env vars, and configuration."
        ),
        include_globs=[
            "docker-compose.yml",
            "Makefile",
            "**/prisma/**",
            "**/config/**",
            "**/main.ts",
            ".meta/infra.md",
        ],
    ),
    Area(
        name="glossary",
        description=(
            "Swap/fintech domain glossary: transactions, orders, invoices, quotes, payments, payouts, "
            "H2H/redirect/iframe flows, PCI, web3, statuses, compliance, APIs, and ambiguous terms. "
            "Use when the contributor asks about domain language, disambiguating terms (invoice vs "
            "transaction vs blockchain tx), or product concepts before diving into code."
        ),
        include_globs=["**/glossary/**"],
    ),
    Area(
        name="docs",
        description=(
            "Project documentation and onboarding: .meta guides (architecture, bootstrap, testing) "
            "and READMEs. Use for conceptual, onboarding, conventions, and 'where do I start' questions."
        ),
        include_globs=[".meta/**", "**/README.md"],
    ),
]

# Curated problem -> file-path-substring hints, surfaced by `key_files_for`.
# Substrings are matched against indexed repo-relative paths, so they survive
# small renames better than exact paths and fall back to retrieval when unknown.
DEFAULT_TOPICS: Dict[str, List[str]] = {
    "transaction-lifecycle": [
        "transaction.entity.ts",
        "transaction-status.ts",
        "transaction.service.ts",
        "transaction.repository.ts",
        "transaction.controller.ts",
        "Transactor.sol",
    ],
    "settlement": [
        "settlement-check.consumer.ts",
        "receipt-check.consumer.ts",
        "transaction-event.processor.ts",
        "Transactor.sol",
    ],
    "deployment-claim": [
        "deployment-claim.ts",
        "deployment-requested.consumer.ts",
        "viem-transactor.adapter.ts",
        "Transactor.sol",
    ],
    "messaging": [
        "kafka-topics.ts",
        "swap-events.schema.ts",
        "event-publisher.port.ts",
        "kafka-event.publisher.ts",
        "transaction-event.consumers.ts",
    ],
    "api": [
        "transaction.controller.ts",
        "transaction.v1.formatter.ts",
        "transaction.v1.schema.ts",
        "transaction.docs.ts",
    ],
    "invoice": [
        "fintech.txt",
        "transaction.service.ts",
        "transaction.entity.ts",
    ],
    "glossary": [
        "fintech.txt",
        "domain_prompt.txt",
    ],
    "agent-smith": [
        "llamaindex_knowledge_base.py",
        "embedding_area_classifier.py",
        "assistant.py",
        "cli.py",
        "config.py",
    ],
}


@dataclass(frozen=True)
class AgentConfig:
    repo_root: Path
    source_paths: List[Path]
    storage_dir: Path
    llm_model: str
    embedding_model: str
    similarity_top_k: int
    # Rate-limit knobs: chunks per embedding request and tokens per chunk.
    # Worst case per request ~= embed_batch_size * chunk_size tokens — keep it
    # well under your OpenAI tier's TPM limit (40k TPM on the free tier).
    embed_batch_size: int = 10
    chunk_size: int = 512
    included_extensions: List[str] = field(default_factory=lambda: list(DEFAULT_INCLUDED_EXTENSIONS))
    areas: List[Area] = field(default_factory=lambda: list(DEFAULT_AREAS))
    topics: Dict[str, List[str]] = field(default_factory=lambda: dict(DEFAULT_TOPICS))
    # Autodetect: max areas to route a question to, and how close a runner-up's
    # similarity must be to the top area to also be included (0 -> top area only).
    area_detect_top_k: int = 3
    area_detect_margin: float = 0.04

    @property
    def area_names(self) -> List[str]:
        return [area.name for area in self.areas]

    def storage_dir_for(self, area_name: str) -> Path:
        """Per-area persisted index location (one subdir per area)."""
        return self.storage_dir / area_name

    def relative_path(self, path: Path) -> str:
        """Repo-relative POSIX path for an absolute file path (best effort)."""
        try:
            return path.resolve().relative_to(self.repo_root).as_posix()
        except ValueError:
            return path.as_posix()

    def area_for_path(self, path: Path) -> Optional[str]:
        """First area whose globs match the file, or None if it belongs to no area."""
        return classify_area(self.relative_path(path), self.areas)


def _glob_to_regex(pattern: str) -> "re.Pattern[str]":
    """Translate a repo-relative glob into a regex.

    `**` matches across directory separators (and `**/` may match zero dirs);
    `*` and `?` match within a single path segment.
    """
    parts = pattern.split("/")
    out = ""
    for index, token in enumerate(parts):
        is_last = index == len(parts) - 1
        if token == "**":
            out += ".*" if is_last else "(?:.*/)?"
            continue
        segment = re.escape(token).replace(r"\*", "[^/]*").replace(r"\?", "[^/]")
        out += segment
        if not is_last:
            out += "/"
    return re.compile("^" + out + "$")


# Compiled lazily and cached by pattern string to avoid recompiling per file.
_REGEX_CACHE: Dict[str, "re.Pattern[str]"] = {}


def _matches(rel_path: str, pattern: str) -> bool:
    regex = _REGEX_CACHE.get(pattern)
    if regex is None:
        regex = _glob_to_regex(pattern)
        _REGEX_CACHE[pattern] = regex
    return regex.match(rel_path) is not None


def classify_area(rel_path: str, areas: List[Area]) -> Optional[str]:
    """Return the name of the first area whose globs match a repo-relative path."""
    for area in areas:
        if any(_matches(rel_path, pattern) for pattern in area.include_globs):
            return area.name
    return None


def is_excluded(rel_path: str) -> bool:
    """True if a repo-relative path matches any always-excluded glob."""
    return any(_matches(rel_path, pattern) for pattern in EXCLUDED_GLOBS)


def _env(name: str, default: str) -> str:
    """Read an env var, treating empty values (e.g. 'VAR=' in .env) as unset."""
    value = os.environ.get(name, "").strip()
    return value or default


def load_config() -> AgentConfig:
    load_dotenv(PACKAGE_ROOT / ".env")

    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError(
            "OPENAI_API_KEY is not set. On the host: copy '.example.env' to '.env' inside 'agent smith/'. "
            "With docker compose: set it in the root '.env'.",
        )

    repo_root = Path(_env("AGENT_SMITH_REPO_ROOT", str(DEFAULT_REPO_ROOT))).resolve()

    raw_sources = _env("AGENT_SMITH_SOURCES", "")
    relative_sources = (
        [entry.strip() for entry in raw_sources.split(",") if entry.strip()] if raw_sources else DEFAULT_SOURCES
    )
    source_paths = [repo_root / entry for entry in relative_sources if (repo_root / entry).exists()]
    if not source_paths:
        raise RuntimeError(f"No index sources found under {repo_root}. Check AGENT_SMITH_SOURCES.")

    storage_raw = _env("AGENT_SMITH_STORAGE_DIR", str(PACKAGE_ROOT / ".storage"))
    storage_dir = Path(storage_raw)
    if not storage_dir.is_absolute():
        storage_dir = (PACKAGE_ROOT / storage_dir).resolve()

    return AgentConfig(
        repo_root=repo_root,
        source_paths=source_paths,
        storage_dir=storage_dir,
        llm_model=_env("AGENT_SMITH_LLM_MODEL", "gpt-4o-mini"),
        embedding_model=_env("AGENT_SMITH_EMBEDDING_MODEL", "text-embedding-3-small"),
        similarity_top_k=int(_env("AGENT_SMITH_SIMILARITY_TOP_K", "5")),
        embed_batch_size=int(_env("AGENT_SMITH_EMBED_BATCH_SIZE", "10")),
        chunk_size=int(_env("AGENT_SMITH_CHUNK_SIZE", "512")),
        area_detect_top_k=int(_env("AGENT_SMITH_AUTODETECT_TOP_K", "3")),
        area_detect_margin=float(_env("AGENT_SMITH_AUTODETECT_MARGIN", "0.04")),
    )
