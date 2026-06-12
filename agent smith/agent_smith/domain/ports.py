from __future__ import annotations

from typing import Protocol

from .models import Answer


class KnowledgeBasePort(Protocol):
    """Retrieval + generation backend (LlamaIndex today, anything tomorrow)."""

    def ask(self, question: str) -> Answer: ...

    def rebuild(self) -> None:
        """Re-index the repository from scratch."""
        ...
