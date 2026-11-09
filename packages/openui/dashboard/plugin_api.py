"""Live data for OpenUI dashboards: reads the MCP tools the user listed in `dashboard_sources`.

Hermes loads this file on its own and doesn't pass it the plugin's context, so `register` leaves that context
in a private module entry. Failures of any kind count toward the circuit breaker Hermes shares with the model's
own MCP calls, so a server that fails is left alone for a while instead of being asked again.
"""
from __future__ import annotations

import contextvars
import json
import math
import sys
import threading
import time
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()

HOLDER = "_hermes_openui_runtime"
CALL_TIMEOUT = 25
DEADLINE = 35  # everything a request waits for; the Desktop client waits 45
CACHE_SECONDS = 60
FAILURE_SECONDS = 15
MAX_KEYS = 64
MAX_ARGS_BYTES = 4096
HOLD_SECONDS = (20, 120, 300)  # after one, two, then three or more failures in a row
_CONFIG = "plugins.entries.hermes-openui"


class _Failure(Exception):
    def __init__(self, code: str, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.code, self.message, self.retry_after = code, message[:300], retry_after


class _Gate:
    def __init__(self):
        self.active, self.failures, self.until = 0, 0, 0.0


_changed = threading.Condition()
_gates: dict[str, _Gate] = {}


def _enter(server: str, deadline: float) -> None:
    with _changed:
        gate = _gates.setdefault(server, _Gate())
        while True:
            wait = gate.until - time.monotonic()
            if wait > 0:
                seconds = math.ceil(wait)
                raise _Failure("held", f"{server} failed recently. Try again in about {seconds} seconds.", seconds)
            if gate.active < (1 if gate.failures else 2):
                gate.active += 1
                return
            left = deadline - time.monotonic()
            if left <= 0:
                raise _Failure("busy", f"{server} is busy. Try again shortly.")
            _changed.wait(left)


def _leave(server: str, outcome: bool | None) -> None:
    """outcome: True for a success, False for a failed call, None when the call never reached the server."""
    with _changed:
        gate = _gates[server]
        gate.active -= 1
        if outcome:
            gate.failures, gate.until = 0, 0.0
        elif outcome is False:
            gate.failures += 1
            gate.until = time.monotonic() + HOLD_SECONDS[min(gate.failures, len(HOLD_SECONDS)) - 1]
        _changed.notify_all()


def _shape(answer: dict):
    """What a Query receives. One rule per result form, so a dashboard can rely on it."""
    if answer.get("truncated"):
        raise _Failure("too_large", "That result is over Hermes' 64 KB limit. Narrow the arguments.")
    if answer.get("structuredContent") is not None:
        return answer["structuredContent"]
    result = answer.get("result")
    if isinstance(result, str):
        try:
            return json.loads(result)
        except ValueError:
            return {"text": result}
    return result


def _call(ctx, source: str, args: dict) -> dict:
    server, tool = source.split(".", 1)
    _enter(server, time.monotonic() + DEADLINE)
    outcome = None
    try:
        try:
            answer = ctx.call_mcp(server, tool, args, timeout=CALL_TIMEOUT)
        except PermissionError:
            raise _Failure("no_access", f"Add {server} to {_CONFIG}.mcp_allowlist in config.yaml.") from None
        except Exception as error:  # noqa: BLE001 - shown to the person looking at the dashboard
            outcome = False
            raise _Failure("failed", str(error) or f"Could not read {source}.") from None
        if not answer.get("ok"):
            outcome = False
            raise _Failure("failed", str(answer.get("error") or f"Could not read {source}."))
        outcome = True
        return {"data": _shape(answer), "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    finally:
        _leave(server, outcome)


class _Flight(threading.Event):
    entry: tuple[float, bool, object] | None = None


_lock = threading.Lock()
_cache: dict[str, tuple[float, bool, object]] = {}
_flights: dict[str, _Flight] = {}


def _store(key: str, entry: tuple[float, bool, object]) -> None:
    with _lock:
        if key not in _cache and len(_cache) >= MAX_KEYS:
            for old in sorted(_cache, key=lambda name: _cache[name][0])[: len(_cache) - MAX_KEYS + 1]:
                _cache.pop(old, None)
        _cache[key] = entry
        flight = _flights.pop(key, None)
    if flight:
        flight.entry = entry
        flight.set()


def _settled(entry: tuple[float, bool, object]) -> dict:
    if entry[1]:
        return entry[2]
    raise entry[2]


def _cached(key: str, fetch) -> dict:
    """One read per key per cache window, however many cards ask. A late answer still serves the next caller."""
    with _lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < (CACHE_SECONDS if hit[1] else FAILURE_SECONDS):
            return _settled(hit)
        flight = _flights.get(key)
        if flight is None:
            flight = _flights[key] = _Flight()

            def work():
                try:
                    entry = (time.time(), True, fetch())
                except _Failure as failure:
                    entry = (time.time(), False, failure)
                except Exception as error:  # noqa: BLE001 - remembered briefly, then retried
                    entry = (time.time(), False, _Failure("failed", str(error) or "Could not read that source."))
                _store(key, entry)

            # The new thread needs this request's profile, which lives in context variables.
            threading.Thread(target=contextvars.copy_context().run, args=(work,), name="openui-dashboard", daemon=True).start()
    if not flight.wait(DEADLINE):
        raise _Failure("slow", "The server is taking too long. Try again shortly.")
    return _settled(flight.entry)


def _checked_args(raw) -> dict:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise _Failure("bad_args", "Arguments must be an object.")
    try:
        encoded = json.dumps(raw, allow_nan=False)
    except (TypeError, ValueError):
        raise _Failure("bad_args", "Arguments must be plain JSON.") from None
    if len(encoded.encode("utf-8")) > MAX_ARGS_BYTES:
        raise _Failure("bad_args", "Arguments are over the 4 KB limit.")
    # An empty filter means "no filter": let the tool use its own default.
    return {key: value for key, value in raw.items() if value not in (None, "", [])}


def _read(body: dict) -> dict:
    holder = sys.modules.get(HOLDER)
    if holder is None:
        raise _Failure("not_ready", "Hermes hasn't finished loading this plugin.")
    if body.get("backend_id") != holder.backend_id():
        raise _Failure("wrong_backend", "This dashboard belongs to another Hermes profile or connection.")
    listed = holder.ctx.get_config("dashboard_sources", [])
    source = body.get("source")
    if not isinstance(source, str) or "." not in source or not isinstance(listed, list) or source not in listed:
        raise _Failure("not_listed", f"{source} isn't in {_CONFIG}.settings.dashboard_sources in config.yaml.")
    args = _checked_args(body.get("args"))
    ctx = holder.ctx
    return _cached(json.dumps([source, args], sort_keys=True), lambda: _call(ctx, source, args))


@router.post("/data")
def data(body: dict | None = None):
    try:
        return {"ok": True, **_read(body or {})}
    except _Failure as failure:
        out = {"ok": False, "code": failure.code, "error": failure.message}
        if failure.retry_after is not None:
            out["retry_after"] = failure.retry_after
        return out
