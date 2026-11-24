"""A2UI Express to the JSONL that a2ui_present already validates and draws: A2UI 1.0 by default, v0.9 on request.

The official a2ui-agent-sdk does the compiling against this plugin's own catalog (catalogs/hermes-v1_0.json, or hermes-v0_9.json).
The SDK is imported inside the functions, never at module level: register() must stay fast and work offline.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path

CATALOG_FILES = {
    "1.0": Path(__file__).resolve().parent / "catalogs" / "hermes-v1_0.json",
    "v0.9": Path(__file__).resolve().parent / "catalogs" / "hermes-v0_9.json",
}
CATALOG_FILE = CATALOG_FILES["v0.9"]
MAX_EXPRESS_BYTES = 256 * 1024
MAX_MESSAGE_CHARS = 300


class InvalidExpress(ValueError):
    """The Express text is wrong; the message is the SDK's, for the model to correct from."""


class ExpressUnavailable(RuntimeError):
    """The SDK cannot be imported or its catalog cannot be built here."""


_lock = threading.Lock()
_compilers: dict = {}


def _build_compiler(version: str):
    try:
        from a2ui.core.catalog.catalog import Catalog
        from a2ui.inference_formats.express import ExpressCompiler

        catalog = Catalog.from_json(json.loads(CATALOG_FILES[version].read_text(encoding="utf-8")), protocol_version=version)
        return ExpressCompiler([catalog], version=version)
    except Exception as exc:  # noqa: BLE001 - whatever stops the SDK from loading here means "unavailable", never a failed turn
        raise ExpressUnavailable(f"{type(exc).__name__}: {exc}"[:MAX_MESSAGE_CHARS]) from exc


def compile_express(text: str, version: str = "1.0") -> str:
    """Compile Express to JSONL (A2UI 1.0 unless version is "v0.9"), one message per line. Raises InvalidExpress or ExpressUnavailable."""
    with _lock:
        if version not in _compilers:
            _compilers[version] = _build_compiler(version)
        compiler = _compilers[version]
    try:
        with _lock:
            messages = compiler.compile(text)
        return "\n".join(
            json.dumps(message.model_dump(mode="json", by_alias=True, exclude_none=True), ensure_ascii=False)
            for message in messages
        )
    except Exception as exc:  # noqa: BLE001 - the compiler loaded, so what fails here is the text: ExpressCompilerError, but also the
        # lexer's plain SyntaxError (an unknown character such as a single quote or a code fence), which is not one of them
        raise InvalidExpress(str(exc)[:MAX_MESSAGE_CHARS]) from exc
