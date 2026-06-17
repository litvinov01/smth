"""System diagnostics logging — separate from CLI user-facing IO (see adapters/inbound/cli_io.py).

When logging is disabled (default), third-party noise (LlamaIndex, urllib3, pydantic) is
suppressed and agent_smith loggers stay quiet. Pass --logs-enabled to surface agent
diagnostics on stderr.
"""
from __future__ import annotations

import logging
import sys
import warnings
from typing import List

LOGGER_NAME = "agent_smith"

_LOG_FORMAT = "%(name)s | %(levelname)s | %(message)s"
_QUIET_LOGGER_PREFIXES = (
    "llama_index",
    "httpx",
    "httpcore",
    "openai",
    "urllib3",
    "deprecated",
)


def configure(enabled: bool) -> None:
    level = logging.INFO if enabled else logging.WARNING

    logging.basicConfig(level=level, format=_LOG_FORMAT, stream=sys.stderr, force=True)
    logging.getLogger().setLevel(level)
    logging.getLogger(LOGGER_NAME).setLevel(level)

    for prefix in _QUIET_LOGGER_PREFIXES:
        logging.getLogger(prefix).setLevel(logging.WARNING if not enabled else logging.INFO)

    if enabled:
        logging.getLogger(LOGGER_NAME).info("agent logging enabled")
    else:
        _suppress_third_party_warnings()


def configure_from_argv(argv: List[str]) -> bool:
    enabled = "--logs-enabled" in argv
    configure(enabled)
    return enabled


def _suppress_third_party_warnings() -> None:
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    warnings.filterwarnings("ignore", category=DeprecationWarning, module=r"llama_index.*")
    warnings.filterwarnings("ignore", category=DeprecationWarning, module=r"deprecated.*")
    warnings.filterwarnings("ignore", message=r".*validate_default.*")
    warnings.filterwarnings("ignore", message=r".*OpenSSL.*")
    try:
        from urllib3.exceptions import NotOpenSSLWarning

        warnings.filterwarnings("ignore", category=NotOpenSSLWarning)
    except ImportError:
        pass

    try:
        from pydantic.warnings import PydanticDeprecatedSince20

        warnings.filterwarnings("ignore", category=PydanticDeprecatedSince20)
    except ImportError:
        pass

    # LlamaIndex uses this for pydantic Field noise on some versions.
    warnings.filterwarnings(
        "ignore",
        message=r".*UnsupportedFieldAttributeWarning.*",
        category=UserWarning,
    )
