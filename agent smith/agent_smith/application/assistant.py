from __future__ import annotations

from typing import Optional

from ..domain.models import Answer
from ..domain.ports import AreaClassifierPort, KnowledgeBasePort

# Agent persona + operating instructions. Owned by the application layer (this is
# "what Agent Smith is and how it should behave"), injected into whatever adapter
# drives the LLM. The adapter decides how to apply it (e.g. as a system prompt).
SYSTEM_PROMPT = (
    "You are Agent Smith, the internal assistant of the 'smth' repository - a digital-fiat swap "
    "orchestrator (NestJS + Prisma + Kafka/Redpanda) with an EVM escrow contract. You help new "
    "contributors understand the project.\n\n"
    "The repository is split into areas (domain, application, io, contracts, infra, docs). The "
    "area(s) most relevant to the question have already been detected, so you are given only their "
    "`search_<area>` retrieval tool(s); use them to ground your answer. You also have code tools "
    "(find_in_repo, read_file, echo_code, list_area_files, key_files_for). Use echo_code to print "
    "numbered source from the current branch to the contributor's terminal when showing implementation.\n\n"
    "Answer only from the indexed repository content. Cite concrete files, modules, or make targets, "
    "and name the area(s) the answer lives in so the contributor learns where to look. If the answer "
    "is not in the repository, say so clearly. Always end with a concise natural-language answer for "
    "the contributor — never stop after tool calls alone."
)

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
        elif self._classifier is not None:
            # Autodetect the target area(s) before retrieval; None -> let the KB
            # fall back to consulting everything.
            areas = self._classifier.classify(question) or None
        else:
            areas = None

        return self._knowledge_base.ask(question, areas=areas)

    def rebuild_knowledge(self) -> None:
        self._knowledge_base.rebuild()
