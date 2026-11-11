"""A2UI 1.0 beside v0.9: the generated catalog and contracts, the Python validator's 1.0 rules, the tool, and the SDK's own verdict.

These need the a2ui-agent-sdk the plugin pins (pip install -e .[dev] brings it).
"""
import copy
import json
import re
from pathlib import Path

import pytest

# Import the SDK's `a2ui` while the tests are collected: this checkout's plugin folder is itself named `a2ui` (see test_express.py).
import a2ui.core.catalog.catalog  # noqa: F401, E402
import a2ui.utils  # noqa: F401, E402
from test_express import (  # noqa: F401, E402 - `plugin` is a fixture
    CATALOG_FILE, FORM_EXPRESS, GOOD_EXPRESS, call, components_of, data_model_of, express_module, generator, parse, plugin, saved_payload,
    validate_module,
)
from test_plugin import PNG, ROOT  # noqa: E402

CATALOG_V1_FILE = ROOT / "a2ui_core" / "catalogs" / "hermes-v1_0.json"
MOBILE = ROOT / "fixtures" / "mobile"
V1 = ROOT / "fixtures" / "v1_0"
BOUND = ROOT / "fixtures" / "bound"
CATALOG_V1 = json.loads(CATALOG_V1_FILE.read_text(encoding="utf-8"))
CATALOG_ID = CATALOG_V1["catalogId"]
SDK_BASIC_ID_V1 = "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
V0_9_ID = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"


def jsonl(path):
    return parse(path.read_text(encoding="utf-8"))


def dump(messages):
    return "\n".join(json.dumps(message) for message in messages)


def v1_paths():
    return sorted(V1.rglob("*.jsonl"))


def bound_pairs():
    return sorted(BOUND.glob("*.express"))


def verdict(messages):
    return validate_module.validate(dump(messages))


def base(components=None, data=None, **create):
    """A small valid 1.0 view, with room to break it."""
    body = {"surfaceId": "s", "components": components or [{"id": "root", "component": "Text", "text": "Hi"}], **create}
    if data is not None:
        body["dataModel"] = data
    return [{"version": "1.0", "createSurface": body}]


def sdk_catalog_v1():
    from a2ui.core.catalog.catalog import Catalog

    return Catalog.from_json(CATALOG_V1, protocol_version="1.0")


def sdk_catalog_v0_9():
    from a2ui.core.catalog.catalog import Catalog

    return Catalog.from_json(json.loads(CATALOG_FILE.read_text(encoding="utf-8")), protocol_version="v0.9")


# ---- every fixture, in both versions ----

def test_every_fixture_has_a_1_0_twin_and_there_are_bound_cases():
    assert [p.relative_to(V1) for p in v1_paths()] == [p.relative_to(MOBILE) for p in sorted(MOBILE.rglob("*.jsonl"))]
    assert len(v1_paths()) == 33
    assert [p.stem for p in bound_pairs()] == ["meal-form", "notes-modal"]
    for source in bound_pairs():
        assert source.with_name(f"{source.stem}.v0_9.jsonl").is_file() and source.with_name(f"{source.stem}.v1_0.jsonl").is_file()


