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


def test_bundle_carries_calm_theme_card_slide_and_native_search():
    text = BUNDLE.read_text(encoding="utf-8")
    for piece in ("id: 'kaizen-theme'", "data-kz-calm", "startCardNav", "data-kz-nav", "data-kz-nav-instant",
                  "nav.commandPalette", "setTitleBarTheme", "data-narrow-overlay", "Kaizen Hanken"):
        assert piece in text, piece


def test_slide_opens_from_the_sidebar_button_only():
    source = (ROOT / "src" / "plugin.mjs").read_text(encoding="utf-8")
    controller = source[source.index("function startCardNav(ctx)"):]
    # Animated open: a pointer press on the top-left toggle (or its stand-in).
    assert "toggleButton()?.contains(element(event))) {\n      flip({ touch:" in controller
    # Keyboard paths (Enter/Space, Cmd/Ctrl+B) move the nav instantly, never animated.
    assert "if (event.detail === 0) {\n      flip({ instant: true });" in controller
    assert "flip({ instant: true });\n    }, 0);" in controller
    # No hover or timer opener exists.
    for forbidden in ("pointerenter", "mouseenter", "mouseover", "localStorage"):
        assert forbidden not in controller
    assert "search.hidden = available <" in controller
    assert "ctx.onDispose" in controller


def test_colors_and_finish_match_both_modes():
    source = (ROOT / "src" / "plugin.mjs").read_text(encoding="utf-8")
    css = (ROOT / "src" / "theme.css").read_text(encoding="utf-8")
    for color in ("#fbfbf9", "#1b1d1b", "#101111", "#efefec", "#2a2d28"):
        assert color in source
    assert "--kz-rail-active-bg: #282b27" in css
    assert "--kz-rail-active-bg: #cc3027" not in css
    assert "--conversation-text-base-size: .9375rem" in css
    assert "--chat-text-scale" not in source  # The core continues to own user scaling.
    # The stage is the dark Woday frame in both modes; no inverse light rail.
    assert "--kz-nav-stage: #101111" in css and "--kz-nav-stage: #fafafa" not in css
    assert "--kz-rail-bg: #fafafa" not in css
    assert "inset: 46px 14px 14px calc(var(--kz-nav-page-x) + 14px)" in css

