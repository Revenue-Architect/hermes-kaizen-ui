"""Hermes OpenUI: draws OpenUI Lang views in the Desktop and Webapp chat. The renderer is desktop/plugin.js."""
from pathlib import Path

from .openui_core import tool


def register(ctx) -> None:
    tool.bind(ctx)
    ctx.register_tool(name="openui_present", toolset="hermes-openui", schema=tool.SCHEMA, handler=tool.present,
                      description=tool.SCHEMA["description"])
    ctx.register_hook("pre_llm_call", tool.runtime.on_turn_start)
    ctx.register_hook("transform_llm_output", tool.runtime.ensure_media_lines)
    ctx.register_skill("openui", Path(__file__).parent / "skills" / "openui" / "SKILL.md")
    ctx.register_system_prompt_section("hermes-openui", tool.guidance, max_chars=1000)
