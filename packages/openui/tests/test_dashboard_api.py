"""The dashboard data route, against a fake Hermes context. Runs without Hermes."""
import contextvars
import importlib.util
import json
import sys
import threading
import time
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BACKEND = "backend-a"
SERVER_DOWN = {"ok": False, "error": "MCP server 'crm' is not connected"}


class FakeCtx:
    def __init__(self, answers=None):
        self.calls, self.answers = [], list(answers or [])
        self.config = {"dashboard_sources": ["crm.pipeline", "crm.other", "ops.health"]}
        self.gate = None

    def get_config(self, key, default=None):
        return self.config.get(key, default)

    def call_mcp(self, server, tool, arguments=None, timeout=30):
        self.calls.append((server, tool, arguments))
        if self.gate is not None:
            self.gate.wait(5)
        answer = self.answers.pop(0) if self.answers else {"ok": True, "result": json.dumps({"rows": []})}
        if isinstance(answer, Exception):
            raise answer
        return answer


@pytest.fixture()
def api(monkeypatch):
    spec = importlib.util.spec_from_file_location("openui_dashboard_api_test", ROOT / "dashboard" / "plugin_api.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    ctx = FakeCtx()
    holder = types.ModuleType(module.HOLDER)
    holder.ctx, holder.backend_id = ctx, lambda: BACKEND
    monkeypatch.setitem(sys.modules, module.HOLDER, holder)
    yield module, ctx
    del sys.modules[spec.name]


def read(module, source="crm.pipeline", args=None, backend=BACKEND):
    return module.data({"source": source, "args": args or {}, "backend_id": backend})


@pytest.mark.parametrize("answer,expected", [
    ({"ok": True, "result": json.dumps({"rows": [1]})}, {"rows": [1]}),
    ({"ok": True, "result": json.dumps([1, 2])}, [1, 2]),
    ({"ok": True, "result": "7"}, 7),
    ({"ok": True, "result": "plain words"}, {"text": "plain words"}),
    ({"ok": True, "result": "ignored", "structuredContent": {"a": 1}}, {"a": 1}),
    ({"ok": True, "result": {"already": "parsed"}}, {"already": "parsed"}),
])
def test_every_result_form_reaches_the_query(api, answer, expected):
    module, ctx = api
    ctx.answers = [answer]
    result = read(module)
    assert result["ok"] and result["data"] == expected and result["fetchedAt"]


def test_truncated_result_is_a_clear_failure(api):
    module, ctx = api
    ctx.answers = [{"ok": True, "result": '{"a"', "truncated": True}]
    assert read(module)["code"] == "too_large"


def test_tool_error_shows_its_reason(api):
    module, ctx = api
    ctx.answers = [{"ok": False, "error": "no such stage"}]
    result = read(module)
    assert result == {"ok": False, "code": "failed", "error": "no such stage"}


def test_another_backends_card_never_reaches_mcp(api):
    module, ctx = api
    assert read(module, backend="backend-b")["code"] == "wrong_backend"
    assert ctx.calls == []


@pytest.mark.parametrize("source", ["crm.delete", "crm", "", None, 7])
def test_unlisted_source_never_reaches_mcp(api, source):
    module, ctx = api
    result = module.data({"source": source, "args": {}, "backend_id": BACKEND})
    assert result["code"] == "not_listed" and "dashboard_sources" in result["error"]
    assert ctx.calls == []


def test_listing_changes_apply_without_a_restart(api):
    module, ctx = api
    assert read(module, "crm.new")["code"] == "not_listed"
    ctx.config["dashboard_sources"].append("crm.new")
    assert read(module, "crm.new")["ok"]


def test_server_outside_the_allowlist_explains_itself_and_is_not_held(api):
    module, ctx = api
    ctx.answers = [PermissionError("no"), {"ok": True, "result": "1"}]
    result = read(module)
    assert result["code"] == "no_access" and "mcp_allowlist" in result["error"]
    assert read(module, "crm.other")["ok"]


@pytest.mark.parametrize("args,code", [
    ("text", "bad_args"),
    ({"a": "x" * 5000}, "bad_args"),
    ({"a": float("nan")}, "bad_args"),
])
def test_bad_arguments_never_reach_mcp(api, args, code):
    module, ctx = api
    assert module.data({"source": "crm.pipeline", "args": args, "backend_id": BACKEND})["code"] == code
    assert ctx.calls == []


def test_empty_filters_are_left_out(api):
    module, ctx = api
    read(module, args={"stage": "", "tags": [], "owner": None, "limit": 0, "open": False, "name": "x"})
    assert ctx.calls[0][2] == {"limit": 0, "open": False, "name": "x"}


def test_lists_and_dates_pass_through(api):
    module, ctx = api
    args = {"tags": ["a", "b"], "range": {"from": "2026-01-01", "to": "2026-02-01"}}
    assert read(module, args=args)["ok"]
    assert ctx.calls[0][2] == args


def test_repeat_reads_share_one_call(api):
    module, ctx = api
    assert read(module)["ok"] and read(module)["ok"]
    assert len(ctx.calls) == 1
    assert read(module, args={"stage": "won"})["ok"]
    assert len(ctx.calls) == 2


def test_concurrent_reads_share_one_flight(api):
    module, ctx = api
    ctx.gate = threading.Event()
    results = []
    workers = [threading.Thread(target=lambda: results.append(read(module))) for _ in range(5)]
    for worker in workers:
        worker.start()
    time.sleep(0.2)
    ctx.gate.set()
    for worker in workers:
        worker.join(5)
    assert len(results) == 5 and all(item["ok"] for item in results)
    assert len(ctx.calls) == 1


def test_a_failure_holds_the_server_without_calling_it_again(api, monkeypatch):
    module, ctx = api
    monkeypatch.setattr(module, "FAILURE_SECONDS", 0)
    ctx.answers = [SERVER_DOWN]
    assert read(module)["code"] == "failed"
    held = read(module, "crm.other")
    assert held["code"] == "held" and 0 < held["retry_after"] <= 20
    assert len(ctx.calls) == 1


def test_a_different_server_is_not_held(api, monkeypatch):
    module, ctx = api
    ctx.answers = [SERVER_DOWN]
    assert read(module)["code"] == "failed"
    assert read(module, "ops.health")["ok"]


def _release_hold(module, server="crm"):
    module._gates[server].until = 0.0


def test_holds_get_longer_until_a_success(api, monkeypatch):
    module, ctx = api
    monkeypatch.setattr(module, "FAILURE_SECONDS", 0)
    ctx.answers = [SERVER_DOWN, SERVER_DOWN, SERVER_DOWN, SERVER_DOWN]
    for index, ceiling in enumerate((20, 120, 300, 300)):
        assert read(module, args={"n": index})["code"] == "failed"
        held = read(module, args={"n": 100 + index})
        assert ceiling - 2 <= held["retry_after"] <= ceiling
        _release_hold(module)
    ctx.answers = [{"ok": True, "result": "1"}]
    assert read(module, args={"n": 200})["ok"]
    gate = module._gates["crm"]
    assert (gate.failures, gate.until) == (0, 0.0)


def test_no_third_failing_call_inside_the_holds(api, monkeypatch):
    """Three failures in a row open Hermes' shared breaker, so the route must never reach that quickly."""
    module, ctx = api
    monkeypatch.setattr(module, "FAILURE_SECONDS", 0)
    ctx.answers = [SERVER_DOWN] * 10
    for index in range(30):
        read(module, args={"n": index})
    assert len(ctx.calls) == 1


def test_only_one_call_at_a_time_after_a_failure(api, monkeypatch):
    module, ctx = api
    gate = module._Gate()
    gate.failures = 1
    module._gates["crm"] = gate
    ctx.gate = threading.Event()
    results = []
    workers = [threading.Thread(target=lambda n=n: results.append(read(module, args={"n": n}))) for n in range(2)]
    for worker in workers:
        worker.start()
    time.sleep(0.25)
    assert len(ctx.calls) == 1
    ctx.gate.set()
    for worker in workers:
        worker.join(5)
    assert len(ctx.calls) == 2


def test_at_most_two_calls_at_a_time(api):
    module, ctx = api
    ctx.gate = threading.Event()
    workers = [threading.Thread(target=read, args=(module, "crm.pipeline", {"n": n})) for n in range(4)]
    for worker in workers:
        worker.start()
    time.sleep(0.25)
    assert len(ctx.calls) == 2
    ctx.gate.set()
    for worker in workers:
        worker.join(5)
    assert len(ctx.calls) == 4


def test_a_slow_call_times_out_and_its_late_answer_is_kept(api, monkeypatch):
    module, ctx = api
    monkeypatch.setattr(module, "DEADLINE", 0.2)
    ctx.gate = threading.Event()
    ctx.answers = [{"ok": True, "result": '{"late": true}'}]
    assert read(module)["code"] == "slow"
    ctx.gate.set()
    time.sleep(0.2)
    result = read(module)
    assert result["ok"] and result["data"] == {"late": True}
    assert len(ctx.calls) == 1


def test_retry_during_a_running_read_joins_it(api, monkeypatch):
    module, ctx = api
    monkeypatch.setattr(module, "DEADLINE", 0.2)
    ctx.gate = threading.Event()
    assert read(module)["code"] == "slow"
    assert read(module)["code"] == "slow"
    assert len(ctx.calls) == 1
    ctx.gate.set()


def test_the_read_runs_in_the_requests_profile(api):
    """The read happens on its own thread, and Hermes keeps the profile in context variables."""
    module, ctx = api
    profile = contextvars.ContextVar("profile", default="none")
    seen = []
    original = ctx.call_mcp
    ctx.call_mcp = lambda *a, **k: (seen.append(profile.get()), original(*a, **k))[1]
    token = profile.set("work")
    try:
        assert read(module)["ok"]
    finally:
        profile.reset(token)
    assert seen == ["work"]


def test_plugin_not_loaded_yet(api, monkeypatch):
    module, _ = api
    monkeypatch.delitem(sys.modules, module.HOLDER)
    assert read(module)["code"] == "not_ready"
