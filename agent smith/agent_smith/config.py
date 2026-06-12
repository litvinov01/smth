from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from dotenv import load_dotenv

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
]

# File types worth embedding when a source entry is a directory.
DEFAULT_INCLUDED_EXTENSIONS = [".md", ".ts", ".sol", ".prisma", ".yml", ".yaml", ".sql", ".json"]

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

    return AgentConfig(
        repo_root=repo_root,
        source_paths=source_paths,
        storage_dir=Path(_env("AGENT_SMITH_STORAGE_DIR", str(PACKAGE_ROOT / ".storage"))),
        llm_model=_env("AGENT_SMITH_LLM_MODEL", "gpt-4o-mini"),
        embedding_model=_env("AGENT_SMITH_EMBEDDING_MODEL", "text-embedding-3-small"),
        similarity_top_k=int(_env("AGENT_SMITH_SIMILARITY_TOP_K", "5")),
        embed_batch_size=int(_env("AGENT_SMITH_EMBED_BATCH_SIZE", "10")),
        chunk_size=int(_env("AGENT_SMITH_CHUNK_SIZE", "512")),
    )
