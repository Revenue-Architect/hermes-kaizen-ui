"""Runs without Hermes: registration matches the manifest and the tool behaves per surface."""
import importlib.util
import json
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
CATALOG = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
GOOD = "\n".join(json.dumps(line) for line in (
    {"version": "v0.9", "createSurface": {"surfaceId": "s", "catalogId": CATALOG}},
    {"version": "v0.9", "updateComponents": {"surfaceId": "s", "components": [{"id": "root", "component": "Text", "text": "Hello"}]}},
))


PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


def image_payload(component):
    return "\n".join(json.dumps(line) for line in (
        {"version": "v0.9", "createSurface": {"surfaceId": "s", "catalogId": CATALOG}},
        {"version": "v0.9", "updateComponents": {"surfaceId": "s", "components": [component]}},
    ))


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
def plugin(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("hermes_a2ui_test", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    monkeypatch.setattr(module.tool.runtime, "_data_dir", lambda name: tmp_path / name)
    ctx = FakeCtx()
    module.register(ctx)
    yield ctx, tmp_path
    for name in [key for key in sys.modules if key.startswith(spec.name)]:
        del sys.modules[name]


def test_registrations_match_manifest(plugin):
    ctx, _ = plugin
    manifest = yaml.safe_load((ROOT / "plugin.yaml").read_text(encoding="utf-8"))
    assert sorted(ctx.tools) == sorted(manifest["provides_tools"])
    assert sorted(ctx.hooks) == sorted(manifest["provides_hooks"])
    assert "a2ui" in ctx.skills


def present(ctx, session, payload=GOOD, fallback="Hello"):
    return json.loads(ctx.tools["a2ui_present"]({"payload": payload, "fallback_text": fallback}, session_id=session))


def test_desktop_gets_media_with_embedded_payload(plugin):
    ctx, folder = plugin
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    out = present(ctx, "a")
    assert out["ok"] and out["media"].startswith("MEDIA:")
    saved = next((folder / "hermes-a2ui" / "surfaces").glob("*.md")).read_text(encoding="utf-8")
    assert "hermes-a2ui:payload" in saved and "Hello" in saved


def test_a_listed_platform_draws_everywhere_a_built_in_one_does(plugin):
    ctx, _ = plugin
    guidance = ctx.sections["hermes-a2ui"]
    ctx.hooks["pre_llm_call"](session_id="off", platform="tui")
    assert "text" in present(ctx, "off") and guidance({"platform": "tui"}) == ""
    ctx.config["drawing_platforms"] = ["TUI ", "cli"]
    ctx.hooks["pre_llm_call"](session_id="on", platform="tui")
    media = present(ctx, "on")["media"]
    assert guidance({"platform": "tui"}) and guidance({"platform": "cli"})
    assert media in ctx.hooks["transform_llm_output"](response_text="Done.", session_id="on", platform="tui")
    ctx.hooks["pre_llm_call"](session_id="phone", platform="gui")
    assert "text" in present(ctx, "phone") and guidance({"platform": "gui"}) == ""


@pytest.mark.parametrize("bad", ["tui", {"tui": True}, None, 7])
def test_a_malformed_platform_setting_changes_nothing(plugin, bad):
    ctx, _ = plugin
    ctx.config["drawing_platforms"] = bad
    ctx.hooks["pre_llm_call"](session_id="a", platform="tui")
    ctx.hooks["pre_llm_call"](session_id="b", platform="desktop")
    assert "text" in present(ctx, "a") and "media" in present(ctx, "b")


def test_an_unreadable_platform_setting_changes_nothing(plugin, monkeypatch):
    ctx, _ = plugin
    monkeypatch.setattr(ctx, "get_config", lambda *_: (_ for _ in ()).throw(RuntimeError("config")))
    ctx.hooks["pre_llm_call"](session_id="a", platform="tui")
    assert "text" in present(ctx, "a")


def test_other_clients_get_text(plugin):
    ctx, folder = plugin
    ctx.hooks["pre_llm_call"](session_id="b", platform="telegram")
    out = present(ctx, "b")
    assert out["text"] == "Hello" and "media" not in out
    assert not (folder / "hermes-a2ui" / "surfaces").exists()


def test_invalid_payload_returns_a_fixable_error(plugin):
    ctx, _ = plugin
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    out = present(ctx, "a", payload='{"version":"v0.9"}')
    assert out["ok"] is False and out["code"] == "invalid_a2ui" and out["fix"]


def test_missing_fallback_is_refused(plugin):
    ctx, _ = plugin
    assert present(ctx, "a", fallback=" ")["code"] == "missing_fallback"


def test_forgotten_media_line_is_appended_once(plugin):
    ctx, _ = plugin
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    media = present(ctx, "a")["media"]
    transform = ctx.hooks["transform_llm_output"]
    assert transform(response_text="Done.", session_id="a", platform="desktop") == f"Done.\n\n{media}"
    assert transform(response_text="Again.", session_id="a", platform="desktop") is None


def test_present_media_line_is_left_alone(plugin):
    ctx, _ = plugin
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    media = present(ctx, "a")["media"]
    assert ctx.hooks["transform_llm_output"](response_text=f"Done.\n\n{media}", session_id="a", platform="desktop") is None


def test_naming_the_file_does_not_count_as_delivering_it(plugin):
    ctx, _ = plugin
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    media = present(ctx, "a")["media"]
    reply = f"Saved at {media[len('MEDIA:'):]}"
    assert ctx.hooks["transform_llm_output"](response_text=reply, session_id="a", platform="desktop") == f"{reply}\n\n{media}"


def test_an_interrupted_turn_does_not_leak_into_the_next(plugin):
    ctx, _ = plugin
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    present(ctx, "a")
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    assert ctx.hooks["transform_llm_output"](response_text="Fresh.", session_id="a", platform="desktop") is None


def test_one_hook_delivers_for_both_plugins(plugin, tmp_path):
    ctx, _ = plugin
    from importlib import import_module

    runtime_module = import_module(ctx.hooks["pre_llm_call"].__self__.__class__.__module__)
    other = runtime_module.SurfaceRuntime("hermes-openui", lambda name: tmp_path / name)
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    other.on_turn_start(session_id="a", platform="desktop")
    first = present(ctx, "a")["media"]
    second = json.loads(other.deliver("a", "program", "Hello"))["media"]
    combined = ctx.hooks["transform_llm_output"](response_text="Done.", session_id="a", platform="desktop")
    assert first in combined and second in combined
    assert other.ensure_media_lines(response_text="Done.", session_id="a", platform="desktop") is None


def test_a_file_that_vanishes_during_cleanup_is_harmless(plugin, monkeypatch):
    ctx, folder = plugin
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    runtime = ctx.hooks["pre_llm_call"].__self__
    present(ctx, "a")
    module = sys.modules[type(runtime).__module__]
    monkeypatch.setattr(module, "MAX_SURFACE_FILES", 0)
    monkeypatch.setattr(module, "_remove", lambda path: False)
    assert present(ctx, "a")["ok"] is True


def test_guidance_only_where_views_draw(plugin):
    ctx, _ = plugin
    section = ctx.sections["hermes-a2ui"]
    assert section({"platform": "desktop"}) and not section({"platform": "cli"})


def test_saves_through_the_real_plugin_storage_path(tmp_path, monkeypatch):
    import types

    storage = types.ModuleType("plugins.plugin_storage")
    storage.plugin_data_dir = lambda name: tmp_path / name
    monkeypatch.setitem(sys.modules, "plugins", types.ModuleType("plugins"))
    monkeypatch.setitem(sys.modules, "plugins.plugin_storage", storage)
    spec = importlib.util.spec_from_file_location("hermes_a2ui_real", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    ctx = FakeCtx()
    module.register(ctx)
    ctx.hooks["pre_llm_call"](session_id="real", platform="desktop")
    out = json.loads(ctx.tools["a2ui_present"]({"payload": GOOD, "fallback_text": "Hello"}, session_id="real"))
    assert out["media"].startswith("MEDIA:") and (tmp_path / "hermes-a2ui" / "surfaces").is_dir()
    assert (tmp_path / "hermes-surface-delivery" / "pending").is_dir()
    for name in [key for key in sys.modules if key.startswith(spec.name)]:
        del sys.modules[name]


def present_image(ctx, component, session="a"):
    ctx.hooks["pre_llm_call"](session_id=session, platform="desktop")
    return json.loads(ctx.tools["a2ui_present"]({"payload": image_payload(component), "fallback_text": "Hello"}, session_id=session))


def test_local_image_is_saved_beside_the_payload(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "a.png"
    image.write_bytes(PNG)
    result = present_image(ctx, {"id": "root", "component": "Image", "url": str(image), "description": "A"})
    assert result["ok"], result
    saved = Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")
    assert ":image " in saved and "image/png" in saved
    assert "base64" not in result["media"]


def test_media_slot_images_are_saved_too(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "b.png"
    image.write_bytes(PNG)
    result = present_image(ctx, {"id": "root", "component": "BeforeAfterViewer", "title": "T", "before": "B", "after": "A", "beforeMedia": str(image), "afterMedia": str(image)})
    assert result["ok"], result
    assert ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_text_that_looks_like_a_path_is_left_alone(plugin):
    ctx, _ = plugin
    assert present_image(ctx, {"id": "root", "component": "Text", "text": "/nowhere/a.png"})["ok"]


@pytest.mark.parametrize("make,code", [
    (None, "image_not_found"),
    (lambda path: path.write_text("not an image"), "image_unsupported"),
    (lambda path: path.write_bytes(PNG + b"0" * (5 * 1024 * 1024)), "image_too_large"),
])
def test_bad_images_get_an_exact_reason(plugin, tmp_path, make, code):
    ctx, _ = plugin
    image = tmp_path / "bad.png"
    if make:
        make(image)
    result = present_image(ctx, {"id": "root", "component": "Image", "url": str(image), "description": "A"})
    assert result["code"] == code and str(image) in result["error"] and result["fix"]


def test_view_image_limit_counts_every_image(plugin, tmp_path):
    ctx, _ = plugin
    module = sys.modules["hermes_a2ui_test.a2ui_core.surface_runtime"]
    paths = []
    for index in range(3):
        path = tmp_path / f"{index}.png"
        path.write_bytes(PNG + b"0" * (4 * 1024 * 1024))
        paths.append(str(path))
    images, problem = module.read_images(paths[:2])
    assert len(images) == 2 and problem is None
    _, problem = module.read_images(paths)
    assert problem["code"] == "images_too_large"


def test_exact_size_limit_is_allowed(plugin, tmp_path):
    module = sys.modules["hermes_a2ui_test.a2ui_core.surface_runtime"]
    path = tmp_path / "edge.png"
    path.write_bytes(PNG + b"0" * (module.MAX_IMAGE_BYTES - len(PNG)))
    images, problem = module.read_images([str(path)])
    assert problem is None and len(images) == 1


def test_other_clients_dont_read_images(plugin):
    ctx, _ = plugin
    ctx.hooks["pre_llm_call"](session_id="tg", platform="telegram")
    result = json.loads(ctx.tools["a2ui_present"]({"payload": image_payload({"id": "root", "component": "Image", "url": "/missing/a.png", "description": "A"}), "fallback_text": "Hello"}, session_id="tg"))
    assert result["ok"] and result["text"] == "Hello"


def test_folder_stays_under_the_size_cap(plugin, tmp_path, monkeypatch):
    ctx, _ = plugin
    module = sys.modules["hermes_a2ui_test.a2ui_core.surface_runtime"]
    monkeypatch.setattr(module, "MAX_SURFACE_FOLDER_BYTES", 1024)
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    fallback = "x" * 900
    for _ in range(3):
        result = json.loads(ctx.tools["a2ui_present"]({"payload": GOOD, "fallback_text": fallback}, session_id="a"))
        assert result["ok"]
    folder = Path(result["media"].removeprefix("MEDIA:")).parent
    assert Path(result["media"].removeprefix("MEDIA:")).exists()
    assert sum(item.stat().st_size for item in folder.glob("*.md")) <= 2 * 1024 + 900


def test_the_view_just_written_survives_a_pruning_tie(plugin, tmp_path, monkeypatch):
    """ZFS gave consecutive files the same mtime, so the sort could not tell which was newest and the cap dropped the new view."""
    import os

    ctx, _ = plugin
    module = sys.modules["hermes_a2ui_test.a2ui_core.surface_runtime"]
    monkeypatch.setattr(module, "MAX_SURFACE_FILES", 1)
    runtime = sys.modules["hermes_a2ui_test.a2ui_core.tool"].runtime
    folder = tmp_path / "ties"
    folder.mkdir()
    for kept in range(3):
        files = [folder / f"{index}.md" for index in range(3)]
        for file in files:
            file.write_text("x", encoding="utf-8")
            os.utime(file, ns=(1_000_000_000, 1_000_000_000))
        runtime._prune(folder, keep=files[kept])
        assert [file.exists() for file in files] == [index == kept for index in range(3)]
        for file in files:
            file.unlink(missing_ok=True)


def bound_payload(component, value, path="/"):
    return "\n".join(json.dumps(line) for line in (
        {"version": "v0.9", "createSurface": {"surfaceId": "s", "catalogId": CATALOG}},
        {"version": "v0.9", "updateDataModel": {"surfaceId": "s", "path": path, "value": value}},
        {"version": "v0.9", "updateComponents": {"surfaceId": "s", "components": [component]}},
    ))


def present_payload(ctx, payload):
    ctx.hooks["pre_llm_call"](session_id="a", platform="desktop")
    return json.loads(ctx.tools["a2ui_present"]({"payload": payload, "fallback_text": "Hello"}, session_id="a"))


def test_bound_image_is_read_and_unrelated_data_is_not(plugin, tmp_path):
    ctx, _ = plugin
    image = tmp_path / "bound.png"
    image.write_bytes(PNG)
    component = {"id": "root", "component": "Image", "url": {"path": "/photo"}, "description": "A"}
    result = present_payload(ctx, bound_payload(component, {"photo": str(image), "note": "/nowhere/report.png"}))
    assert result["ok"], result
    assert ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_missing_bound_image_says_so(plugin):
    ctx, _ = plugin
    component = {"id": "root", "component": "Image", "url": {"path": "/photo"}, "description": "A"}
    assert present_payload(ctx, bound_payload(component, {"photo": "/nowhere/a.png"}))["code"] == "image_not_found"


def test_a_saved_file_too_large_for_hermes_to_read_back_is_refused(plugin, tmp_path, monkeypatch):
    ctx, _ = plugin
    module = sys.modules["hermes_a2ui_test.a2ui_core.surface_runtime"]
    image = tmp_path / "a.png"
    image.write_bytes(PNG + b"0" * 4000)
    monkeypatch.setattr(module, "MAX_SAVED_FILE_BYTES", 3000)
    result = present_image(ctx, {"id": "root", "component": "Image", "url": str(image), "description": "A"})
    assert result["code"] == "view_too_large" and result["fix"]
    assert not list((tmp_path / "hermes-a2ui" / "surfaces").glob("*.md"))


def test_limits_fit_what_hermes_reads_back():
    spec = importlib.util.spec_from_file_location("surface_limits", ROOT / "a2ui_core" / "surface_runtime.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    assert module.MAX_VIEW_IMAGE_BYTES * 4 / 3 < module.MAX_SAVED_FILE_BYTES == 16 * 1024 * 1024


@pytest.mark.parametrize("binding", ["photo/url", "/photo/url"])
def test_bound_image_follows_the_renderers_path_rules(plugin, tmp_path, binding):
    ctx, _ = plugin
    image = tmp_path / "nested.png"
    image.write_bytes(PNG)
    component = {"id": "root", "component": "Image", "url": {"path": binding}, "description": "A"}
    result = present_payload(ctx, bound_payload(component, {"photo": {"url": str(image)}}))
    assert result["ok"], result
    assert ":image " in Path(result["media"].removeprefix("MEDIA:")).read_text(encoding="utf-8")


def test_a_same_named_field_elsewhere_is_not_an_image(plugin):
    ctx, _ = plugin
    component = {"id": "root", "component": "Image", "url": {"path": "photo"}, "description": "A"}
    result = present_payload(ctx, bound_payload(component, {"other": {"photo": "/nowhere/a.png"}}))
    assert result["ok"], result
