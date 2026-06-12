from __future__ import annotations

import shutil
from typing import List, Optional

from llama_index.core import (
    Settings,
    SimpleDirectoryReader,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

from ...config import EXCLUDED_GLOBS, AgentConfig
from ...domain.models import Answer, SourceChunk

SNIPPET_MAX_CHARS = 240


class LlamaIndexKnowledgeBase:
    """Outbound adapter implementing KnowledgeBasePort with a persisted LlamaIndex vector index."""

    def __init__(self, config: AgentConfig) -> None:
        self._config = config
        self._index: Optional[VectorStoreIndex] = None

        Settings.llm = OpenAI(model=config.llm_model)
        # Small batches keep each embedding request under low TPM rate limits;
        # LlamaIndex's built-in retry/backoff handles the pacing between them.
        Settings.embed_model = OpenAIEmbedding(
            model=config.embedding_model,
            embed_batch_size=config.embed_batch_size,
        )
        Settings.chunk_size = config.chunk_size

    def ask(self, question: str) -> Answer:
        query_engine = self._get_index().as_query_engine(similarity_top_k=self._config.similarity_top_k)
        response = query_engine.query(question)

        sources: List[SourceChunk] = []
        for node in getattr(response, "source_nodes", []):
            file_path = node.metadata.get("file_path") or node.metadata.get("file_name") or "<unknown>"
            snippet = " ".join(node.get_content().split())[:SNIPPET_MAX_CHARS]
            sources.append(SourceChunk(file_path=file_path, snippet=snippet, score=node.score))

        return Answer(text=str(response), sources=sources)

    def rebuild(self) -> None:
        if self._config.storage_dir.exists():
            shutil.rmtree(self._config.storage_dir)
        self._index = self._build_index()

    def _get_index(self) -> VectorStoreIndex:
        if self._index is not None:
            return self._index

        if (self._config.storage_dir / "docstore.json").exists():
            storage_context = StorageContext.from_defaults(persist_dir=str(self._config.storage_dir))
            self._index = load_index_from_storage(storage_context)
        else:
            self._index = self._build_index()

        return self._index

    def _build_index(self) -> VectorStoreIndex:
        documents = []
        directories = [path for path in self._config.source_paths if path.is_dir()]
        files = [path for path in self._config.source_paths if path.is_file()]

        for directory in directories:
            documents.extend(
                SimpleDirectoryReader(
                    input_dir=str(directory),
                    recursive=True,
                    required_exts=self._config.included_extensions,
                    exclude=EXCLUDED_GLOBS,
                    # default True would silently skip dot-directories like .meta
                    exclude_hidden=False,
                ).load_data()
            )

        if files:
            documents.extend(SimpleDirectoryReader(input_files=[str(path) for path in files]).load_data())

        index = VectorStoreIndex.from_documents(documents)
        self._config.storage_dir.mkdir(parents=True, exist_ok=True)
        index.storage_context.persist(persist_dir=str(self._config.storage_dir))
        return index
