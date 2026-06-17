from __future__ import annotations

import argparse
import sys
from typing import List, Optional

from ...application.assistant import ContributorAssistant
from .cli_io import PROMPT, write_answer, write_banner, write_error, write_line


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
        "--logs-enabled",
        action="store_true",
        help="print agent diagnostics to stderr (LlamaIndex load, routing, tool calls)",
    )
    parser.add_argument(
        "--area",
        choices=areas or None,
        help="override autodetection and force a single area"
        + (f" ({', '.join(areas)})" if areas else ""),
    )
    args = parser.parse_args(argv)

    if args.rebuild:
        write_line("Rebuilding the knowledge index... (this may take a minute)")
        assistant.rebuild_knowledge()
        write_line("Index rebuilt.\n")

    if args.question:
        write_answer(assistant.ask(args.question, area=args.area), show_sources=not args.no_sources)
        return 0

    return _interactive_loop(assistant, show_sources=not args.no_sources, area=args.area)


def _interactive_loop(assistant: ContributorAssistant, show_sources: bool, area: Optional[str]) -> int:
    write_banner()
    while True:
        try:
            question = input(PROMPT).strip()
        except (EOFError, KeyboardInterrupt):
            write_line()
            return 0

        if not question:
            continue
        if question.lower() in {"exit", "quit"}:
            return 0

        try:
            write_answer(assistant.ask(question, area=area), show_sources=show_sources)
        except Exception as error:  # keep the REPL alive on transient API errors
            write_error(str(error))
