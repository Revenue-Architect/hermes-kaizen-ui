"""The Python validator must reach the browser validator's verdict on real fixtures and on broken variants."""
import copy
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("a2ui_validate", ROOT / "a2ui_core" / "validate.py")
validate_module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = validate_module
spec.loader.exec_module(validate_module)


def fixtures():
    folder = ROOT / "fixtures" / "mobile"
    return sorted(path for path in folder.rglob("*.jsonl"))


def dump(messages):
    return "\n".join(json.dumps(message) for message in messages)


def components_of(messages):
    for message in messages:
        if "updateComponents" in message:
            return message["updateComponents"]["components"]
    raise LookupError


def variants(messages):
    """Each returns a broken copy; anything that doesn't apply to a fixture is skipped."""

    def drop_root(items):
        components_of(items)[:] = [row for row in components_of(items) if row.get("id") != "root"]

    def unknown_type(items):
        components_of(items)[0]["component"] = "NotAComponent"

    def duplicate_id(items):
        components_of(items).append(copy.deepcopy(components_of(items)[0]))

    def wrong_catalog(items):
        items[0]["createSurface"]["catalogId"] = "https://example.invalid/catalog.json"

    def wrong_version(items):
        items[0]["version"] = "v0.8"

    def extra_field(items):
        components_of(items)[0]["notAField"] = 1

    def forbidden_key(items):
        components_of(items)[0]["__proto__"] = {}

    def function_call(items):
        components_of(items)[0]["call"] = "x"

    def orphan(items):
        components_of(items).append({"id": "orphan", "component": "Text", "text": "lost"})

    def missing_create(items):
        items.pop(0)

    def bad_ref(items):
        for row in components_of(items):
            if isinstance(row.get("children"), list) and row["children"]:
                row["children"][0] = "missing-child"
                return
        raise LookupError

    def cycle(items):
        for row in components_of(items):
            if row.get("id") == "root" and isinstance(row.get("children"), list):
                row["children"].append("root")
                return
        raise LookupError

    for change in (drop_root, unknown_type, duplicate_id, wrong_catalog, wrong_version, extra_field, forbidden_key,
                   function_call, orphan, missing_create, bad_ref, cycle):
        copied = copy.deepcopy(messages)
        try:
            change(copied)
        except (LookupError, KeyError, TypeError):
            continue
        yield change.__name__, dump(copied)


def with_component(messages, kind):
    """A copy of the messages and that copy's first component of this kind, or None."""
    copied = copy.deepcopy(messages)
    for row in components_of(copied):
        if row.get("component") == kind:
            return copied, row
    return None


def browser_semantics(messages):
    """Inputs where a naive port disagrees with JavaScript."""
    for kind, key, value in (("MetricTile", "asOf", "20261108"), ("MetricTile", "asOf", "2026-02-30"), ("MetricTile", "asOf", "2026-11-08T25:00:00Z"),
                             ("MetricTile", "asOf", "2026-11-08T10:30:00Z"), ("InfoRow", "title", "\ufeff"), ("InfoRow", "title", "\x85"),
                             ("TaskTile", "title", "\ufeff")):
        found = with_component(messages, kind)
        if found:
            found[1][key] = value
            yield f"{kind}.{key}={value!r}", dump(found[0])
    found = with_component(messages, "Agenda")
    if found:
        found[1]["events"][0]["date"] = "0000-01-01"
        yield "agenda year zero", dump(found[0])
    found = with_component(messages, "MiniChart")
    if found:
        found[1]["points"][0]["value"] = 987654321
        yield "huge integer", dump(found[0]).replace("987654321", "1" + "0" * 400)
    found = with_component(messages, "Button")
    if found and isinstance(found[1].get("action"), dict) and "event" in found[1]["action"]:
        found[1]["action"]["event"]["name"] = "go\n"
        yield "newline event name", dump(found[0])
    copied = copy.deepcopy(messages)
    surface = copied[0]["createSurface"]["surfaceId"]
    emoji = "\U0001F600" * 65
    for message in copied:
        for body in message.values():
            if isinstance(body, dict) and body.get("surfaceId") == surface:
                body["surfaceId"] = emoji
    yield "astral surface id", dump(copied)
    copied = copy.deepcopy(messages)
    copied.insert(1, {"version": "v0.9", "updateDataModel": {"surfaceId": surface, "path": "/a", "value": []}})
    copied.insert(2, {"version": "v0.9", "updateDataModel": {"surfaceId": surface, "path": "/a/0\n", "value": 1}})
    yield "newline array index", dump(copied)


def corpus():
    entries = [("not json", "{"), ("empty", ""), ("array line", "[]"), ("too big", "x" * (256 * 1024 + 1))]
    for path in fixtures():
        text = path.read_text(encoding="utf-8")
        entries.append((path.name, text))
        messages = [json.loads(line) for line in text.splitlines() if line.strip()]
        entries += [(f"{path.name}:{name}", payload) for name, payload in variants(messages)]
        entries += [(f"{path.name}:{name}", payload) for name, payload in browser_semantics(messages)]
    return entries


@pytest.mark.skipif(not (ROOT / "node_modules").exists() or not shutil.which("node"), reason="needs npm ci")
def test_same_verdict_as_browser(tmp_path):
    entries = corpus()
    assert len(entries) > 100
    source = tmp_path / "corpus.json"
    source.write_text(json.dumps([payload for _, payload in entries]), encoding="utf-8")
    done = subprocess.run(["node", "scripts/parity.mjs", str(source)], cwd=ROOT, check=True, capture_output=True, encoding="utf-8")
    browser = json.loads(done.stdout)
    disagreements = []
    accepted = 0
    for (name, payload), expected in zip(entries, browser):
        actual = validate_module.validate(payload)
        accepted += expected["ok"]
        if actual["ok"] != expected["ok"]:
            disagreements.append((name, expected, actual))
    assert not disagreements, disagreements[:12]
    assert accepted > 10, "the corpus should include payloads both validators accept"
