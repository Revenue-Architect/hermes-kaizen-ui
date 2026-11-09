"""Runs without Hermes: registration matches the manifest and the preliminary check accepts real programs."""
import base64
import importlib.util
import json
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
GOOD = 'root = Stack([card])\ncard = Card([TextContent("Hello (world")])'


class FakeCtx:
    def __init__(self):
        self.tools, self.hooks, self.skills, self.sections = {}, {}, {}, {}
        self.config = {}

    def get_config(self, key, default=None):
        return self.config.get(key, default)

    def register_tool(self, name, toolset, schema, handler, check_fn=None, requires_env=None, is_async=False,
                      description="", emoji="", override=False):
        self.tools[name] = handler

    def register_hook(self, name, callback):
        self.hooks[name] = callback

    def register_skill(self, name, path, description="", frontmatter=None):
        assert Path(path).is_file()
        self.skills[name] = path

    def register_system_prompt_section(self, name, content, position="after_memory", max_chars=None):
        self.sections[name] = content


@pytest.fixture()
def loaded(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("hermes_openui_test", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    monkeypatch.setattr(module.tool.runtime, "_data_dir", lambda name: tmp_path / name)
    ctx = FakeCtx()
    module.register(ctx)
    yield ctx, tmp_path, module
    for name in [key for key in sys.modules if key.startswith(spec.name)]:
        del sys.modules[name]


def present(ctx, program, session="a", fallback="Hello"):
    return json.loads(ctx.tools["openui_present"]({"program": program, "fallback_text": fallback}, session_id=session))


def test_registrations_match_manifest(loaded):
    ctx, _, _ = loaded
    manifest = yaml.safe_load((ROOT / "plugin.yaml").read_text(encoding="utf-8"))
    assert sorted(ctx.tools) == sorted(manifest["provides_tools"])
    assert sorted(ctx.hooks) == sorted(manifest["provides_hooks"])


def test_desktop_gets_media_and_other_clients_get_text(loaded):
    ctx, _, _ = loaded
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    ctx.hooks["pre_llm_call"](session_id="b", platform="telegram")
    assert present(ctx, GOOD, "a")["media"].startswith("MEDIA:")
    assert present(ctx, GOOD, "b")["text"] == "Hello"


def test_a_listed_platform_draws_everywhere_a_built_in_one_does(loaded):
    ctx, _, _ = loaded
    guidance = ctx.sections["hermes-openui"]
    ctx.hooks["pre_llm_call"](session_id="off", platform="cli")
    assert present(ctx, GOOD, "off")["text"] == "Hello" and guidance({"platform": "cli"}) == ""
    ctx.config["drawing_platforms"] = ["tui", " CLI"]
    ctx.hooks["pre_llm_call"](session_id="on", platform="cli")
    media = present(ctx, GOOD, "on")["media"]
    assert guidance({"platform": "cli"}) and guidance({"platform": "tui"})
    assert media in ctx.hooks["transform_llm_output"](response_text="Done.", session_id="on", platform="cli")
    ctx.hooks["pre_llm_call"](session_id="phone", platform="gui")
    assert present(ctx, GOOD, "phone")["text"] == "Hello" and guidance({"platform": "gui"}) == ""


@pytest.mark.parametrize("program, expected", [
    ("", "empty"),
    ("Stack([])", "root ="),
    ("root = Stack([", "Unclosed"),
    ("root = Stack([)]", "Unmatched"),
    ('root = Stack([Nope("x")])', "Unknown component: Nope"),
    ('root = Stack([Crad("x")])', "did you mean Card?"),
    ('root = Query("x")', "aren't available"),
    ('```openui\nroot = Stack([])\n```', "without a code fence"),
])
def test_rejects_with_a_usable_reason(loaded, program, expected):
    ctx, _, _ = loaded
    out = present(ctx, program)
    assert out["ok"] is False and out["code"] == "invalid_openui" and expected in out["error"]


@pytest.mark.parametrize("program", [
    'root = Stack([Button("Continue", Action([@ToAssistant("Continue")]))])',
    'root = Stack([TextContent("Type ``` to start a code fence")])',
    "root = Stack([TextContent('Hello (world')])",
    'root = Stack([TextContent("ok")])\n# explanation (',
    'root = Stack([TextContent("ok")]) // trailing [ note',
])
def test_accepts_valid_programs_with_awkward_text(loaded, program):
    _, _, module = loaded
    assert module.tool.check(program) == {"ok": True}


def test_every_library_example_passes(loaded):
    _, _, module = loaded
    examples = json.loads((ROOT / "tests" / "fixtures" / "examples.json").read_text(encoding="utf-8"))
    assert examples
    for name, program in examples.items():
        assert module.tool.check(program) == {"ok": True}, name


def test_saves_through_the_real_plugin_storage_path(tmp_path, monkeypatch):
    import types

    storage = types.ModuleType("plugins.plugin_storage")
    storage.plugin_data_dir = lambda name: tmp_path / name
    monkeypatch.setitem(sys.modules, "plugins", types.ModuleType("plugins"))
    monkeypatch.setitem(sys.modules, "plugins.plugin_storage", storage)
    spec = importlib.util.spec_from_file_location("hermes_openui_real", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    ctx = FakeCtx()
    module.register(ctx)
    ctx.hooks["pre_llm_call"](session_id="real", platform="desktop")
    out = json.loads(ctx.tools["openui_present"]({"program": GOOD, "fallback_text": "Hello"}, session_id="real"))
    assert out["media"].startswith("MEDIA:") and (tmp_path / "hermes-openui" / "surfaces").is_dir()
    assert (tmp_path / "hermes-surface-delivery" / "pending").is_dir()
    for name in [key for key in sys.modules if key.startswith(spec.name)]:
        del sys.modules[name]


PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


def test_local_image_is_saved_and_the_program_is_unchanged(loaded):
    ctx, tmp_path, module = loaded
    image = tmp_path / "photo.png"
    image.write_bytes(PNG)
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    program = f'root = Stack([ImageBlock("{image.as_posix()}", "A photo")])'
    result = present(ctx, program)
    assert result["ok"], result
    saved = Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")
    assert ":image " in saved
    encoded = saved.split(":payload ")[1].split(" -->")[0]
    assert base64.b64decode(encoded).decode("utf-8") == program


def test_windows_path_in_a_string_is_read_as_the_parser_reads_it(loaded):
    _, _, module = loaded
    values = sys.modules["hermes_openui_test.openui_core.check"].string_values(r'''root = Stack([ImageBlock("C:\pics\a.png", 'it\'s')])''')
    assert values == [r"C:\pics\a.png", "it's"]


def test_commented_paths_are_ignored(loaded):
    ctx, _, _ = loaded
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    assert present(ctx, '# "/nowhere/a.png"\nroot = Stack([TextContent("hi")])')["ok"]


def test_missing_local_image_gets_an_exact_reason(loaded):
    ctx, _, _ = loaded
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    result = present(ctx, 'root = Stack([ImageBlock("/nowhere/a.png", "A")])')
    assert result["code"] == "image_not_found" and "/nowhere/a.png" in result["error"]


DASHBOARD = '''root = Dashboard([section])
rows = Query("crm.list", {}, [])
section = Section([CardRow([LargeCard([Table([Col("Name", rows.name)])])])])'''


def desktop(ctx):
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")


def test_dashboard_with_a_listed_source_is_delivered_with_its_backend(loaded):
    ctx, _, _ = loaded
    ctx.config["dashboard_sources"] = ["crm.list"]
    desktop(ctx)
    first = present(ctx, DASHBOARD)
    second = present(ctx, DASHBOARD)
    assert first["ok"] and first["media"].startswith("MEDIA:")
    assert first["backend_id"] and first["backend_id"] == second["backend_id"]


def test_ordinary_views_carry_no_backend(loaded):
    ctx, _, _ = loaded
    desktop(ctx)
    assert "backend_id" not in present(ctx, GOOD)


def test_every_dashboard_example_passes_with_its_sources(loaded):
    ctx, _, _ = loaded
    examples = json.loads((ROOT / "tests" / "fixtures" / "dashboard-examples.json").read_text(encoding="utf-8"))
    ctx.config["dashboard_sources"] = ["crm.get_pipeline", "status.get_health"]
    desktop(ctx)
    for program in examples.values():
        assert present(ctx, program)["ok"]


def test_dashboards_without_setup_say_exactly_what_to_add(loaded):
    ctx, _, _ = loaded
    desktop(ctx)
    result = present(ctx, DASHBOARD)
    assert not result["ok"]
    assert "mcp_allowlist" in result["fix"] and "dashboard_sources" in result["fix"]


@pytest.mark.parametrize("program,expected", [
    (DASHBOARD.replace("crm.list", "crm.delete"), "listed"),
    (DASHBOARD.replace('Query("crm.list"', "Query(source"), "literal"),
    (DASHBOARD + '\nsave = Mutation("crm.list", {})', "only read"),
    ('root = Dashboard([DashboardHeader("Hi")])', "at least one Query"),
    (DASHBOARD.replace("Table(", "Tablet("), "Unknown component"),
])
def test_bad_dashboards_get_a_usable_reason(loaded, program, expected):
    ctx, _, _ = loaded
    ctx.config["dashboard_sources"] = ["crm.list"]
    desktop(ctx)
    result = present(ctx, program)
    assert not result["ok"] and expected in result["error"]


def test_too_many_queries(loaded):
    ctx, _, _ = loaded
    ctx.config["dashboard_sources"] = ["crm.list"]
    desktop(ctx)
    extra = "".join(f'\nq{n} = Query("crm.list", {{}}, [])' for n in range(7))
    assert "At most" in present(ctx, DASHBOARD + extra)["error"]


def test_query_is_still_refused_in_ordinary_views(loaded):
    ctx, _, _ = loaded
    ctx.config["dashboard_sources"] = ["crm.list"]
    desktop(ctx)
    result = present(ctx, 'root = Stack([TextContent(d.title)])\nd = Query("crm.list", {}, {title: ""})')
    assert not result["ok"] and "Query()" in result["error"]


def test_source_named_in_a_comment_or_text_is_not_a_query(loaded):
    ctx, _, _ = loaded
    ctx.config["dashboard_sources"] = ["crm.list"]
    desktop(ctx)
    assert present(ctx, '# Query("crm.delete", {}, [])\n' + DASHBOARD)["ok"]
    program = DASHBOARD.replace('Col("Name"', 'Col("Query(x)"')
    assert present(ctx, program)["ok"]


def test_guidance_names_sources_only_when_set_up(loaded):
    ctx, _, _ = loaded
    section = ctx.sections["hermes-openui"]
    assert "Live dashboards" not in section({"platform": "desktop"})
    ctx.config["dashboard_sources"] = ["crm.list"]
    assert "crm.list" in section({"platform": "desktop"})
    assert section({"platform": "telegram"}) == ""


def test_route_finds_the_plugin_context(loaded):
    ctx, _, module = loaded
    holder = sys.modules[module.tool.HOLDER]
    assert holder.ctx is ctx and holder.backend_id() == module.tool.backend_id()


def test_backend_manifest_points_at_the_route():
    manifest = json.loads((ROOT / "dashboard" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["name"] == "hermes-openui" and manifest["tab"]["hidden"] is True
    assert (ROOT / "dashboard" / manifest["api"]).is_file() and (ROOT / "dashboard" / manifest["entry"]).is_file()


def test_a_path_in_ordinary_text_is_left_alone(loaded):
    ctx, _, _ = loaded
    desktop(ctx)
    assert present(ctx, 'root = Stack([TextContent("/nowhere/report.png")])')["ok"]


def _has_saved_image(result):
    return ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_an_image_reached_through_a_variable_is_saved(loaded):
    ctx, tmp_path, _ = loaded
    image = tmp_path / "photo.png"
    image.write_bytes(PNG)
    desktop(ctx)
    result = present(ctx, f'src = "{image.as_posix()}"\nblock = ImageBlock(src, "A")\nroot = Stack([block])')
    assert result["ok"] and _has_saved_image(result)


def test_a_missing_image_through_a_variable_says_so(loaded):
    ctx, _, _ = loaded
    desktop(ctx)
    result = present(ctx, 'src = "/nowhere/a.png"\nroot = Stack([ImageBlock(src, "A")])')
    assert result["code"] == "image_not_found"


def test_an_unused_path_variable_is_left_alone(loaded):
    ctx, _, _ = loaded
    desktop(ctx)
    assert present(ctx, 'note = "/nowhere/a.png"\nroot = Stack([TextContent(note)])')["ok"]


def test_image_components_come_from_the_library():
    catalog = json.loads((ROOT / "openui_core" / "catalog.json").read_text(encoding="utf-8"))
    assert {"ImageBlock", "ImageGallery"} <= set(catalog["image_components"])
    assert "TextContent" not in catalog["image_components"]


@pytest.mark.parametrize("program", [
    'root = Stack([ListBlock([ListItem("/nowhere/report.png")])])',
    'root = Stack([ImageBlock("https://example.com/a.png", "/nowhere/alt.png")])',
    'name = "/nowhere/a.png"\nroot = Stack([ListBlock([ListItem(name)])])',
])
def test_a_path_in_a_non_image_field_is_left_alone(loaded, program):
    ctx, _, _ = loaded
    desktop(ctx)
    result = present(ctx, program)
    assert result["ok"], result


def test_image_fields_inside_objects_are_found_by_name(loaded):
    _, _, module = loaded
    check = sys.modules["hermes_openui_test.openui_core.check"]
    catalog = json.loads((ROOT / "openui_core" / "catalog.json").read_text(encoding="utf-8"))
    position = catalog["image_components"]["ImageGallery"][0]
    filler = "null, " * position
    values = check.image_values(f'root = Stack([ImageGallery({filler}[{{src: "/a.png", details: "/b.png"}}])])')
    assert values == ["/a.png"]


def test_a_ternary_inside_an_image_field_still_counts(loaded):
    _, _, _ = loaded
    check = sys.modules["hermes_openui_test.openui_core.check"]
    assert check.image_values('root = Stack([ImageBlock(flag ? "/a.png" : "/b.png", "A")])') == ["/a.png", "/b.png"]


@pytest.mark.parametrize("program", [
    'photos = [{src: "https://example.com/a.png", details: "/nowhere/report.png"}]\nroot = Stack([ImageGallery(photos)])',
    'root = Stack([ContextCardBlock([ContextCardItem("id", "Title", "Body", "gray", "https://example.com/a.png", "/nowhere/alt.png")])])',
])
def test_alt_text_and_other_fields_are_not_images(loaded, program):
    ctx, _, _ = loaded
    desktop(ctx)
    result = present(ctx, program)
    assert result["ok"], result


def test_an_image_field_inside_a_variable_is_still_read(loaded):
    ctx, tmp_path, _ = loaded
    image = tmp_path / "photo.png"
    image.write_bytes(PNG)
    desktop(ctx)
    result = present(ctx, f'photos = [{{src: "{image.as_posix()}", details: "/nowhere/report.png"}}]\nroot = Stack([ImageGallery(photos)])')
    assert result["ok"] and _has_saved_image(result)
