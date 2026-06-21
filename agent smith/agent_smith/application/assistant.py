from __future__ import annotations

import logging
from typing import Optional

from ..config import PACKAGE_ROOT
from ..domain.models import Answer
from ..domain.ports import AreaClassifierPort, KnowledgeBasePort

log = logging.getLogger("agent_smith.assistant")

DOMAIN_PROMPT_PATH = PACKAGE_ROOT / "glossary" / "domain_prompt.txt"

# Agent persona + operating instructions. Owned by the application layer (this is
# "what Agent Smith is and how it should behave"), injected into whatever adapter
# drives the LLM. The adapter decides how to apply it (e.g. as a system prompt).
SYSTEM_PROMPT = (
    "You are Agent Smith, the internal assistant of the 'smth' repository - a digital-fiat swap "
    "orchestrator (NestJS + Prisma + Kafka/Redpanda) with an EVM escrow contract. You help new "
    "contributors understand the project.\n\n"
    "The repository is split into areas (agent_smith, glossary, domain, application, io, contracts, infra, docs). "
    "The area(s) most relevant to the question have already been detected, so you are given only "
    "their `search_<area>` retrieval tool(s); use them to ground your answer. For domain terms "
    "(invoice, order, quote, payment, swap, H2H, iframe, PCI, token) consult search_glossary "
    "when available to disambiguate before answering about code. You also have code tools "
    "(find_in_repo, read_file, echo_code, list_area_files, key_files_for). Use echo_code to print "
    "numbered source from the current branch to the contributor's terminal when showing implementation.\n\n"
    "Answer only from the indexed repository content. Cite concrete files, modules, or make targets, "
    "and name the area(s) the answer lives in so the contributor learns where to look. When pointing "
    "at implementation, prefer production source code (services, entities, adapters, contracts) over "
    "specs, tests, and mocks — use echo_code on real implementation files; mention tests only when "
    "they are the only relevant reference. If the answer "
    "is not in the repository, say so clearly. Always end with a concise natural-language answer for "
    "the contributor — never stop after tool calls alone."
)


def build_system_prompt() -> str:
    """System prompt plus canonical domain vocabulary from glossary/domain_prompt.txt."""
    domain = _load_domain_prompt()
    if not domain:
        return SYSTEM_PROMPT
    return f"{SYSTEM_PROMPT}\n\n## Domain vocabulary (canonical)\n\n{domain}"


def _load_domain_prompt() -> Optional[str]:
    if not DOMAIN_PROMPT_PATH.is_file():
        return None
    text = DOMAIN_PROMPT_PATH.read_text(encoding="utf-8").strip()
    return text or None


class ContributorAssistant:
    """Use case layer: deciding which area(s) a question targets and how it is
    framed is business logic; transport and retrieval are not."""

    def __init__(
        self,
        knowledge_base: KnowledgeBasePort,
        classifier: Optional[AreaClassifierPort] = None,
    ) -> None:
        self._knowledge_base = knowledge_base
        self._classifier = classifier

    def ask(self, question: str, area: Optional[str] = None) -> Answer:
        question = question.strip()

        if area:
            # Manual override: skip autodetection entirely.
            areas: Optional[list] = [area]
            log.info("area override: %s", area)
        elif self._classifier is not None:
            # Autodetect the target area(s) before retrieval; None -> let the KB
            # fall back to consulting everything.
            areas = self._classifier.classify(question) or None
            log.info("autodetected areas: %s", areas)
        else:
            areas = None

        log.info("asking knowledge base (question=%r)", question[:120])
        return self._knowledge_base.ask(question, areas=areas)

    def rebuild_knowledge(self) -> None:
        self._knowledge_base.rebuild()
