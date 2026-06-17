from __future__ import annotations

import logging
import math
import re
from typing import Dict, List, Optional

from llama_index.embeddings.openai import OpenAIEmbedding

from ...config import AgentConfig

log = logging.getLogger("agent_smith.classifier")

# "Where/how we create or implement something" spans application (use cases) first,
# then domain (models/rules), then io (controllers/adapters). Rule-based so vague
# questions like "where we creating invoice" still hit the right layers.
_CREATION_INTENT = re.compile(
    r"\b(create|creating|creation|implement(?:ing|ed)?)\b|"
    r"where\s+(?:do\s+we|in\s+(?:the\s+)?(?:code|codebase|project|repo))",
    re.IGNORECASE,
)
_LAYERED_AREAS = ["application", "domain", "io"]


class EmbeddingAreaClassifier:
    """Outbound adapter implementing AreaClassifierPort.

    Embeds the question once and cosine-ranks it against each area's description.
    Deterministic for a given embedding model and far cheaper than letting the
    agent select tools through multiple LLM round-trips.
    """

    def __init__(self, config: AgentConfig) -> None:
        self._config = config
        self._embed = OpenAIEmbedding(
            model=config.embedding_model,
            embed_batch_size=config.embed_batch_size,
        )
        self._area_vectors: Optional[Dict[str, List[float]]] = None

    def classify(self, question: str) -> List[str]:
        question = question.strip()
        if not question:
            return []

        intent = self._intent_areas(question)
        if intent is not None:
            log.info("routing via creation intent: %s", intent)
            return intent

        query_vector = self._embed.get_text_embedding(question)
        scored = sorted(
            ((name, _cosine(query_vector, vector)) for name, vector in self._profiles().items()),
            key=lambda item: item[1],
            reverse=True,
        )
        if not scored:
            return []

        top_name, top_score = scored[0]
        selected = [top_name]
        cap = max(self._config.area_detect_top_k, 1)
        # Every runner-up within the margin may qualify — not only the 2nd-ranked area.
        for name, score in scored[1:]:
            if len(selected) >= cap:
                break
            if top_score - score <= self._config.area_detect_margin:
                selected.append(name)
        log.info("routing via embeddings: %s", selected)
        return selected

    def _intent_areas(self, question: str) -> Optional[List[str]]:
        if not _CREATION_INTENT.search(question):
            return None
        cap = max(self._config.area_detect_top_k, 1)
        known = set(self._config.area_names)
        return [area for area in _LAYERED_AREAS if area in known][:cap]

    def _profiles(self) -> Dict[str, List[float]]:
        if self._area_vectors is None:
            areas = self._config.areas
            texts = [f"{area.name}. {area.description}" for area in areas]
            vectors = self._embed.get_text_embedding_batch(texts)
            self._area_vectors = {area.name: vector for area, vector in zip(areas, vectors)}
        return self._area_vectors


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)
