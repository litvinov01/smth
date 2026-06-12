from __future__ import annotations

from ..domain.models import Answer
from ..domain.ports import KnowledgeBasePort

QUESTION_TEMPLATE = (
    "You are Agent Smith, the internal assistant of the 'smth' repository — a swap orchestrator "
    "(NestJS + Prisma + Kafka/Redpanda) with an EVM escrow contract. You help new contributors "
    "understand the project. Answer using only the indexed repository content; when relevant, point "
    "to concrete files, modules, or make targets. If the answer is not in the repository, say so.\n\n"
    "Contributor question: {question}"
)


class ContributorAssistant:
    """Use case layer: framing the question is business logic, transport and retrieval are not."""

    def __init__(self, knowledge_base: KnowledgeBasePort) -> None:
        self._knowledge_base = knowledge_base

    def ask(self, question: str) -> Answer:
        return self._knowledge_base.ask(QUESTION_TEMPLATE.format(question=question.strip()))

    def rebuild_knowledge(self) -> None:
        self._knowledge_base.rebuild()
