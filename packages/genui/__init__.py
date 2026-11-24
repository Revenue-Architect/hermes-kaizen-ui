"""Hermes GenUI: draws A2UI and OpenUI views in the Desktop and Webapp chat, one toolset each. The renderer is desktop/plugin.js."""
from pathlib import Path

from . import host
from .a2ui_core import tool as a2ui_tool
from .openui_core import tool as openui_tool

_SKILLS = Path(__file__).parent / "skills"


def register(ctx) -> None:
    host.bind(ctx)
    openui_tool.bind(ctx)
    for name, toolset, tool in (("a2ui_present", "a2ui", a2ui_tool), ("openui_present", "openui", openui_tool)):
        ctx.register_tool(name=name, toolset=toolset, schema=tool.SCHEMA, handler=tool.present,
                          description=tool.SCHEMA["description"])
    ctx.register_hook("pre_llm_call", host.runtime.on_turn_start)
    ctx.register_hook("transform_llm_output", host.runtime.ensure_media_lines)
    ctx.register_skill("a2ui", _SKILLS / "a2ui" / "SKILL.md")
    ctx.register_skill("openui", _SKILLS / "openui" / "SKILL.md")
    ctx.register_system_prompt_section("hermes-genui", host.guidance, max_chars=1000)
