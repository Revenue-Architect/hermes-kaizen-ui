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


class FakeCtx:
    def __init__(self):
        self.tools, self.hooks, self.skills, self.sections = {}, {}, {}, {}

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
