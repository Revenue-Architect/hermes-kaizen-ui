"""A2UI Express in, JSONL out: the compiler, the tool's `express` argument, and the files generated for it.

Release 2.0.0 compiles Express to A2UI 1.0 by default. The v0.9 compile stays available (`compile_express(text, "v0.9")`) and keeps its
own regression net below: every fixture, JSON to Express and back, against the v0.9 catalog.

These need the a2ui-agent-sdk the plugin pins (pip install -e .[dev] brings it).
"""
import base64
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

# This checkout's plugin folder is itself named `a2ui`, and pytest imports its __init__.py as the module `a2ui` when the first
# test in it starts. Import the SDK's `a2ui` while the tests are collected, so the plugin folder never stands in for it.
import a2ui.core.catalog.catalog  # noqa: F401, E402
import a2ui.inference_formats.express  # noqa: F401, E402
from test_plugin import CATALOG, PNG, ROOT, plugin  # noqa: F401, E402 - `plugin` is a fixture

CATALOG_FILE = ROOT / "a2ui_core" / "catalogs" / "hermes-v0_9.json"


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validate_module = load("express_test_validate", "a2ui_core/validate.py")
express_module = load("express_test_express", "a2ui_core/express.py")
generator = load("express_test_generator", "scripts/generate_express.py")


def fixture_paths():
    return sorted((ROOT / "fixtures" / "mobile").rglob("*.jsonl"))


