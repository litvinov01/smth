"""Composition root: wires config -> outbound adapters -> application service -> CLI.

To replace the IO layer, swap the inbound adapter import below; the assistant,
knowledge base, and code navigator stay untouched.
"""
from __future__ import annotations

import sys

from agent_smith.adapters.inbound import cli
from agent_smith.adapters.outbound.embedding_area_classifier import EmbeddingAreaClassifier
from agent_smith.adapters.outbound.llamaindex_knowledge_base import LlamaIndexKnowledgeBase
from agent_smith.adapters.outbound.repo_code_navigator import RepoCodeNavigator
from agent_smith.application.assistant import SYSTEM_PROMPT, ContributorAssistant
from agent_smith.config import load_config


def main() -> int:
    config = load_config()
    navigator = RepoCodeNavigator(config)
    classifier = EmbeddingAreaClassifier(config)
    knowledge_base = LlamaIndexKnowledgeBase(config, navigator, SYSTEM_PROMPT)
    assistant = ContributorAssistant(knowledge_base, classifier)
    return cli.run(assistant, areas=config.area_names)


if __name__ == "__main__":
    sys.exit(main())
