from __future__ import annotations

from typing import List, Optional, Protocol

from .models import Answer, CodeEcho, CodeReference


class KnowledgeBasePort(Protocol):
    """Retrieval + generation backend (LlamaIndex today, anything tomorrow)."""

    def ask(self, question: str, areas: Optional[List[str]] = None) -> Answer:
        """Answer a question, optionally constrained to specific area names."""
        ...

    def rebuild(self) -> None:
        """Re-index the repository from scratch."""
        ...


class AreaClassifierPort(Protocol):
    """Cheap, deterministic detection of which area(s) a question belongs to.

    Runs before retrieval so the agent is handed only the relevant area tools,
    instead of choosing freely (cheaper and more predictable).
    """

    def classify(self, question: str) -> List[str]:
        """Return area names ranked most-relevant first (possibly empty)."""
        ...


class CodeNavigatorPort(Protocol):
    """Read-only navigation over the indexed repository.

    Powers the agent's code-highlighting tools; a filesystem scan today, a
    GitHub/code-search API tomorrow.
    """

    def find(self, pattern: str, area: Optional[str] = None) -> List[CodeReference]:
        """Return file:line matches for a literal/regex pattern, optionally scoped to an area."""
        ...

    def read_file(self, path: str, start: Optional[int] = None, end: Optional[int] = None) -> str:
        """Return the contents of a repo-relative file, optionally a 1-indexed line slice."""
        ...

    def list_area_files(self, area: str) -> List[str]:
        """Return the repo-relative files that belong to an area."""
        ...

    def key_files_for(self, topic: str) -> List[str]:
        """Return the files most important to understanding a topic/problem."""
        ...

    def echo_code(
        self,
        path: str,
        start: Optional[int] = None,
        end: Optional[int] = None,
    ) -> CodeEcho:
        """Read a repo-relative slice from the current branch for terminal display."""
        ...
