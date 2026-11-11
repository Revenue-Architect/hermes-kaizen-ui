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


def v1_rows(messages):
    return messages[0]["createSurface"]["components"]


def variants_v1(messages):
    """Broken 1.0 copies of a 1.0 view (its components sit inside createSurface); anything that does not apply is skipped."""

    def drop_root(items):
        v1_rows(items)[:] = [row for row in v1_rows(items) if row.get("id") != "root"]

    def unknown_type(items):
        v1_rows(items)[0]["component"] = "NotAComponent"

    def duplicate_id(items):
        v1_rows(items).append(copy.deepcopy(v1_rows(items)[0]))

    def wrong_catalog(items):
        items[0]["createSurface"]["catalogId"] = "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"

    def v0_9_catalog(items):
        items[0]["createSurface"]["catalogId"] = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"

    def wrong_version(items):
        items[0]["version"] = "v0.9"

    def second_message_v0_9(items):
        items.append({"version": "v0.9", "updateDataModel": {"surfaceId": items[0]["createSurface"]["surfaceId"], "path": "/a", "value": 1}})

    def extra_field(items):
        v1_rows(items)[0]["notAField"] = 1

    def forbidden_key(items):
        v1_rows(items)[0]["__proto__"] = {}

    def at_call(items):
        v1_rows(items)[0]["text"] = {"@call": "formatString", "args": {"value": "x"}}

    def call_key(items):
        v1_rows(items)[0]["call"] = "x"

    def theme(items):
        items[0]["createSurface"]["theme"] = {"primaryColor": "#00bfff"}

    def hyphenated_id(items):
        old = v1_rows(items)[-1]["id"]
        for row in v1_rows(items):
            if row["id"] == old:
                row["id"] = old + "-x"
            for key in ("child", "actionChild", "trigger", "content"):
                if row.get(key) == old:
                    row[key] = old + "-x"
            if isinstance(row.get("children"), list):
                row["children"] = [old + "-x" if child == old else child for child in row["children"]]

    def plain_path_binding(items):
        for row in v1_rows(items):
            if row.get("component") == "Text":
                row["text"] = {"path": "/a"}
                return
        raise LookupError

    def unknown_at_key(items):
        v1_rows(items)[0]["@foo"] = 1

    def both_envelope_forms(items):
        v1_rows(items)[0].update({"@accessibility": {"label": "a"}, "accessibility": {"label": "b"}})

    def update_without_value(items):
        items.append({"version": "1.0", "updateDataModel": {"surfaceId": items[0]["createSurface"]["surfaceId"], "path": "/a"}})

    def orphan(items):
        v1_rows(items).append({"id": "orphan", "component": "Text", "text": "lost"})

    def missing_create(items):
        items[0] = {"version": "1.0", "updateComponents": {"surfaceId": items[0]["createSurface"]["surfaceId"], "components": v1_rows(items)}}

    def bad_ref(items):
        for row in v1_rows(items):
            if isinstance(row.get("children"), list) and row["children"]:
                row["children"][0] = "missing_child"
                return
        raise LookupError

    def cycle(items):
        for row in v1_rows(items):
            if row.get("id") == "root" and isinstance(row.get("children"), list):
                row["children"].append("root")
                return
        raise LookupError

    def v0_9_tabs(items):
        for row in v1_rows(items):
            if row.get("component") == "Tabs":
                row["tabs"] = [{"label": tab["title"], "content": tab["child"]} for tab in row["tabs"]]
                return
        raise LookupError

    def data_model_not_object(items):
        items[0]["createSurface"]["dataModel"] = [1]

    for change in (drop_root, unknown_type, duplicate_id, wrong_catalog, v0_9_catalog, wrong_version, second_message_v0_9, extra_field,
                   forbidden_key, at_call, call_key, theme, hyphenated_id, plain_path_binding, unknown_at_key, both_envelope_forms,
                   update_without_value, orphan, missing_create, bad_ref, cycle, v0_9_tabs, data_model_not_object):
        copied = copy.deepcopy(messages)
        try:
            change(copied)
        except (LookupError, KeyError, TypeError):
            continue
        yield change.__name__, dump(copied)


def row_of(items, kind):
    for row in v1_rows(items):
        if row.get("component") == kind:
            return row
    raise LookupError


