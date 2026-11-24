"""Kaizen Views: draws A2UI and OpenUI views in the Desktop and Webapp chat, one toolset each. The renderer is desktop/plugin.js."""
from pathlib import Path

from . import host
from .a2ui_core import tool as a2ui_tool
from .openui_core import tool as openui_tool

_SKILLS = Path(__file__).parent / "skills"


def _register_skill(ctx, name: str) -> None:
    """Hermes lists a plugin skill with only the description register_skill is given, not the one in SKILL.md, so pass it.
    No requires_toolsets: Hermes judges it against the tools loaded up front, and plugin tools sit behind tool_search,
    so it would hide the skill even while its toolset is on (seen on v0.23.2)."""
    import yaml

    path = _SKILLS / name / "SKILL.md"
    frontmatter = yaml.safe_load(path.read_text(encoding="utf-8").split("---", 2)[1]) or {}
    ctx.register_skill(name, path, description=str(frontmatter.get("description", "")), frontmatter=frontmatter)


def register(ctx) -> None:
    host.bind(ctx)
    openui_tool.bind(ctx)
    for name, toolset, tool in (("a2ui_present", "a2ui", a2ui_tool), ("openui_present", "openui", openui_tool)):
        ctx.register_tool(name=name, toolset=toolset, schema=tool.SCHEMA, handler=tool.present,
                          description=tool.SCHEMA["description"])
    ctx.register_hook("pre_llm_call", host.runtime.on_turn_start)
    ctx.register_hook("transform_llm_output", host.runtime.ensure_media_lines)
    for name in ("a2ui", "openui"):
        _register_skill(ctx, name)
    ctx.register_system_prompt_section("kaizen-views", host.guidance, max_chars=1000)
