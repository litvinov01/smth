from __future__ import annotations

import json
import logging
import shutil
from pathlib import Path
from typing import Dict, List, Optional

from llama_index.core import (
    Settings,
    SimpleDirectoryReader,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.core.agent import FunctionCallingAgent
from llama_index.core.base.response.schema import Response
from llama_index.core.schema import Document
from llama_index.core.tools import FunctionTool, QueryEngineTool
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

from ...config import EXCLUDED_GLOBS, AgentConfig
from ...domain.models import Answer, CodeEcho, SourceChunk
from ...domain.ports import CodeNavigatorPort
from .glossary_loader import load_glossary_documents
from .llamaindex_io import runtime as llamaindex_runtime

log = logging.getLogger("agent_smith.knowledge_base")

SNIPPET_MAX_CHARS = 240
# LlamaIndex defaults to 5 tool rounds; with area search + code tools we need more
# headroom so the agent can still synthesize a final answer.
MAX_FUNCTION_CALLS = 10
# Filename inside the storage dir recording which area indexes were built.
MANIFEST_NAME = "areas.json"
# Prefix marking a tool as an area retriever, so we can map tool calls -> areas.
AREA_TOOL_PREFIX = "search_"


class LlamaIndexKnowledgeBase:
    """Outbound adapter implementing KnowledgeBasePort.

    The corpus is split into one persisted vector index per architectural area;
    a FunctionCallingAgent is given one retrieval tool per area plus the
    code-navigation tools, so it routes questions to the right area(s) and can
    point contributors at concrete files.
    """

    def __init__(
        self,
        config: AgentConfig,
        navigator: CodeNavigatorPort,
        system_prompt: str,
    ) -> None:
        self._config = config
        self._navigator = navigator
        self._system_prompt = system_prompt
        self._indexes: Optional[Dict[str, VectorStoreIndex]] = None
        self._area_tools: Optional[Dict[str, QueryEngineTool]] = None
        self._code_tool_list: Optional[List[FunctionTool]] = None
        self._pending_echoes: List[CodeEcho] = []

        Settings.llm = OpenAI(model=config.llm_model)
        # Small batches keep each embedding request under low TPM rate limits;
        # LlamaIndex's built-in retry/backoff handles the pacing between them.
        Settings.embed_model = OpenAIEmbedding(
            model=config.embedding_model,
            embed_batch_size=config.embed_batch_size,
        )
        Settings.chunk_size = config.chunk_size

    def ask(self, question: str, areas: Optional[List[str]] = None) -> Answer:
        with llamaindex_runtime():
            return self._ask(question, areas)

    def _ask(self, question: str, areas: Optional[List[str]] = None) -> Answer:
        self._pending_echoes = []
        area_tools = self._get_area_tools()

        # Constrain to the requested/detected areas when given (autodetect path);
        # otherwise expose every area and let the agent route.
        if areas:
            selected = [name for name in areas if name in area_tools]
        else:
            selected = []
        if not selected:
            selected = list(area_tools)

        log.info("building agent for areas: %s", selected)
        agent = self._build_agent(selected)
        response = agent.chat(question)
        log.info(
            "agent finished (echoes=%d, source_nodes=%d)",
            len(self._pending_echoes),
            len(getattr(response, "source_nodes", []) or []),
        )

        # When areas were pre-selected, report them (the autodetected domain);
        # otherwise derive from the tools the agent actually called.
        reported = selected if areas else self._collect_areas(response)
        return Answer(
            text=self._response_text(response),
            sources=self._collect_sources(response),
            areas=reported,
            echoes=list(self._pending_echoes),
        )

    def rebuild(self) -> None:
        with llamaindex_runtime():
            if self._config.storage_dir.exists():
                shutil.rmtree(self._config.storage_dir)
            self._indexes = self._build_indexes()
            self._area_tools = None

    # --- agent assembly ---------------------------------------------------

    def _build_agent(self, area_names: List[str]) -> FunctionCallingAgent:
        area_tools = self._get_area_tools()
        tools: List = [area_tools[name] for name in area_names if name in area_tools]
        tools.extend(self._code_tools())
        verbose = log.isEnabledFor(logging.INFO)
        return FunctionCallingAgent.from_tools(
            tools=tools,
            llm=Settings.llm,
            system_prompt=self._system_prompt,
            verbose=verbose,
            max_function_calls=MAX_FUNCTION_CALLS,
        )

    def _get_area_tools(self) -> Dict[str, QueryEngineTool]:
        if self._area_tools is not None:
            return self._area_tools

        tools: Dict[str, QueryEngineTool] = {}
        for area in self._config.areas:
            index = self._get_indexes().get(area.name)
            if index is None:
                continue
            query_engine = index.as_query_engine(similarity_top_k=self._config.similarity_top_k)
            tools[area.name] = QueryEngineTool.from_defaults(
                query_engine=query_engine,
                name=f"{AREA_TOOL_PREFIX}{area.name}",
                description=area.description,
            )
        self._area_tools = tools
        return self._area_tools

    def _code_tools(self) -> List[FunctionTool]:
        if self._code_tool_list is not None:
            return self._code_tool_list

        navigator = self._navigator
        kb = self
        area_names = ", ".join(self._config.area_names)
        topics = ", ".join(sorted(self._config.topics)) or "(none curated)"

        def find_in_repo(pattern: str, area: Optional[str] = None) -> str:
            """Search the indexed repository for a regex/substring; returns file:line matches."""
            matches = navigator.find(pattern, area=area)
            if not matches:
                return "no matches"
            return "\n".join(f"{ref.file_path}:{ref.lines}: {ref.snippet}" for ref in matches)

        def read_file(path: str, start: Optional[int] = None, end: Optional[int] = None) -> str:
            """Read a repo-relative file (optionally a 1-indexed line range) to quote exact code."""
            return navigator.read_file(path, start=start, end=end)

        def list_area_files(area: str) -> str:
            files = navigator.list_area_files(area)
            return "\n".join(files) if files else f"no files for area '{area}'"

        def key_files_for(topic: str) -> str:
            files = navigator.key_files_for(topic)
            return "\n".join(files) if files else f"no key files matched '{topic}'"

        def echo_code(path: str, start: Optional[int] = None, end: Optional[int] = None) -> str:
            echo = navigator.echo_code(path, start=start, end=end)
            kb._pending_echoes.append(echo)
            log.info("echo_code %s lines %s-%s branch %s", path, start, end, echo.branch)
            if echo.content.startswith("error:"):
                return echo.content
            return (
                f"Echoed {echo.file_path} lines {echo.start}-{echo.end} "
                f"(branch {echo.branch}) to the contributor's terminal."
            )

        self._code_tool_list = [
            FunctionTool.from_defaults(fn=find_in_repo, name="find_in_repo"),
            FunctionTool.from_defaults(fn=read_file, name="read_file"),
            FunctionTool.from_defaults(
                fn=echo_code,
                name="echo_code",
                description=(
                    "Print a numbered code slice from the current git branch to the contributor's "
                    "terminal. Use when showing concrete implementation — prefer over read_file when "
                    "the user should see the code on screen. Args: repo-relative path, optional "
                    "1-indexed start/end line numbers."
                ),
            ),
            FunctionTool.from_defaults(
                fn=list_area_files,
                name="list_area_files",
                description=f"List the indexed files that belong to an area. Areas: {area_names}.",
            ),
            FunctionTool.from_defaults(
                fn=key_files_for,
                name="key_files_for",
                description=(
                    "Highlight the files most important to understanding a problem/topic. "
                    f"Curated topics: {topics}. Unknown topics fall back to path matching."
                ),
            ),
        ]
        return self._code_tool_list

    # --- response mapping -------------------------------------------------

    def _response_text(self, response) -> str:
        """Extract user-facing text; LlamaIndex may leave response=None after tool-only steps."""
        raw = getattr(response, "response", None)
        if isinstance(raw, str) and raw.strip() and raw.strip().lower() != "none":
            return raw.strip()

        try:
            text = str(response)
            if text.strip() and text.strip().lower() != "none":
                return text.strip()
        except TypeError:
            pass

        # Last resort: surface the most recent tool output (e.g. a retrieval answer).
        for tool_output in reversed(getattr(response, "sources", []) or []):
            snippet = self._tool_output_text(tool_output)
            if snippet:
                return snippet

        return (
            "I could not produce a final answer from the tools. "
            "Try rephrasing, or use --area to scope the question to one part of the repo."
        )

    def _tool_output_text(self, tool_output) -> Optional[str]:
        content = getattr(tool_output, "content", None)
        if content is None:
            raw = getattr(tool_output, "raw_output", None)
            content = getattr(raw, "content", raw) if raw is not None else None
        if isinstance(content, Response):
            text = content.response
            return text.strip() if isinstance(text, str) and text.strip() else None
        if isinstance(content, str) and content.strip():
            return content.strip()
        return None

    def _collect_sources(self, response) -> List[SourceChunk]:
        sources: List[SourceChunk] = []
        for node in getattr(response, "source_nodes", []) or []:
            file_path = node.metadata.get("file_path") or node.metadata.get("file_name") or "<unknown>"
            snippet = " ".join(node.get_content().split())[:SNIPPET_MAX_CHARS]
            sources.append(SourceChunk(file_path=file_path, snippet=snippet, score=node.score))
        return sources

    def _collect_areas(self, response) -> List[str]:
        areas: List[str] = []
        for tool_output in getattr(response, "sources", []) or []:
            name = getattr(tool_output, "tool_name", "") or ""
            if name.startswith(AREA_TOOL_PREFIX):
                area = name[len(AREA_TOOL_PREFIX) :]
                if area not in areas:
                    areas.append(area)
        return areas

    # --- indexing ---------------------------------------------------------

    def _get_indexes(self) -> Dict[str, VectorStoreIndex]:
        if self._indexes is not None:
            return self._indexes

        manifest = self._config.storage_dir / MANIFEST_NAME
        if manifest.exists():
            built = json.loads(manifest.read_text(encoding="utf-8"))
            indexes: Dict[str, VectorStoreIndex] = {}
            for area_name in built:
                area_dir = self._config.storage_dir_for(area_name)
                storage_context = StorageContext.from_defaults(persist_dir=str(area_dir))
                indexes[area_name] = load_index_from_storage(storage_context)
            self._indexes = indexes
        else:
            self._indexes = self._build_indexes()

        return self._indexes

    def _build_indexes(self) -> Dict[str, VectorStoreIndex]:
        grouped = self._load_documents_by_area()

        self._config.storage_dir.mkdir(parents=True, exist_ok=True)
        indexes: Dict[str, VectorStoreIndex] = {}
        for area_name, documents in grouped.items():
            if not documents:
                continue
            index = VectorStoreIndex.from_documents(documents)
            index.storage_context.persist(persist_dir=str(self._config.storage_dir_for(area_name)))
            indexes[area_name] = index

        manifest = self._config.storage_dir / MANIFEST_NAME
        manifest.write_text(json.dumps(sorted(indexes)), encoding="utf-8")
        return indexes

    def _load_documents_by_area(self) -> Dict[str, List[Document]]:
        documents: List[Document] = []
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

        expanded: List[Document] = []
        for document in documents:
            file_path = document.metadata.get("file_path") or document.metadata.get("file_name") or ""
            normalized = file_path.replace("\\", "/")
            if normalized.endswith("/glossary/fintech.txt") or normalized.endswith("glossary/fintech.txt"):
                path = Path(file_path)
                rel = self._config.relative_path(path)
                chunks = load_glossary_documents(path, rel)
                log.info("expanded %s into %d section chunks", rel, len(chunks))
                expanded.extend(chunks)
            else:
                expanded.append(document)

        # Files matching no area fall back to the last (catch-all docs) area so
        # nothing silently drops out of the index.
        fallback = self._config.area_names[-1]
        grouped: Dict[str, List[Document]] = {area.name: [] for area in self._config.areas}
        for document in expanded:
            file_path = document.metadata.get("file_path") or document.metadata.get("file_name") or ""
            preset_area = document.metadata.get("area")
            area = preset_area or self._classify(file_path) or fallback
            document.metadata["area"] = area
            grouped[area].append(document)

        return grouped

    def _classify(self, file_path: str) -> Optional[str]:
        return self._config.area_for_path(Path(file_path))