@pytest.mark.parametrize("path", v1_paths() + sorted(BOUND.glob("*.v1_0.jsonl")), ids=lambda p: p.name)
def test_a_1_0_fixture_validates_as_1_0(path):
    messages = jsonl(path)
    assert {m["version"] for m in messages} == {"1.0"}
    created = messages[0]["createSurface"]
    assert "theme" not in created and "components" in created
    assert all(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", row["id"]) for row in created["components"])
    result = verdict(messages)
    assert result["ok"] and result["version"] == "1.0", result


def to_internal(value):
    """The one shape the renderer draws: `{"@path": p}` as `{path: p}`, tabs as `{label, content}`."""
    if isinstance(value, list):
        return [to_internal(item) for item in value]
    if not isinstance(value, dict):
        return value
    if "@path" in value:
        return {"path": value["@path"]}
    converted = {key: to_internal(item) for key, item in value.items()}
    if converted.get("component") == "Tabs":
        converted["tabs"] = [{"label": tab["title"], "content": tab["child"]} if "title" in tab else tab for tab in converted["tabs"]]
    return converted


def view(messages):
    """(components by id, data model) of a view written either way, in the internal shape."""
    components, model = {}, {}
    for message in messages:
        body = next(value for key, value in message.items() if key != "version")
        for row in body.get("components", []):
            components[row["id"]] = to_internal(row)
        if "dataModel" in body:
            model = validate_module._update_model(model, "/", body["dataModel"])
        if "updateDataModel" in message:
            model = validate_module._update_model(model, body.get("path", "/"), body.get("value"))
    return components, model


@pytest.mark.parametrize("path", sorted(MOBILE.rglob("*.jsonl")), ids=lambda p: p.name)
def test_a_v0_9_fixture_and_its_1_0_twin_are_the_same_view(path):
    old = view(generator.identifier_safe_v0_9(jsonl(path)))
    new = view(jsonl(V1 / path.relative_to(MOBILE)))
    assert new[0] == old[0]
    assert new[1] == old[1]


@pytest.mark.parametrize("source", bound_pairs(), ids=lambda p: p.stem)
def test_a_bound_v0_9_view_and_its_1_0_twin_are_the_same_view(source):
    old = view(jsonl(source.with_name(f"{source.stem}.v0_9.jsonl")))
    new = view(jsonl(source.with_name(f"{source.stem}.v1_0.jsonl")))
    assert old[0] == new[0] and old[1] == new[1]
    assert old[1], "a bound case needs a data model"
    assert any(isinstance(value, dict) and set(value) == {"path"} for row in old[0].values() for value in row.values())


# ---- the outside check: the SDK judges what the plugin emits ----

def test_the_sdk_accepts_every_1_0_payload_the_plugin_emits():
    catalog, checked = sdk_catalog_v1(), 0
    emitted = [jsonl(path) for path in v1_paths() + sorted(BOUND.glob("*.v1_0.jsonl"))]
    emitted += [parse(express_module.compile_express(text)) for text in (GOOD_EXPRESS, FORM_EXPRESS)]
    for messages in emitted:
        a2ui.utils.validate_payload([catalog], messages)  # raises on anything it rejects
        checked += 1
    print(f"validate_payload accepted {checked} 1.0 payloads")
    assert checked == 33 + 2 + 2


def test_the_sdk_agrees_the_v0_9_twins_are_valid_too():
    catalog = sdk_catalog_v0_9()
    for path in sorted(BOUND.glob("*.v0_9.jsonl")):
        a2ui.utils.validate_payload([catalog], jsonl(path))


def test_the_sdk_rejects_what_the_plugin_rejects_for_the_catalog_reasons():
    catalog = sdk_catalog_v1()
    broken = copy.deepcopy(base([{"id": "root", "component": "Text", "text": "Hi", "variant": "h6"}]))
    with pytest.raises(Exception):
        a2ui.utils.validate_payload([catalog], broken)
    assert not verdict(broken)["ok"]


# ---- the plugin's 1.0 catalog ----

def test_the_catalog_is_the_sdks_basic_catalog_plus_ours_under_its_own_id():
    basic = json.loads(generator.BASIC_V1_FILE.read_text(encoding="utf-8"))
    assert CATALOG_V1["protocolVersion"] == "1.0" and CATALOG_ID != SDK_BASIC_ID_V1 == basic["catalogId"]
    assert CATALOG_V1["$id"] == CATALOG_ID and CATALOG_ID.startswith("https://github.com/Revenue-Architect/hermes-kaizen-ui/")
    names = set(CATALOG_V1["components"])
    assert len(names) == 48 and not names & {"AudioPlayer", "Video"}
    assert names == set(validate_module._get_schemas("1.0").names) == set(validate_module._get_schemas("v0.9").names)
    assert [ref["$ref"] for ref in CATALOG_V1["$defs"]["anyComponent"]["oneOf"]] == [f"#/components/{name}" for name in CATALOG_V1["components"]]
    for name in names - set(basic["components"]):
        schema = CATALOG_V1["components"][name]
        assert schema["properties"]["component"] == {"const": name} and schema["properties"]["weight"] == {"$ref": "#/$defs/Weight"}


def test_the_six_child_slots_are_links_like_the_basic_button():
    for name, slots in generator.CHILD_SLOTS.items():
        for slot in slots:
            assert CATALOG_V1["components"][name]["properties"][slot]["$ref"] == "common_types.json#/$defs/Child"
    assert CATALOG_V1["components"]["Button"]["allOf"][1]["properties"]["child"]["$ref"] == "common_types.json#/$defs/Child"
    assert sum(1 for slots in generator.CHILD_SLOTS.values() for _ in slots) == 6


def test_text_variant_keeps_what_the_renderer_draws_and_the_spec_changes_are_carried():
    components = CATALOG_V1["components"]
    assert set(components["Text"]["properties"]["variant"]["enum"]) == {"h1", "h2", "h3", "h4", "h5", "caption", "body"}
    text_field = components["TextField"]["allOf"][1]
    assert "placeholder" in text_field["properties"] and "validationRegexp" not in text_field["properties"]
    assert text_field["required"] == ["component", "label", "value"]
    assert "steps" in components["Slider"]["allOf"][1]["properties"]


def test_the_differences_list_names_the_known_changes():
    text = "\n".join(generator.differences())
    for expected in ("Text.variant", "TextField.placeholder", "TextField.validationRegexp", "Slider.steps", "Tabs.tabs", "required fields"):
        assert expected in text, expected


def test_the_provenance_names_the_sdk_and_matches_the_files():
    from hashlib import sha256

    provenance = json.loads((generator.PROVENANCE_V1_FILE).read_text(encoding="utf-8"))
    assert provenance["contract"] == "A2UI 1.0" and provenance["sdk"]["package"] == "a2ui-agent-sdk" and provenance["sdk"]["version"] == "0.11.0"
    for entry in provenance["files"]:
        text = (ROOT / entry["path"]).read_bytes().decode("utf-8").replace("\r\n", "\n")
        assert sha256(text.encode("utf-8")).hexdigest() == entry["sha256"], entry["path"]


def test_the_browser_validator_uses_the_same_catalog_id():
    types = (ROOT / "src" / "types.ts").read_text(encoding="utf-8")
    assert re.search(r'A2UI_CATALOG_ID_V1 =\s*"([^"]+)"', types).group(1) == CATALOG_ID


def test_every_generated_file_is_current():
    stale = [str(path.relative_to(ROOT)) for path, text in generator.wanted_files().items()
             if not path.is_file() or path.read_bytes().decode("utf-8").replace("\r\n", "\n") != text]
    assert not stale, stale


# ---- the Python validator's 1.0 rules ----

def mutate(change):
    messages = base([
        {"id": "root", "component": "Column", "children": ["title", "go"]},
        {"id": "title", "component": "Text", "text": {"@path": "/t"}},
        {"id": "go", "component": "Button", "child": "go_label", "action": {"event": {"name": "x.go", "context": {"t": {"@path": "/t"}}}}},
        {"id": "go_label", "component": "Text", "text": "Go"},
    ], data={"t": "hello"})
    change(messages)
    return messages


def rows(messages):
    return messages[0]["createSurface"]["components"]


def by_id(messages, component_id):
    return next(row for row in rows(messages) if row["id"] == component_id)


def test_the_base_view_is_valid_and_reports_its_version():
    assert mutate(lambda m: None) and verdict(mutate(lambda m: None)) == {"ok": True, "surfaces": ["s"], "warnings": [], "version": "1.0"}


BROKEN = {
    "function call": lambda m: by_id(m, "title").update(text={"@call": "formatDate", "args": {"value": "x"}}),
    "function call in an action": lambda m: by_id(m, "go")["action"].update(functionCall={"call": "openUrl"}),
    "theme": lambda m: m[0]["createSurface"].update(theme={"primaryColor": "#ffffff"}),
    "hyphenated id": lambda m: (by_id(m, "go_label").update(id="go-label"), by_id(m, "go").update(child="go-label")),
    "id starting with a digit": lambda m: (by_id(m, "go_label").update(id="1label"), by_id(m, "go").update(child="1label")),
    "plain path as a binding": lambda m: by_id(m, "title").update(text={"path": "/t"}),
    "plain path in an event context": lambda m: by_id(m, "go")["action"]["event"].update(context={"t": {"path": "/t"}}),
    "unknown @ key": lambda m: by_id(m, "title").update({"@foo": 1}),
    "unknown @ key inside a binding": lambda m: by_id(m, "title").update(text={"@path": "/t", "@extra": 1}),
    "both forms of an envelope key": lambda m: by_id(m, "title").update({"@accessibility": {"label": "a"}, "accessibility": {"label": "b"}}),
    "another catalog on a component": lambda m: by_id(m, "title").update({"@catalogId": SDK_BASIC_ID_V1}),
    "another catalog on the surface": lambda m: m[0]["createSurface"].update(catalogId=SDK_BASIC_ID_V1),
    "the v0.9 catalog id": lambda m: m[0]["createSurface"].update(catalogId=V0_9_ID),
    "a v0.9 message after a 1.0 one": lambda m: m.append({"version": "v0.9", "updateDataModel": {"surfaceId": "s", "path": "/t", "value": "x"}}),
    "updateDataModel without a value": lambda m: m.append({"version": "1.0", "updateDataModel": {"surfaceId": "s", "path": "/t"}}),
    "a data model that is not an object": lambda m: m[0]["createSurface"].update(dataModel=[1]),
    "userMessage on an event": lambda m: by_id(m, "go")["action"]["event"].update(userMessage="Going"),
    "a missing child": lambda m: by_id(m, "root").update(children=["title", "go", "ghost"]),
    "unreachable component": lambda m: rows(m).append({"id": "orphan", "component": "Text", "text": "lost"}),
    "no root": lambda m: rows(m).__setitem__(0, {**rows(m)[0], "id": "top"}),
    "unknown component": lambda m: by_id(m, "title").update(component="Nope"),
    "text variant 1.0 does not know": lambda m: by_id(m, "title").update(variant="h6"),
    "an event name with a space": lambda m: by_id(m, "go")["action"]["event"].update(name="a b"),
    "a forbidden key": lambda m: by_id(m, "title").update({"__proto__": {}}),
    "an unknown top-level key": lambda m: m[0].update(extra=1),
    "a v0.9 style tab": lambda m: rows(m).extend([
        {"id": "tabs", "component": "Tabs", "tabs": [{"label": "A", "content": "title"}]}]),
}


@pytest.mark.parametrize("name", sorted(BROKEN))
def test_a_broken_1_0_view_is_refused(name):
    messages = mutate(BROKEN[name])
    assert verdict(messages)["ok"] is False, name


def test_the_unknown_component_and_the_other_versions_are_refused_with_a_reason():
    assert "unknown type" in verdict(mutate(BROKEN["unknown component"]))["error"]
    assert "invalid ID" in verdict(mutate(BROKEN["hyphenated id"]))["error"]
    assert "Client functions" in verdict(mutate(BROKEN["function call"]))["error"]
    assert validate_module.validate('{"version": "v0.8", "createSurface": {}}')["error"].startswith("Only A2UI v0.9 and 1.0")


@pytest.mark.parametrize("name,change", [
    ("null deletes", lambda m: m.append({"version": "1.0", "updateDataModel": {"surfaceId": "s", "path": "/t", "value": None}})),
    ("a data update after", lambda m: m.append({"version": "1.0", "updateDataModel": {"surfaceId": "s", "path": "/n", "value": 2}})),
    ("@accessibility", lambda m: by_id(m, "title").update({"@accessibility": {"label": "Title", "live": "polite"}})),
    ("accessibility as the SDK writes it", lambda m: by_id(m, "title").update(accessibility={"label": "Title"})),
    ("@catalogId of ours", lambda m: by_id(m, "title").update({"@catalogId": CATALOG_ID})),
    ("@metadata", lambda m: by_id(m, "title").update({"@metadata": {"extensions": {"a2ui_note": 1}}})),
    ("no catalogId on the surface", lambda m: m[0]["createSurface"].pop("catalogId", None)),
    ("sendDataModel", lambda m: m[0]["createSurface"].update(sendDataModel=True)),
    ("surface metadata", lambda m: m[0]["createSurface"].update(metadata={"extensions": {"a2ui_note": 1}})),
    ("text variant h4", lambda m: by_id(m, "title").update(variant="h4")),
    ("components sent separately", lambda m: (m.__setitem__(0, {"version": "1.0", "createSurface": {"surfaceId": "s"}}), m.append(
        {"version": "1.0", "updateComponents": {"surfaceId": "s", "components": [
            {"id": "root", "component": "Column", "children": ["title", "go"]}, {"id": "title", "component": "Text", "text": "T"},
            {"id": "go", "component": "Button", "child": "go_label", "action": {"event": {"name": "x.go"}}}, {"id": "go_label", "component": "Text", "text": "G"}]}}))),
])
def test_a_valid_1_0_variation_is_accepted(name, change):
    messages = mutate(change)
    assert verdict(messages)["ok"], (name, verdict(messages))


def test_tabs_take_the_1_0_names_and_their_children_are_checked():
    def tabs(*entries):
        return base([{"id": "root", "component": "Tabs", "tabs": list(entries)}, {"id": "a", "component": "Text", "text": "A"}])
    assert verdict(tabs({"title": "One", "child": "a"}))["ok"]
    assert not verdict(tabs({"title": "One", "child": "ghost"}))["ok"]
    assert not verdict(tabs({"label": "One", "content": "a"}))["ok"]


def test_inputs_follow_the_1_0_schema():
    def one(component):
        return verdict(base([{"id": "root", **component}]))["ok"]
    assert one({"component": "TextField", "label": "N", "value": "x", "placeholder": "p"})
    assert not one({"component": "TextField", "label": "N"})
    assert not one({"component": "TextField", "label": "N", "value": "x", "validationRegexp": "^a$"})
    assert one({"component": "Slider", "label": "S", "max": 10, "value": 3, "steps": 5})
    assert not one({"component": "Slider", "label": "S", "max": 10, "value": 3, "steps": 0})
    assert one({"component": "Text", "text": "x", "weight": 1}) is True


def test_a_list_template_keeps_its_plain_path():
    messages = base([
        {"id": "root", "component": "List", "children": {"componentId": "row", "path": "/items"}},
        {"id": "row", "component": "Text", "text": {"@path": "label"}},
    ], data={"items": [{"label": "Eggs"}]})
    assert verdict(messages)["ok"]
    messages[0]["createSurface"]["components"][0]["children"] = {"componentId": "row", "path": "/items", "extra": 1}
    assert not verdict(messages)["ok"]


def test_a_v0_9_view_is_still_judged_by_the_v0_9_rules():
    good = jsonl(MOBILE / "action-needed.jsonl")
    result = verdict(good)
    assert result["ok"] and result["version"] == "v0.9"
    hyphenated = [c["id"] for m in good for c in m.get("updateComponents", {}).get("components", []) if "-" in c["id"]]
    assert hyphenated, "the v0.9 fixture should still carry hyphenated ids, which v0.9 allows"
    bound = jsonl(BOUND / "meal-form.v0_9.jsonl")
    assert verdict(bound)["ok"]
    bound[2]["updateDataModel"].pop("value")
    assert verdict(bound)["ok"], "v0.9 treats a missing value as null"


# ---- the tool ----

def test_express_is_checked_and_saved_as_1_0(plugin):
    ctx, _ = plugin
    result = call(ctx, {"express": FORM_EXPRESS})
    assert result["ok"], result
    saved = parse(saved_payload(result))
    assert saved[0]["version"] == "1.0" and saved[0]["createSurface"]["dataModel"] == {"form": {"name": "", "servings": 2}}


@pytest.mark.parametrize("name", ["meal-form.v1_0.jsonl", "notes-modal.v1_0.jsonl", "meal-form.v0_9.jsonl"])
def test_a_json_payload_of_either_version_is_saved_as_written(plugin, name):
    ctx, _ = plugin
    text = (BOUND / name).read_text(encoding="utf-8").strip()
    assert saved_payload(call(ctx, {"payload": text})) == text


def test_a_json_payload_that_breaks_1_0_comes_back_as_invalid_a2ui(plugin):
    ctx, _ = plugin
    result = call(ctx, {"payload": dump(mutate(BROKEN["hyphenated id"]))})
    assert result["code"] == "invalid_a2ui" and "invalid ID" in result["error"]


def test_without_the_sdk_a_1_0_payload_still_works(plugin, monkeypatch):
    import sys

    ctx, _ = plugin
    monkeypatch.setitem(sys.modules, "a2ui.core.catalog.catalog", None)
    assert call(ctx, {"express": GOOD_EXPRESS})["code"] == "express_unavailable"
    assert call(ctx, {"payload": (BOUND / "meal-form.v1_0.jsonl").read_text(encoding="utf-8")})["ok"]


def image_view(url, data=None):
    return dump(base([{"id": "root", "component": "Image", "url": url, "description": "A"}], data=data))


def test_a_local_image_in_a_1_0_payload_is_saved_with_the_view(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "one.png"
    image.write_bytes(PNG)
    result = call(ctx, {"payload": image_view(str(image))})
    assert result["ok"] and ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_a_local_image_bound_to_the_1_0_data_model_is_saved_and_unrelated_data_is_not(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "two.png"
    image.write_bytes(PNG)
    result = call(ctx, {"payload": image_view({"@path": "/photo"}, {"photo": str(image), "note": "/nowhere/report.png"})})
    assert result["ok"], result
    assert ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_a_1_0_data_update_after_the_surface_is_followed_for_bound_images(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "three.png"
    image.write_bytes(PNG)
    messages = base([{"id": "root", "component": "Image", "url": {"@path": "/photo"}, "description": "A"}], data={"photo": "/nowhere/x.png"})
    messages.append({"version": "1.0", "updateDataModel": {"surfaceId": "s", "path": "/photo", "value": str(image)}})
    assert ":image " in Path(call(ctx, {"payload": dump(messages)})["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_a_missing_local_image_in_a_1_0_payload_says_so(plugin, tmp_path):
    ctx, _ = plugin
    assert call(ctx, {"payload": image_view(str(tmp_path / "gone.png"))})["code"] == "image_not_found"


def test_a_plain_path_binding_on_an_image_is_not_followed_in_1_0(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "four.png"
    image.write_bytes(PNG)
    result = call(ctx, {"payload": image_view({"path": "/photo"}, {"photo": str(image)})})
    assert result["code"] == "invalid_a2ui"


def test_the_tool_text_says_1_0(plugin):
    import sys

    module = sys.modules["hermes_a2ui_test.a2ui_core.tool"]
    assert "1.0" in module.SCHEMA["description"] and "1.0" in module.GUIDANCE and len(module.GUIDANCE) <= 600


def test_the_versions_agree_across_the_three_files():
    import yaml

    manifest = yaml.safe_load((ROOT / "plugin.yaml").read_text(encoding="utf-8"))
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    pyproject = re.search(r'^version = "([^"]+)"', (ROOT / "pyproject.toml").read_text(encoding="utf-8"), re.M).group(1)
    assert manifest["version"] == package["version"] == pyproject == "2.0.0"
    assert "1.0" in manifest["description"]


# ---- after the Codex review ----

def dump_raw(messages):
    """JSONL with non-ASCII characters left as they are, which is how Express serialization writes them."""
    return "\n".join(json.dumps(message, ensure_ascii=False) for message in messages)


@pytest.mark.parametrize("separator", [" ", " ", "\x85"])
@pytest.mark.parametrize("how", ["payload", "express"])
def test_a_view_with_a_line_separator_in_its_text_is_delivered(plugin, how, separator):
    ctx, _ = plugin
    text = f"First{separator}Second"
    if how == "payload":
        sent = {"payload": dump_raw(base([{"id": "root", "component": "Text", "text": text}]))}
        assert separator in sent["payload"]
    else:
        sent = {"express": f'surface("sep")\nroot = Text("{text}")\n'}
    result = call(ctx, sent)
    assert result["ok"], result
    assert text in saved_payload(result)


def test_blank_lines_are_skipped_the_way_the_validators_skip_them(plugin):
    ctx, _ = plugin
    payload = dump_raw(base()) + "\n﻿\n\r\n"
    assert validate_module.validate(payload)["ok"]
    assert call(ctx, {"payload": payload})["ok"]


def image_messages(version, surface, components):
    create = {"surfaceId": surface, **({"catalogId": V0_9_ID} if version == "v0.9" else {})}
    return [{"version": version, "createSurface": create},
            {"version": version, "updateComponents": {"surfaceId": surface, "components": components}}]


def saved_text(result):
    return Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


@pytest.mark.parametrize("version", ["v0.9", "1.0"])
def test_an_image_a_later_update_replaced_does_not_stop_delivery(plugin, tmp_path, version):
    ctx, _ = plugin
    gone = {"id": "root", "component": "Image", "url": str(tmp_path / "missing" / "old.png"), "description": "Old"}
    messages = image_messages(version, "s", [gone])
    messages.append({"version": version, "updateComponents": {"surfaceId": "s", "components": [{"id": "root", "component": "Text", "text": "Ready"}]}})
    assert validate_module.validate(dump(messages))["ok"]
    result = call(ctx, {"payload": dump(messages)})
    assert result["ok"], result
    assert ":image " not in saved_text(result)


@pytest.mark.parametrize("version", ["v0.9", "1.0"])
def test_an_image_replaced_by_another_is_saved_and_the_old_one_is_not_looked_for(plugin, tmp_path, version):
    ctx, _ = plugin
    new = tmp_path / "new.png"
    new.write_bytes(PNG)
    messages = image_messages(version, "s", [{"id": "root", "component": "Image", "url": str(tmp_path / "old.png"), "description": "Old"}])
    messages.append({"version": version, "updateComponents": {"surfaceId": "s", "components": [
        {"id": "root", "component": "Image", "url": str(new), "description": "New"}]}})
    result = call(ctx, {"payload": dump(messages)})
    assert result["ok"], result
    assert saved_text(result).count(":image ") == 1


@pytest.mark.parametrize("version", ["v0.9", "1.0"])
def test_an_image_on_a_deleted_surface_does_not_stop_delivery(plugin, tmp_path, version):
    ctx, _ = plugin
    gone = {"id": "root", "component": "Image", "url": str(tmp_path / "missing" / "old.png"), "description": "Old"}
    messages = image_messages(version, "old", [gone]) + image_messages(version, "s", [{"id": "root", "component": "Text", "text": "Ready"}])
    messages.append({"version": version, "deleteSurface": {"surfaceId": "old"}})
    checked = validate_module.validate(dump(messages))
    assert checked["ok"] and checked["surfaces"] == ["s"]
    result = call(ctx, {"payload": dump(messages)})
    assert result["ok"], result


@pytest.mark.parametrize("version", ["v0.9", "1.0"])
def test_a_missing_image_that_is_still_in_the_final_view_is_still_reported(plugin, tmp_path, version):
    ctx, _ = plugin
    messages = image_messages(version, "s", [
        {"id": "root", "component": "Column", "children": ["pic", "words"]},
        {"id": "pic", "component": "Image", "url": str(tmp_path / "gone.png"), "description": "G"},
        {"id": "words", "component": "Text", "text": "Hi"}])
    messages.append({"version": version, "updateComponents": {"surfaceId": "s", "components": [{"id": "words", "component": "Text", "text": "Still here"}]}})
    assert call(ctx, {"payload": dump(messages)})["code"] == "image_not_found"


ORDINARY_PATH = {"extensions": {"asset": {"path": "/report.pdf"}}}


def test_ordinary_data_with_a_path_key_is_not_a_binding_in_1_0():
    plain = base([{"id": "root", "component": "Text", "text": "Hi", "metadata": ORDINARY_PATH}])
    assert verdict(plain)["ok"], verdict(plain)
    enveloped = base([{"id": "root", "component": "Text", "text": "Hi", "@metadata": ORDINARY_PATH}])
    assert verdict(enveloped)["ok"], verdict(enveloped)
    for refused in ({"id": "root", "component": "Text", "text": {"path": "/t"}},
                    {"id": "root", "component": "Text", "text": "Hi", "metadata": {"extensions": {"asset": {"@path": 1}}}}):
        assert not verdict(base([refused]))["ok"]


def test_a_list_template_still_has_its_path_checked_in_1_0():
    def template(path):
        return base([{"id": "root", "component": "List", "children": {"componentId": "row", "path": path}},
                     {"id": "row", "component": "Text", "text": {"@path": "label"}}])
    assert verdict(template("/items"))["ok"]
    assert not verdict(template("/__proto__/x"))["ok"]
    assert not verdict(template("/" + "a" * 300))["ok"]


def test_a_v0_9_view_still_reads_every_path_object_as_a_binding():
    assert validate_module._valid_bindings({"a": {"path": "/x"}})
    assert not validate_module._valid_bindings({"a": {"path": "/x", "extra": 1}})
    assert not validate_module._valid_bindings({"a": {"path": 5}})
    assert not validate_module._valid_bindings({"a": [{"path": "/__proto__/x"}]})


def test_extension_keys_are_whole_identifiers_and_numbers_are_finite_in_1_0():
    def view(extensions):
        return dump(base([{"id": "root", "component": "Text", "text": "Hi", "metadata": {"extensions": extensions}}]))
    assert validate_module.validate(view({"note": 1}))["ok"]
    assert not validate_module.validate(view({"note\n": 1}))["ok"]
    assert not validate_module.validate(view({"n": 987654321}).replace("987654321", "1e400"))["ok"]
    assert not validate_module.validate(view({"n": 987654321}).replace("987654321", "-1" + "0" * 400))["ok"]
    assert validate_module.validate(view({"n": 987654321}).replace("987654321", "1e300"))["ok"]


SKILL = ROOT / "skills" / "a2ui" / "SKILL.md"
REFERENCES = ROOT / "skills" / "a2ui" / "references"


def express_blocks(text):
    return [block for block in re.findall(r"```\n(.*?)\n```", text, re.S) if block.startswith("surface(")]


def test_the_skill_teaches_an_explicit_list_not_a_template():
    skill = SKILL.read_text(encoding="utf-8")
    blocks = [block for block in express_blocks(skill) if "List(" in block]
    assert blocks, "the skill should show a repeated list written as explicit children"
    for block in blocks:
        assert "_template" not in block
        messages = parse(express_module.compile_express(block))
        assert validate_module.validate("\n".join(map(json.dumps, messages)))["ok"]
        assert all(not isinstance(row.get("children"), dict) for row in messages[0]["createSurface"]["components"])
    for line in skill.splitlines():
        if "_template" in line or "componentId" in line:
            assert re.search(r"never|do not|not drawn|don't", line, re.I), line


def test_the_skill_example_is_the_one_the_dom_test_draws():
    block = next(block for block in express_blocks(SKILL.read_text(encoding="utf-8")) if "List(" in block)
    assert parse(express_module.compile_express(block)) == jsonl(ROOT / "fixtures" / "skill" / "repeated-list.v1_0.jsonl")


def test_the_generated_signatures_say_templates_are_not_drawn():
    assert "not drawn" in (REFERENCES / "express-signatures.md").read_text(encoding="utf-8").split("\n# ", 1)[0]


def test_the_component_guide_is_v0_9_only_and_1_0_authors_are_sent_to_the_signatures():
    skill = SKILL.read_text(encoding="utf-8")
    guide = (REFERENCES / "component-guide.md").read_text(encoding="utf-8")
    assert "v0.9 only" in "\n".join(guide.splitlines()[:6])
    for line in skill.splitlines():
        if re.search(r"(?<!extended-)component-guide\.md", line):
            assert "v0.9" in line, line
    assert "references/express-signatures.md" in skill
    assert re.search(r"`TextField` requires `value`", skill)
    signatures = (REFERENCES / "express-signatures.md").read_text(encoding="utf-8")
    assert re.search(r"^• TextField\(label, value, ", signatures, re.M)
