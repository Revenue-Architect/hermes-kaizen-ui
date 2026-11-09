"""Delivery shared by the A2UI and OpenUI plugins. Copied into each package by scripts/sync-shared.mjs.

A surface is drawn by the plugin's Desktop half from the tool call that produced a `MEDIA:` file. The
file is a readable copy with the payload embedded, so a client that can't draw the surface still gets
something useful and a chat that has lost the tool's arguments can still redraw it.
"""
from __future__ import annotations

import base64
import hashlib
import html
import json
import re
import threading
import time
import uuid
from collections import OrderedDict
from pathlib import Path

# The agent platform hooks receive: "desktop" for Desktop and the Webapp, "local" for a local Desktop
# session on older builds. The Android app reports "gui" and gets the plain text. A chat that reaches a
# drawing client under another label (some Bot Chat turns arrive as "tui" or "cli") can be added with
# the plugin's `drawing_platforms` setting.
DRAWING_PLATFORMS = frozenset({"desktop", "local"})
MAX_SURFACE_FILES = 500
PENDING_TTL_SECONDS = 30 * 60
MAX_TRACKED_SESSIONS = 500
MAX_SURFACE_FOLDER_BYTES = 2 * 1024 * 1024 * 1024
MAX_IMAGE_BYTES = 5 * 1024 * 1024
# Base64 makes this about 13.4 MB, under the 16 MB Hermes reads back as a data URL.
MAX_VIEW_IMAGE_BYTES = 10 * 1024 * 1024
# What Hermes reads back as a data URL, for the whole saved file.
MAX_SAVED_FILE_BYTES = 16 * 1024 * 1024
# Hermes keeps only the first transform_llm_output result, so both plugins queue in one place and
# whichever hook runs first delivers every forgotten surface.
SHARED_QUEUE = "hermes-surface-delivery"
_FENCE = re.compile(r"^\s*(```|~~~)")
_MEDIA_LINE = re.compile(r"^\s*MEDIA:\s*(.+?)\s*$")
# The same test the renderer's image policy applies to a local path.
_LOCAL_IMAGE = re.compile(
    r"^(?:MEDIA:\s*)?((?:/(?!/)|~[/\\]|[A-Za-z]:[\\/])[^\x00-\x1f]*\.(?:png|jpe?g|webp|gif|bmp|avif|svg))$",
    re.IGNORECASE,
)
_IMAGE_HELP = "Use the full path of a PNG, JPEG, GIF or WebP file, or an https link."


def _platform_name(platform: object) -> str:
    return str(platform or "").strip().lower()


def local_image_path(value: object) -> str | None:
    """The path when this whole string names a local image, as the renderer will look it up."""
    if not isinstance(value, str):
        return None
    found = _LOCAL_IMAGE.match(value.strip())
    return found.group(1) if found else None


