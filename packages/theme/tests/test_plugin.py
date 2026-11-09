"""Runs without Hermes: the manifest is honest and the shipped bundle still holds the card nav."""
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


def test_bundle_carries_theme_and_card_nav():
    text = BUNDLE.read_text(encoding="utf-8")
    for piece in ("id: 'kaizen-theme'", "startCardNav", "data-kz-nav", "data-kz-nav-instant",
                  "setTitleBarTheme", "data-narrow-overlay", "Kaizen Hanken"):
        assert piece in text, piece
