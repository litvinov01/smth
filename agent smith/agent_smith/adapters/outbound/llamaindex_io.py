"""IO isolation for LlamaIndex — separate from CLI contributor stdout (cli_io.py).

LlamaIndex still uses print() in some paths (e.g. SimpleKVStore load). This module
captures that stream during index/agent work: silent by default, stderr when
--logs-enabled is set.
"""
from __future__ import annotations

import contextlib
import sys
import warnings
from typing import Callable, Generator, Optional

_verbose = False


def set_verbose(enabled: bool) -> None:
    global _verbose
    _verbose = enabled


def verbose_enabled() -> bool:
    return _verbose


class _LlamaIndexStdout:
    """Proxy stdout: swallow LlamaIndex prints unless verbose (then stderr)."""

    def write(self, data: str) -> int:
        if not data:
            return 0
        if _verbose:
            sys.stderr.write(data)
        return len(data)

    def flush(self) -> None:
        if _verbose:
            sys.stderr.flush()

    def isatty(self) -> bool:
        return False


@contextlib.contextmanager
def runtime() -> Generator[None, None, None]:
    """Run LlamaIndex index load / agent work without polluting CLI stdout/stderr."""
    proxy = _LlamaIndexStdout()
    old_showwarning: Optional[Callable] = None

    with contextlib.redirect_stdout(proxy):
        if _verbose:
            yield
        else:
            old_showwarning = warnings.showwarning
            warnings.showwarning = _silent_showwarning
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    yield
            finally:
                if old_showwarning is not None:
                    warnings.showwarning = old_showwarning


def _silent_showwarning(
    message: warnings.WarningMessage | str,
    category: type[Warning],
    filename: str,
    lineno: int,
    file: Optional[object] = None,
    line: Optional[str] = None,
) -> None:
    """Drop third-party warnings; the deprecated package ignores filterwarnings."""
    return
