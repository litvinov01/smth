from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class Area:
    """A bounded slice of the repository (e.g. domain, contracts, IO adapters).

    `description` doubles as the routing hint shown to the agent so it can pick
    the right area for a question; `include_globs` decide which files belong here.
    """

    name: str
    description: str
    include_globs: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class CodeReference:
    """A concrete pointer into the repository surfaced by a code tool."""

    file_path: str
    snippet: str
    lines: Optional[str] = None


@dataclass(frozen=True)
class CodeEcho:
    """A code slice the agent asked to display in the contributor's terminal."""

    file_path: str
    branch: str
    start: int
    end: int
    content: str


@dataclass(frozen=True)
class SourceChunk:
    """A repository fragment that supported an answer."""

    file_path: str
    snippet: str
    score: Optional[float] = None


@dataclass(frozen=True)
class Answer:
    text: str
    sources: List[SourceChunk] = field(default_factory=list)
    # Areas the agent actually consulted while answering, in invocation order.
    areas: List[str] = field(default_factory=list)
    # Code blocks the agent chose to echo to the terminal (via echo_code tool).
    echoes: List[CodeEcho] = field(default_factory=list)