def parse(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def components_of(messages):
    found = {}
    for message in messages:
        for row in message.get("updateComponents", {}).get("components", []):
            found[row["id"]] = row
    return found


def data_model_of(messages):
    model = {}
    for message in messages:
        if "updateDataModel" in message:
            body = message["updateDataModel"]
            model = validate_module._update_model(model, body.get("path", "/"), body.get("value"))
    return model


def sdk_catalog():
    from a2ui.core.catalog.catalog import Catalog

    return Catalog.from_json(json.loads(CATALOG_FILE.read_text(encoding="utf-8")), protocol_version="v0.9")


def to_express(messages):
    from a2ui.inference_formats import direct_json
    from a2ui.inference_formats.express import ExpressDecompiler

    catalog = sdk_catalog()
    models = direct_json.DirectJsonParser([catalog]).compile(json.dumps(messages))
    return ExpressDecompiler([catalog], version="v0.9").decompile(models)


# ---- the regression net for SDK upgrades ----

def test_the_fixture_set_is_what_we_think_it_is():
    assert len(fixture_paths()) == 33  # the 18 mobile views and the 15 extension views


@pytest.mark.parametrize("path", fixture_paths(), ids=lambda path: path.name)
def test_every_fixture_survives_json_to_express_and_back(path):
    original = parse(path.read_text(encoding="utf-8"))
    compiled = parse(express_module.compile_express(to_express(original), "v0.9"))
    assert components_of(compiled) == components_of(original)
    assert data_model_of(compiled) == data_model_of(original)
    created = [m["createSurface"] for m in original if "createSurface" in m]
    assert [m["createSurface"] for m in compiled if "createSurface" in m] == created
    assert validate_module.validate("\n".join(map(json.dumps, compiled)))["ok"] == validate_module.validate(path.read_text(encoding="utf-8"))["ok"]


# No fixture carries a data model, so these two views cover bound inputs, button context paths and list templates.

FORM_COMPONENTS = [
    {"id": "root", "component": "Card", "child": "col"},
    {"id": "col", "component": "Column", "children": ["name", "serv", "diet", "dessert", "list", "go"]},
    {"id": "name", "component": "TextField", "label": "Name", "value": {"path": "/form/name"}},
    {"id": "serv", "component": "Slider", "label": "Servings", "min": 1, "max": 8, "value": {"path": "/form/servings"}},
    {"id": "diet", "component": "ChoicePicker", "label": "Diet", "options": [{"label": "None", "value": "none"}, {"label": "Veg", "value": "veg"}], "value": {"path": "/form/diet"}},
    {"id": "dessert", "component": "CheckBox", "label": "Dessert", "value": {"path": "/form/dessert"}},
    {"id": "list", "component": "List", "children": {"componentId": "row", "path": "/items"}},
    {"id": "row", "component": "Text", "text": {"path": "label"}},
    {"id": "go", "component": "Button", "child": "go-label", "action": {"event": {"name": "meal.submit", "context": {"name": {"path": "/form/name"}, "servings": {"path": "/form/servings"}}}}},
    {"id": "go-label", "component": "Text", "text": "Send"},
]
FORM_DATA = {"form": {"name": "", "servings": 2, "diet": ["none"], "dessert": False}, "items": [{"label": "Eggs", "n": 3}, {"label": "Milk", "n": 1}]}


def test_a_bound_form_with_a_list_template_survives_json_to_express_and_back():
    original = [
        {"version": "v0.9", "createSurface": {"surfaceId": "form-1", "catalogId": CATALOG}},
        {"version": "v0.9", "updateComponents": {"surfaceId": "form-1", "components": FORM_COMPONENTS}},
        {"version": "v0.9", "updateDataModel": {"surfaceId": "form-1", "path": "/", "value": FORM_DATA}},
    ]
    compiled = parse(express_module.compile_express(to_express(original), "v0.9"))
    assert components_of(compiled) == components_of(original)
    assert data_model_of(compiled) == FORM_DATA
    assert validate_module.validate("\n".join(map(json.dumps, compiled)))["ok"]


FORM_EXPRESS = (
    'surface("form_1")\n$/form = {name: "", servings: 2}\nroot = Card(col)\ncol = Column([name, serv, go])\n'
    'name = TextField("Name", $/form/name)\nserv = Slider("Servings", 1, 8, $/form/servings)\n'
    'go = Button(go_label, _, Event("meal.submit", {name: $/form/name, servings: $/form/servings}))\ngo_label = Text("Send")\n'
)


def test_a_form_compiles_and_validates_as_v0_9():
    compiled = parse(express_module.compile_express(FORM_EXPRESS, "v0.9"))
    assert data_model_of(compiled) == {"form": {"name": "", "servings": 2}}
    assert components_of(compiled)["name"]["value"] == {"path": "/form/name"}
    assert components_of(compiled)["go"]["action"]["event"]["context"] == {"name": {"path": "/form/name"}, "servings": {"path": "/form/servings"}}
    assert validate_module.validate("\n".join(map(json.dumps, compiled)))["ok"]


def test_the_same_form_compiles_and_validates_as_1_0():
    compiled = parse(express_module.compile_express(FORM_EXPRESS))
    assert [m["version"] for m in compiled] == ["1.0"]
    created = compiled[0]["createSurface"]
    assert created["dataModel"] == {"form": {"name": "", "servings": 2}}
    rows = {row["id"]: row for row in created["components"]}
    assert rows["name"]["value"] == {"@path": "/form/name"}
    assert rows["go"]["action"]["event"]["context"] == {"name": {"@path": "/form/name"}, "servings": {"@path": "/form/servings"}}
    assert validate_module.validate("\n".join(map(json.dumps, compiled)))["ok"]


# ---- the generated files stay in step with the contracts and the SDK ----

def test_committed_catalog_is_what_the_generator_builds():
    assert CATALOG_FILE.read_bytes().decode("utf-8").replace("\r\n", "\n") == generator.catalog_text(generator.build_catalog())


def test_committed_express_signatures_are_what_the_sdk_generates():
    built = generator.build_signatures(generator.build_catalog_v1_0(json.loads(generator.BASIC_V1_FILE.read_text(encoding="utf-8"))))
    assert generator.SIGNATURES_FILE.read_bytes().decode("utf-8").replace("\r\n", "\n") == built


def test_the_catalog_holds_the_48_drawable_components_under_the_id_the_plugin_uses():
    catalog = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    names = set(catalog["components"])
    assert len(names) == 48 and not names & {"AudioPlayer", "Video"}
    assert names == set(validate_module._get_schemas().names)
    assert catalog["catalogId"] == validate_module.CATALOG_ID


def test_every_express_example_in_the_skill_compiles_and_validates():
    text = (ROOT / "skills" / "a2ui" / "SKILL.md").read_text(encoding="utf-8")
    examples = [block for block in re.findall(r"```\n(.*?)\n```", text, re.S) if block.startswith("surface(")]
    assert len(examples) == 3
    for example in examples:
        compiled = express_module.compile_express(example)
        assert validate_module.validate(compiled)["ok"], example


def test_register_stays_offline_and_does_not_load_the_sdk():
    code = (
        "import importlib.util, sys, types\n"
        f"root = {str(ROOT)!r}\n"
        "spec = importlib.util.spec_from_file_location('hermes_a2ui_cold', root + '/__init__.py', submodule_search_locations=[root])\n"
        "module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)\n"
        "class Ctx:\n"
        "    def __getattr__(self, name): return lambda *a, **k: None\n"
        "module.register(Ctx())\n"
        "assert 'a2ui' not in sys.modules, 'register() imported the SDK'\n"
        "print('cold')\n"
    )
    done = subprocess.run([sys.executable, "-I", "-c", code], capture_output=True, encoding="utf-8")
    assert done.returncode == 0 and "cold" in done.stdout, done.stderr


# ---- the tool ----

def call(ctx, args, session="a", platform="desktop"):
    ctx.hooks["pre_llm_call"](session_id=session, platform=platform)
    return json.loads(ctx.tools["a2ui_present"]({"fallback_text": "Hello", **args}, session_id=session))


GOOD_EXPRESS = 'surface("hello")\nroot = Text("Hello", "h4")\n'


def saved_payload(result):
    saved = Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")
    return base64.b64decode(re.search(r"hermes-a2ui:payload ([A-Za-z0-9+/=]+) -->", saved).group(1)).decode("utf-8")


def test_express_is_drawn_and_saved_as_1_0_jsonl(plugin):
    ctx, _ = plugin
    result = call(ctx, {"express": GOOD_EXPRESS})
    assert result["ok"] and result["media"].startswith("MEDIA:"), result
    payload = saved_payload(result)
    assert payload.startswith('{"version": "1.0"')
    messages = parse(payload)
    assert [list(m)[1] for m in messages] == ["createSurface"]  # 1.0 carries the components inside createSurface
    assert messages[0]["createSurface"]["components"] == [{"id": "root", "component": "Text", "text": "Hello", "variant": "h4"}]


def test_a_tagged_program_is_also_accepted(plugin):
    ctx, _ = plugin
    assert call(ctx, {"express": f"<a2ui>\n{GOOD_EXPRESS}</a2ui>"})["ok"]


def test_payload_still_works(plugin):
    ctx, _ = plugin
    good = "\n".join(json.dumps(m) for m in (
        {"version": "v0.9", "createSurface": {"surfaceId": "s", "catalogId": CATALOG}},
        {"version": "v0.9", "updateComponents": {"surfaceId": "s", "components": [{"id": "root", "component": "Text", "text": "Hi"}]}},
    ))
    assert saved_payload(call(ctx, {"payload": good})) == good


def test_the_tool_schema_asks_for_one_of_the_two(plugin):
    ctx, _ = plugin
    module = sys.modules["hermes_a2ui_test.a2ui_core.tool"]
    assert set(module.SCHEMA["parameters"]["properties"]) == {"express", "payload", "fallback_text"}
    assert module.SCHEMA["parameters"]["required"] == ["fallback_text"]
    assert len(module.GUIDANCE) <= 600


@pytest.mark.parametrize("args", [
    {"express": GOOD_EXPRESS, "payload": "{}"},
    {},
    {"express": "  \n", "payload": ""},
    {"express": 5},
    {"payload": None},
])
def test_exactly_one_of_express_and_payload(plugin, args):
    ctx, _ = plugin
    result = call(ctx, args)
    assert result["ok"] is False and result["code"] == "bad_arguments" and result["fix"], result


def test_an_empty_payload_beside_express_is_not_a_second_view(plugin):
    ctx, _ = plugin
    assert call(ctx, {"express": GOOD_EXPRESS, "payload": ""})["ok"]


def test_express_over_the_size_limit_is_refused_before_compiling(plugin):
    ctx, _ = plugin
    result = call(ctx, {"express": "x" * (256 * 1024 + 1)})
    assert result["code"] == "invalid_express" and "256 KiB" in result["error"] and result["fix"]
    assert call(ctx, {"express": "x" * (256 * 1024)})["code"] == "invalid_express"  # at the limit it is compiled, and fails as text


@pytest.mark.parametrize("express,message", [
    ('surface("d")\nroot = Nope("x")\n', "Unknown component 'Nope'"),
    ('surface("d")\nroot = Text("x"\n', "Failed to parse"),
    ('surface("d")\nroot = Text("x", bogus=1)\n', "Property 'bogus' is not a valid property of component 'Text'"),
    ("surface('d')\nroot = Text('x')\n", "Syntax error"),  # a character the lexer rejects raises a plain SyntaxError
    ("```a2ui\nroot = Text(\"x\")\n```", "Syntax error"),
    ('surface("d")\nroot = ' + "Column([" * 3000 + 'Text("x")' + "])" * 3000, "recursion"),
])
def test_a_bad_program_returns_the_sdks_message(plugin, express, message):
    ctx, _ = plugin
    result = call(ctx, {"express": express})
    assert result["ok"] is False and result["code"] == "invalid_express", result
    assert message in result["error"] and len(result["error"]) <= 300
    assert "Correct the Express" in result["fix"]


def test_a_program_without_root_fails_the_plugins_own_check(plugin):
    ctx, _ = plugin
    result = call(ctx, {"express": 'surface("d")\na = Text("x")\n'})
    assert result["ok"] is False and result["code"] == "invalid_a2ui" and "Express" in result["fix"], result


def test_a_reference_to_a_missing_component_fails_the_plugins_own_check(plugin):
    ctx, _ = plugin
    assert call(ctx, {"express": 'surface("d")\nroot = Column([ghost])\n'})["code"] == "invalid_a2ui"


def test_without_the_sdk_express_is_unavailable_and_payload_still_works(plugin, monkeypatch):
    ctx, _ = plugin
    monkeypatch.setitem(sys.modules, "a2ui.core.catalog.catalog", None)
    result = call(ctx, {"express": GOOD_EXPRESS})
    assert result["ok"] is False and result["code"] == "express_unavailable" and "payload" in result["fix"], result
    good = "\n".join(json.dumps(m) for m in (
        {"version": "v0.9", "createSurface": {"surfaceId": "s", "catalogId": CATALOG}},
        {"version": "v0.9", "updateComponents": {"surfaceId": "s", "components": [{"id": "root", "component": "Text", "text": "Hi"}]}},
    ))
    assert call(ctx, {"payload": good})["ok"]


def test_a_catalog_that_cannot_be_read_is_unavailable_not_a_crash(plugin, monkeypatch):
    ctx, _ = plugin
    module = sys.modules["hermes_a2ui_test.a2ui_core.express"]
    monkeypatch.setitem(module.CATALOG_FILES, "1.0", Path("/nowhere/catalog.json"))
    assert call(ctx, {"express": GOOD_EXPRESS})["code"] == "express_unavailable"


def test_other_clients_get_text_for_express_too(plugin):
    ctx, folder = plugin
    result = call(ctx, {"express": GOOD_EXPRESS}, platform="telegram")
    assert result["ok"] and result["text"] == "Hello" and "media" not in result
    assert not (folder / "hermes-a2ui" / "surfaces").exists()


# ---- local images named inside Express still travel with the view ----

def quoted(path):
    return json.dumps(str(path))


def test_an_image_in_express_is_saved_with_the_view(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "a.png"
    image.write_bytes(PNG)
    result = call(ctx, {"express": f'surface("img")\nroot = Image({quoted(image)}, "A picture")\n'})
    assert result["ok"], result
    assert ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_before_after_media_in_express_is_saved_with_the_view(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "b.png"
    image.write_bytes(PNG)
    express = f'surface("ba")\nroot = BeforeAfterViewer("T", "B", "A", beforeMedia={quoted(image)}, afterMedia={quoted(image)})\n'
    result = call(ctx, {"express": express})
    assert result["ok"], result
    assert ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_an_image_bound_to_the_data_model_in_express_is_saved(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "c.png"
    image.write_bytes(PNG)
    express = f'surface("bound")\n$/photo = {quoted(image)}\nroot = Image($/photo, "A picture")\n'
    result = call(ctx, {"express": express})
    assert result["ok"], result
    assert ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_a_missing_image_in_express_says_so(plugin, tmp_path):
    ctx, _ = plugin
    result = call(ctx, {"express": f'surface("img")\nroot = Image({quoted(tmp_path / "gone.png")}, "A")\n'})
    assert result["code"] == "image_not_found" and result["fix"]


def test_text_that_looks_like_a_path_in_express_is_left_alone(plugin):
    ctx, _ = plugin
    assert call(ctx, {"express": 'surface("t")\nroot = Text("/nowhere/a.png")\n'})["ok"]