def _image_type(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _image_problem(code: str, error: str, fix: str = _IMAGE_HELP) -> dict:
    return {"ok": False, "code": code, "error": error, "fix": fix}


def read_images(paths) -> tuple[list[tuple[str, str, str]], dict | None]:
    """(path, mime, base64) for each local image a view names, or the first problem as a tool result."""
    images: list[tuple[str, str, str]] = []
    total = 0
    for name in dict.fromkeys(paths):
        not_found = _image_problem("image_not_found", f"Image not found: {name}",
                                   f"{_IMAGE_HELP} If this is ordinary text, reword it so it isn't only a file path.")
        too_large = _image_problem("image_too_large", f"Image over the {MAX_IMAGE_BYTES // 1048576} MB limit: {name}",
                                   "Use a smaller copy, or an https link.")
        try:
            target = Path(name).expanduser()
            if not target.is_file():
                return [], not_found
            if target.stat().st_size > MAX_IMAGE_BYTES:
                return [], too_large
            data = target.read_bytes()
        except (OSError, RuntimeError):
            return [], not_found
        if len(data) > MAX_IMAGE_BYTES:
            return [], too_large
        mime = _image_type(data)
        if mime is None:
            return [], _image_problem("image_unsupported", f"Not a PNG, JPEG, GIF or WebP image: {name}")
        total += len(data)
        if total > MAX_VIEW_IMAGE_BYTES:
            return [], _image_problem("images_too_large", f"The images in this view are over {MAX_VIEW_IMAGE_BYTES // 1048576} MB in total",
                                      "Use fewer or smaller images, or https links.")
        images.append((name, mime, base64.b64encode(data).decode("ascii")))
    return images, None


def _escape_markdown(text: str) -> str:
    return re.sub(r"([\\`*_{}\[\]#+\-.!|~])", r"\\\1", html.escape(text, quote=False))


def _delivered_paths(response: str) -> set[str]:
    """Paths on a complete MEDIA line outside code fences; merely naming a file doesn't deliver it."""
    delivered, fenced = set(), False
    for line in response.splitlines():
        if _FENCE.match(line):
            fenced = not fenced
            continue
        found = None if fenced else _MEDIA_LINE.match(line)
        if found:
            delivered.add(found.group(1))
    return delivered


def _remove(path: Path) -> bool:
    """True only for the caller that actually removed it."""
    try:
        path.unlink()
        return True
    except OSError:
        return False


class _SavedFileTooLarge(Exception):
    pass


class SurfaceRuntime:
    def __init__(self, plugin_id: str, data_dir, listed_platforms=None):
        self.plugin_id = plugin_id
        self._data_dir = data_dir  # callable: data folder for a plugin-storage name
        self._listed_platforms = listed_platforms  # callable: platforms the user added in settings
        self._lock = threading.Lock()
        self._platforms: OrderedDict[str, str] = OrderedDict()

    def is_drawing(self, platform: object) -> bool:
        name = _platform_name(platform)
        if name in DRAWING_PLATFORMS:
            return True
        return bool(name) and self._listed_platforms is not None and name in map(_platform_name, self._listed_platforms())

    def _pending_root(self) -> Path:
        return Path(self._data_dir(SHARED_QUEUE)) / "pending"

    def _pending_dir(self, session_id: str) -> Path:
        return self._pending_root() / hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:32]

    def _take_pending(self, session_id: str) -> list[dict]:
        folder = self._pending_dir(session_id)
        taken = []
        for item in sorted(folder.glob("*.json")) if folder.is_dir() else []:
            try:
                entry = json.loads(item.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if _remove(item):
                taken.append(entry)
        return taken

    def _expire_pending(self) -> None:
        cutoff = time.time() - PENDING_TTL_SECONDS
        root = self._pending_root()
        for item in root.glob("*/*.json") if root.is_dir() else []:
            try:
                if item.stat().st_mtime < cutoff:
                    _remove(item)
            except OSError:
                continue

    def _queue(self, session_id: str, path: Path) -> None:
        try:
            folder = self._pending_dir(session_id)
            folder.mkdir(parents=True, exist_ok=True)
            temporary = folder / f"{uuid.uuid4().hex}.tmp"
            temporary.write_text(json.dumps({"at": time.time(), "path": str(path)}), encoding="utf-8")
            temporary.replace(temporary.with_suffix(".json"))
            self._expire_pending()
        except OSError:
            return  # the queue is only the safety net for a forgotten media line

    def on_turn_start(self, session_id: str = "", platform: str = "", **_) -> None:
        """pre_llm_call: remember this session's platform, since tools aren't told it."""
        if not session_id:
            return
        with self._lock:
            self._platforms[session_id] = str(platform or "")
            self._platforms.move_to_end(session_id)
            while len(self._platforms) > MAX_TRACKED_SESSIONS:
                self._platforms.popitem(last=False)
        try:
            self._take_pending(session_id)  # anything left belongs to a turn that was interrupted
        except OSError:
            pass

    def draws_here(self, session_id: str) -> bool:
        with self._lock:
            platform = self._platforms.get(session_id)
        return self.is_drawing(platform)

    def _prune(self, folder: Path) -> None:
        dated = []
        for item in folder.glob("*.md"):
            try:
                info = item.stat()
                dated.append((info.st_mtime, info.st_size, item))
            except OSError:
                continue
        dated.sort(key=lambda entry: entry[0], reverse=True)
        total = 0
        for position, (_, size, stale) in enumerate(dated):
            total += size
            if position and (position >= MAX_SURFACE_FILES or total > MAX_SURFACE_FOLDER_BYTES):
                _remove(stale)

    def _write(self, payload: str, fallback_text: str, images=()) -> Path:
        folder = Path(self._data_dir(self.plugin_id)) / "surfaces"
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{uuid.uuid4().hex}.md"
        encoded = base64.b64encode(payload.encode("utf-8")).decode("ascii")
        embedded = [
            f"<!-- {self.plugin_id}:image {base64.urlsafe_b64encode(name.encode('utf-8')).decode('ascii')} {mime} {data} -->"
            for name, mime, data in images
        ]
        body = "\n".join([
            "> This is an interactive view. If you see this file instead, turn on the plugin's Desktop half "
            "in Capabilities > Plugins, or open the chat in Hermes Desktop.",
            "",
            _escape_markdown(fallback_text),
            "",
            *embedded,
            f"<!-- {self.plugin_id}:payload {encoded} -->",
            "",
        ]).encode("utf-8")
        if len(body) > MAX_SAVED_FILE_BYTES:
            raise _SavedFileTooLarge
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(body)
        temporary.replace(path)
        self._prune(folder)
        return path

    def deliver(self, session_id: str, payload: str, fallback_text: str, image_paths=(), extra=None) -> str:
        """The tool result for a payload that has passed validation."""
        if not self.draws_here(session_id):
            return json.dumps({"ok": True, "text": fallback_text,
                               "note": "This client can't draw interactive views. Reply with this text."})
        images, problem = read_images(image_paths)
        if problem:
            return json.dumps(problem)
        try:
            path = self._write(payload, fallback_text, images)
        except _SavedFileTooLarge:
            return json.dumps(_image_problem("view_too_large", "This view and its images are too large to save",
                                             "Use fewer or smaller images, or https links."))
        except OSError as problem:
            return json.dumps({"ok": False, "code": "write_failed", "error": f"Could not save the view: {problem.strerror}",
                               "fix": "Reply with the plain-text version instead."})
        self._queue(session_id, path)
        return json.dumps({"ok": True, "media": f"MEDIA:{path}", **(extra or {}),
                           "note": "Write one short sentence, then this media line on its own line."})

    def ensure_media_lines(self, response_text: str = "", session_id: str = "", platform: str = "", **_):
        """transform_llm_output: a surface the model forgot to deliver still appears."""
        try:
            pending = self._take_pending(session_id)
        except OSError:
            return None
        if not pending or not self.is_drawing(platform) or not isinstance(response_text, str):
            return None
        cutoff = time.time() - PENDING_TTL_SECONDS
        delivered = _delivered_paths(response_text)
        missing = [entry["path"] for entry in pending if entry.get("at", 0) >= cutoff and entry.get("path") not in delivered]
        if not missing:
            return None
        lines = "\n".join(f"MEDIA:{path}" for path in missing)
        return f"{response_text.rstrip()}\n\n{lines}"
