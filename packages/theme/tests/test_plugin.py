"""Runs without Hermes: honest manifest, reproducible theme, native navigation."""
import importlib.util
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "desktop" / "plugin.js"


class FakeCtx:
    def __getattr__(self, name):
        raise AssertionError(f"the theme's agent half must not call ctx.{name}")


def test_register_adds_nothing_and_manifest_agrees():
    spec = importlib.util.spec_from_file_location("kaizen_theme_plugin", ROOT / "__init__.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.register(FakeCtx())
    manifest = yaml.safe_load((ROOT / "plugin.yaml").read_text(encoding="utf-8"))
    assert manifest["name"] == "kaizen-theme"
    assert manifest["provides_tools"] == [] and manifest["provides_hooks"] == []


def test_bundle_is_current():
    before = BUNDLE.read_bytes()
    subprocess.run(["node", "build.mjs"], cwd=ROOT, check=True, capture_output=True)
    assert BUNDLE.read_bytes() == before, "run node build.mjs and commit desktop/plugin.js"


def test_bundle_carries_calm_theme_and_native_actions():
    text = BUNDLE.read_text(encoding="utf-8")
    for piece in ("id: 'kaizen-theme'", "data-kz-calm", "nav.commandPalette",
                  "view.toggleSidebar", "setTitleBarTheme", "data-narrow-overlay", "Kaizen Hanken"):
        assert piece in text, piece


def test_calm_navigation_does_not_intercept_or_rewrite_saved_layout():
    source = (ROOT / "src" / "plugin.mjs").read_text(encoding="utf-8")
    controller = source[source.index("function startCardNav(ctx)"):]
    for forbidden in ("stopImmediatePropagation", "preventDefault", "localStorage", "ctx.setInterval", "data-kz-nav', next"):
        assert forbidden not in controller
    assert "attributeFilter: ['data-hermes-theme', 'data-hermes-mode']" in controller
    assert "ctx.onDispose" in controller
    assert "search.hidden = available <" in controller


def test_colors_and_finish_match_both_modes():
    source = (ROOT / "src" / "plugin.mjs").read_text(encoding="utf-8")
    css = (ROOT / "src" / "theme.css").read_text(encoding="utf-8")
    for color in ("#fbfbf9", "#1b1d1b", "#101111", "#efefec", "#2a2d28"):
        assert color in source
    assert "--kz-rail-active-bg: #282b27" in css
    assert "--kz-rail-active-bg: #cc3027" not in css
    assert "--conversation-text-base-size: .9375rem" in css
    assert "--chat-text-scale" not in source  # The core continues to own user scaling.
    assert "transform: translate3d(var(--kz-nav-page-x)" not in css

