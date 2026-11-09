"""Hermes A2UI: draws A2UI v0.9 views in the Desktop and Webapp chat. The renderer is desktop/plugin.js."""
from pathlib import Path

from .a2ui_core import tool


def register(ctx) -> None:
    ctx.register_tool(name="a2ui_present", toolset="hermes-a2ui", schema=tool.SCHEMA, handler=tool.present,
                      description=tool.SCHEMA["description"])
    ctx.register_hook("pre_llm_call", tool.runtime.on_turn_start)
    ctx.register_hook("transform_llm_output", tool.runtime.ensure_media_lines)
    ctx.register_skill("a2ui", Path(__file__).parent / "skills" / "a2ui" / "SKILL.md")
    ctx.register_system_prompt_section("hermes-a2ui", tool.guidance, max_chars=600)