def rename_last(items, suffix):
    """Gives the last component an id that ends in `suffix`, and points every reference at the new id."""
    old = v1_rows(items)[-1]["id"]
    new = old + suffix
    for row in v1_rows(items):
        if row["id"] == old:
            row["id"] = new
        for key in ("child", "actionChild", "trigger", "content"):
            if row.get(key) == old:
                row[key] = new
        if isinstance(row.get("children"), list):
            row["children"] = [new if child == old else child for child in row["children"]]
        for tab in row.get("tabs", []) if isinstance(row.get("tabs"), list) else []:
            if tab.get("child") == old:
                tab["child"] = new


def edge_cases_v1(messages):
    """1.0 inputs at the edge of the rules, which both validators must judge the same way."""
    surface = messages[0]["createSurface"]["surfaceId"]
    own = messages[0]["createSurface"].get("catalogId")
    cases = (
        ("envelope", lambda items: v1_rows(items)[0].update({"@accessibility": {"label": "x", "live": "polite"}})),
        ("bare accessibility", lambda items: v1_rows(items)[0].update({"accessibility": {"label": "x"}})),
        ("catalog of its own on a component", lambda items: v1_rows(items)[0].update({"@catalogId": own})),
        ("metadata", lambda items: items[0]["createSurface"].update(metadata={"extensions": {"a2ui_x": 1}})),
        ("metadata that is not an object", lambda items: items[0]["createSurface"].update(metadata={"extensions": 5})),
        ("extension key with a hyphen", lambda items: v1_rows(items)[0].update({"@metadata": {"extensions": {"a-b": 1}}})),
        ("delete by null", lambda items: items.append({"version": "1.0", "updateDataModel": {"surfaceId": surface, "path": "/a", "value": None}})),
        ("set a value", lambda items: items.append({"version": "1.0", "updateDataModel": {"surfaceId": surface, "path": "/a/b", "value": [1, {"c": 2}]}})),
        ("forbidden data path", lambda items: items.append({"version": "1.0", "updateDataModel": {"surfaceId": surface, "path": "/__proto__/a", "value": 1}})),
        ("binding to a forbidden path", lambda items: row_of(items, "Text").update(text={"@path": "/constructor/x"})),
        ("long binding", lambda items: row_of(items, "Text").update(text={"@path": "/" + "a" * 300})),
        ("long binding that fits", lambda items: row_of(items, "Text").update(text={"@path": "/" + "a" * 200})),
        ("event context binding", lambda items: row_of(items, "Button").update(
            action={"event": {"name": "x.y", "context": {"a": {"@path": "/a"}, "b": [1, 2], "c": "s"}}})),
        ("event context plain object", lambda items: row_of(items, "Button").update(action={"event": {"name": "x.y", "context": {"a": {"k": 1}}}})),
        ("event context @call", lambda items: row_of(items, "Button").update(action={"event": {"name": "x.y", "context": {"a": {"@call": "f"}}}})),
        ("event context plain path", lambda items: row_of(items, "Button").update(action={"event": {"name": "x.y", "context": {"a": {"path": "/a"}}}})),
        ("underscore id", lambda items: rename_last(items, "_x")),
        ("accented id", lambda items: rename_last(items, "\u00e9")),
    )
    for name, change in cases:
        copied = copy.deepcopy(messages)
        try:
            change(copied)
        except (LookupError, KeyError, TypeError, AttributeError):
            continue
        yield f"1.0 {name}", dump(copied)


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
    # The 1.0 corpus: the converted fixtures and the bound cases, each with its broken variants and its edge cases.
    one_zero = sorted((ROOT / "fixtures" / "v1_0").rglob("*.jsonl")) + sorted((ROOT / "fixtures" / "bound").glob("*.v1_0.jsonl"))
    for path in one_zero:
        text = path.read_text(encoding="utf-8")
        entries.append((f"1.0/{path.name}", text))
        messages = [json.loads(line) for line in text.splitlines() if line.strip()]
        entries += [(f"1.0/{path.name}:{name}", payload) for name, payload in variants_v1(messages)]
        entries += [(f"1.0/{path.name}:{name}", payload) for name, payload in edge_cases_v1(messages)]
    for path in sorted((ROOT / "fixtures" / "bound").glob("*.v0_9.jsonl")):
        entries.append((f"bound/{path.name}", path.read_text(encoding="utf-8")))
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
