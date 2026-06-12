from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


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
