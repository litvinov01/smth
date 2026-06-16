from __future__ import annotations

import argparse
import sys
from typing import List, Optional

from ...application.assistant import ContributorAssistant
from ...domain.models import Answer

PROMPT = "you> "
BANNER = (
    "Agent Smith — ask me anything about the smth project.\n"
    "Type 'exit' or press Ctrl-D to leave.\n"
)


def run(assistant: ContributorAssistant, argv: Optional[List[str]] = None, areas: Optional[List[str]] = None) -> int:
    """CLI entry point. The only module that knows about argv/stdin/stdout —
    swap this adapter (e.g. for HTTP or Slack) without touching the rest."""
    parser = argparse.ArgumentParser(
        prog="agent-smith",
        description="Internal RAG assistant that explains the smth repository to contributors.",
    )
    parser.add_argument("question", nargs="?", help="one-shot question; omit for interactive mode")
    parser.add_argument("--rebuild", action="store_true", help="re-index the repository before answering")
    parser.add_argument("--no-sources", action="store_true", help="hide the source fragments under each answer")
    parser.add_argument(
        "--area",
        choices=areas or None,
        help="override autodetection and force a single area"
        + (f" ({', '.join(areas)})" if areas else ""),
    )
    args = parser.parse_args(argv)

    if args.rebuild:
        print("Rebuilding the knowledge index... (this may take a minute)")
        assistant.rebuild_knowledge()
        print("Index rebuilt.\n")

    if args.question:
        _print_answer(assistant.ask(args.question, area=args.area), show_sources=not args.no_sources)
        return 0

    return _interactive_loop(assistant, show_sources=not args.no_sources, area=args.area)


def _interactive_loop(assistant: ContributorAssistant, show_sources: bool, area: Optional[str]) -> int:
    print(BANNER)
    while True:
        try:
            question = input(PROMPT).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0

        if not question:
            continue
        if question.lower() in {"exit", "quit"}:
            return 0

        try:
            _print_answer(assistant.ask(question, area=area), show_sources=show_sources)
        except Exception as error:  # keep the REPL alive on transient API errors
            print(f"error: {error}", file=sys.stderr)


def _print_answer(answer: Answer, show_sources: bool) -> None:
    if answer.areas:
        print(f"\ndetected area(s): {', '.join(answer.areas)}")

    for echo in answer.echoes:
        print(f"\n--- code echo: {echo.file_path} (branch: {echo.branch}, lines {echo.start}-{echo.end}) ---")
        print(echo.content)
        print("---")

    print(f"\n{answer.text.strip()}\n")

    if show_sources and answer.sources:
        print("sources:")
        for source in answer.sources:
            score = f" ({source.score:.2f})" if source.score is not None else ""
            print(f"  - {source.file_path}{score}")
        print()
