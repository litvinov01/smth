"""Composition root: wires config -> LlamaIndex adapter -> application service -> CLI.

To replace the IO layer, swap the inbound adapter import below; the assistant
and knowledge base stay untouched.
"""
from __future__ import annotations

import sys

from agent_smith.adapters.inbound import cli
from agent_smith.adapters.outbound.llamaindex_knowledge_base import LlamaIndexKnowledgeBase
from agent_smith.application.assistant import ContributorAssistant
from agent_smith.config import load_config


def main() -> int:
    config = load_config()
    knowledge_base = LlamaIndexKnowledgeBase(config)
    assistant = ContributorAssistant(knowledge_base)
    return cli.run(assistant)


if __name__ == "__main__":
    sys.exit(main())
