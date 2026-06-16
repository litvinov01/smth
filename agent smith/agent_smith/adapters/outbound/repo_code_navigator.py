from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from ...config import AgentConfig, classify_area, is_excluded
from ...domain.models import CodeEcho, CodeReference

# Hard caps so a tool call can never flood the agent's context window.
MAX_FIND_RESULTS = 40
MAX_READ_LINES = 400
SNIPPET_MAX_CHARS = 200


class RepoCodeNavigator:
    """Outbound adapter implementing CodeNavigatorPort via a read-only filesystem scan.

    It only ever looks at the same files Agent Smith indexes (honoring the source
    paths, included extensions, and exclusion globs), so what it surfaces always
    matches what the knowledge base could have retrieved. No shell-out, so it adds
    no runtime dependency to the Docker image.
    """

    def __init__(self, config: AgentConfig) -> None:
        self._config = config
        self._files: Optional[Tuple[Tuple[str, Path], ...]] = None

    def find(self, pattern: str, area: Optional[str] = None) -> List[CodeReference]:
        try:
            regex = re.compile(pattern, re.IGNORECASE)
        except re.error:
            # Fall back to a literal search when the input is not valid regex.
            regex = re.compile(re.escape(pattern), re.IGNORECASE)

        results: List[CodeReference] = []
        for rel_path, abs_path in self._indexed_files():
            if area is not None and classify_area(rel_path, self._config.areas) != area:
                continue

            try:
                lines = abs_path.read_text(encoding="utf-8", errors="ignore").splitlines()
            except OSError:
                continue

            for line_number, line in enumerate(lines, start=1):
                if regex.search(line):
                    results.append(
                        CodeReference(
                            file_path=rel_path,
                            snippet=line.strip()[:SNIPPET_MAX_CHARS],
                            lines=str(line_number),
                        )
                    )
                    if len(results) >= MAX_FIND_RESULTS:
                        return results
        return results

    def read_file(self, path: str, start: Optional[int] = None, end: Optional[int] = None) -> str:
        abs_path = self._resolve(path)
        if abs_path is None:
            return f"error: '{path}' is not an indexed repository file."

        first, last, numbered = self._read_numbered_slice(abs_path, start, end)
        if numbered is None:
            return f"error: could not read '{path}'"
        return "\n".join(numbered)

    def echo_code(
        self,
        path: str,
        start: Optional[int] = None,
        end: Optional[int] = None,
    ) -> CodeEcho:
        """Return a numbered slice from the current branch for terminal display."""
        abs_path = self._resolve(path)
        branch = self.current_branch()
        if abs_path is None:
            return CodeEcho(
                file_path=path,
                branch=branch,
                start=start or 1,
                end=end or 1,
                content=f"error: '{path}' is not an indexed repository file.",
            )

        first, last, numbered = self._read_numbered_slice(abs_path, start, end)
        if numbered is None:
            return CodeEcho(
                file_path=path,
                branch=branch,
                start=start or 1,
                end=end or 1,
                content=f"error: could not read '{path}'",
            )
        return CodeEcho(
            file_path=path,
            branch=branch,
            start=first,
            end=last,
            content="\n".join(numbered),
        )

    def current_branch(self) -> str:
        """Best-effort name of the checked-out git branch (working tree)."""
        head_file = self._config.repo_root / ".git" / "HEAD"
        if head_file.is_file():
            ref = head_file.read_text(encoding="utf-8").strip()
            if ref.startswith("ref: refs/heads/"):
                return ref.rsplit("/", 1)[-1]
            if ref:
                return ref[:12]

        try:
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=str(self._config.repo_root),
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            pass

        return "working-tree"

    def _read_numbered_slice(
        self,
        abs_path: Path,
        start: Optional[int],
        end: Optional[int],
    ) -> Tuple[int, int, Optional[List[str]]]:
        try:
            lines = abs_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            return 1, 1, None

        first = max(start, 1) if start else 1
        last = end if end else len(lines)
        last = min(last, first + MAX_READ_LINES - 1, len(lines))
        selected = lines[first - 1 : last]
        numbered = [f"{first + offset:>6}| {text}" for offset, text in enumerate(selected)]
        return first, last, numbered

    def list_area_files(self, area: str) -> List[str]:
        return [
            rel_path
            for rel_path, _ in self._indexed_files()
            if classify_area(rel_path, self._config.areas) == area
        ]

    def key_files_for(self, topic: str) -> List[str]:
        normalized = topic.strip().lower()
        substrings = self._config.topics.get(normalized)
        if substrings is None:
            # Unknown topic: match files whose path contains the topic token(s).
            tokens = [token for token in re.split(r"[\s_-]+", normalized) if token]
            substrings = tokens or [normalized]

        all_files = [rel_path for rel_path, _ in self._indexed_files()]
        matched: List[str] = []
        for needle in substrings:
            for rel_path in all_files:
                if needle.lower() in rel_path.lower() and rel_path not in matched:
                    matched.append(rel_path)
        return matched

    def _indexed_files(self) -> Tuple[Tuple[str, Path], ...]:
        """All (repo-relative, absolute) files Agent Smith would index, cached."""
        if self._files is not None:
            return self._files

        seen: dict = {}
        included = tuple(self._config.included_extensions)

        for source in self._config.source_paths:
            if source.is_file():
                self._add(seen, source)
                continue
            for candidate in source.rglob("*"):
                if not candidate.is_file() or candidate.suffix not in included:
                    continue
                self._add(seen, candidate)

        self._files = tuple(sorted(seen.items()))
        return self._files

    def _add(self, seen: dict, abs_path: Path) -> None:
        rel_path = self._config.relative_path(abs_path)
        if not is_excluded(rel_path):
            seen.setdefault(rel_path, abs_path)

    def _resolve(self, path: str) -> Optional[Path]:
        """Resolve a repo-relative path only if it is part of the indexed set."""
        for rel_path, abs_path in self._indexed_files():
            if rel_path == path:
                return abs_path
        return None
