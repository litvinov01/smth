"""User-facing terminal output for the CLI inbound adapter.

All contributor-visible stdout/stderr lives here — not in system_log (diagnostics).
"""
from __future__ import annotations

import sys
from typing import Optional

from ...domain.models import Answer

PROMPT = "you> "
BANNER = (
    "Agent Smith — ask me anything about the smth project.\n"
    "Type 'exit' or press Ctrl-D to leave.\n"
)


def write_banner() -> None:
    print(BANNER)


def write_line(text: str = "") -> None:
    print(text)


def write_error(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)


def write_answer(answer: Answer, show_sources: bool) -> None:
    if answer.areas:
        print(f"\ndetected area(s): {', '.join(answer.areas)}")

    for echo in answer.echoes:
        print(
            f"\n--- code echo: {echo.file_path} "
            f"(branch: {echo.branch}, lines {echo.start}-{echo.end}) ---"
        )
        print(echo.content)
        print("---")

    print(f"\n{answer.text.strip()}\n")

    if show_sources and answer.sources:
        print("sources:")
        for source in answer.sources:
            score = f" ({source.score:.2f})" if source.score is not None else ""
            print(f"  - {source.file_path}{score}")
        print()
