"""Split the fintech glossary into RAG-friendly chunks (no pandas/CSV required).

Sections in fintech.txt are numbered (1. Core Product Concepts, …). Each section
becomes one LlamaIndex Document tagged with a stable chunk_id for retrieval.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from llama_index.core.schema import Document

# Maps section numbers in fintech.txt to the recommended RAG chunk ids.
SECTION_CHUNK_IDS: Dict[int, str] = {
    1: "chunk_001_core_product_concepts",
    2: "chunk_002_transactions_orders_invoices",
    3: "chunk_003_quotes_rates_fees",
    4: "chunk_004_payment_flows_h2h_redirect_iframe",
    5: "chunk_005_card_payments_pci",
    6: "chunk_006_web3_blockchain_wallets",
    7: "chunk_007_transaction_statuses",
    8: "chunk_008_risk_compliance_security",
    9: "chunk_009_api_integrations_webhooks",
    10: "chunk_009_api_integrations_webhooks",
    11: "chunk_010_ambiguous_terms_and_aliases",
    12: "chunk_002_transactions_orders_invoices",
    13: "chunk_010_ambiguous_terms_and_aliases",
}

_SECTION_RE = re.compile(r"^(?P<num>\d+)\.\s+(?P<title>.+)$")


def load_glossary_documents(path: Path, repo_relative: str) -> List[Document]:
    """Parse fintech.txt into one document per numbered section."""
    text = path.read_text(encoding="utf-8", errors="ignore")
    sections = _split_sections(text)
    documents: List[Document] = []
    for number, title, body in sections:
        if not body.strip():
            continue
        chunk_id = SECTION_CHUNK_IDS.get(number, f"chunk_section_{number:03d}")
        header = f"Glossary section {number}: {title}\nchunk_id: {chunk_id}\n\n"
        documents.append(
            Document(
                text=header + body.strip(),
                metadata={
                    "file_path": repo_relative,
                    "file_name": path.name,
                    "glossary_section": number,
                    "glossary_title": title,
                    "chunk_id": chunk_id,
                    "area": "glossary",
                },
            )
        )
    return documents


def _split_sections(text: str) -> List[Tuple[int, str, str]]:
    sections: List[Tuple[int, str, str]] = []
    current_num: Optional[int] = None
    current_title: Optional[str] = None
    current_lines: List[str] = []

    for line in text.splitlines():
        match = _SECTION_RE.match(line.strip())
        if match:
            if current_num is not None and current_title is not None:
                sections.append((current_num, current_title, "\n".join(current_lines)))
            current_num = int(match.group("num"))
            current_title = match.group("title").strip()
            current_lines = []
            continue
        if current_num is not None:
            current_lines.append(line)

    if current_num is not None and current_title is not None:
        sections.append((current_num, current_title, "\n".join(current_lines)))

    return sections
