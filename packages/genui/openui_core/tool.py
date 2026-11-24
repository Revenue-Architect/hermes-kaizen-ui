"""The openui_present tool."""
from __future__ import annotations

import json
import os
import sys
import types
import uuid
from pathlib import Path

from .check import check, image_values, is_dashboard
from ..host import PLUGIN_ID, dashboard_sources, runtime
from ..surface_runtime import local_image_path

HOLDER = "_hermes_genui_runtime"

SCHEMA = {
    "name": "openui_present",
    "description": (
        "Draw an interactive OpenUI view in the Hermes chat: dashboards, charts, tables, cards, forms and galleries. "
        "Use it when a visual or a form serves better than prose; short answers stay prose. "
        "Load the hermes-genui:openui skill first for the language and component catalog."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "program": {"type": "string", "description": "A complete OpenUI Lang program starting with root = Stack([...])."},
            "fallback_text": {"type": "string", "description": "The same content as plain text, for clients that can't draw it."},
        },
        "required": ["program", "fallback_text"],
    },
}


def bind(ctx) -> None:
    """Leave the plugin context where dashboard/plugin_api.py can find it."""
    holder = types.ModuleType(HOLDER)
    holder.ctx, holder.backend_id = ctx, backend_id
    sys.modules[HOLDER] = holder


def backend_id() -> str:
    """Stable for one Hermes profile, so a dashboard can tell it is talking to the backend it came from."""
    path = Path(runtime._data_dir(PLUGIN_ID)) / "backend-id"
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        pass
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
    temporary.write_text(uuid.uuid4().hex, encoding="utf-8")
    try:
        os.link(temporary, path)  # the first writer wins
    except OSError:
        if not path.exists():
            temporary.replace(path)
    temporary.unlink(missing_ok=True)
    return path.read_text(encoding="utf-8").strip()


def present(args: dict, **kwargs) -> str:
    program, fallback = args.get("program"), args.get("fallback_text")
    if not isinstance(fallback, str) or not fallback.strip():
        return json.dumps({"ok": False, "code": "missing_fallback", "error": "fallback_text is required",
                           "fix": "Pass the same content as plain text."})
    checked = check(program, dashboard_sources())
    if not checked["ok"]:
        return json.dumps({"ok": False, "code": "invalid_openui", "error": checked["error"],
                           "fix": checked.get("fix", "Correct the program using the hermes-genui:openui skill and call openui_present again.")})
    session = str(kwargs.get("session_id") or "")
    if is_dashboard(program):
        return runtime.deliver(session, program, fallback, extra={"backend_id": backend_id()})
    images = [path for path in map(local_image_path, image_values(program)) if path]
    return runtime.deliver(session, program, fallback, image_paths=images)

