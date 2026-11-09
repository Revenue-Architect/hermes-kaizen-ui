"""Runs without Hermes: registration matches the manifest and the preliminary check accepts real programs."""
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
