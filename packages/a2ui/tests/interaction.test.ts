import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveActionContext, serializeInteraction } from "../src/interactions/serialize";
import { resolveBinding, updateDataModel } from "../src/validation/bindings";
import type { UiAction } from "../src/types";

describe("mobile interaction envelope", () => {
  it("matches the captured GenUI v0.9 action envelope", () => {
    const expected = JSON.parse(readFileSync(join(process.cwd(), "fixtures", "mobile", "interaction-envelope.json"), "utf8"));
    const actual = serializeInteraction({
      surfaceId: "synthetic-review-152",
      sourceComponentId: "cite-action",
      name: "document.explain_citation",
      context: expected.action.context,
    } satisfies UiAction, "2026-10-08T12:00:00.000Z");
    expect(actual).toBe(`[A2UI_INTERACTION]\n${JSON.stringify(expected)}`);
  });

  it("resolves only mobile data bindings and leaves local changes immutable", () => {
    const source = { profile: { pace: 4 }, list: ["a", "b"] };
    expect(resolveBinding({ path: "/profile/pace" }, source)).toBe(4);
    expect(resolveBinding({ call: "formatNumber", args: { value: 4 } }, source)).toEqual({ call: "formatNumber", args: { value: 4 } });
    expect(resolveBinding({ path: "/missing" }, source)).toBeUndefined();
    const updated = updateDataModel(source, "/profile/pace", 6);
    expect(updated).toEqual({ profile: { pace: 6 }, list: ["a", "b"] });
    expect(source.profile.pace).toBe(4);
    expect(() => updateDataModel(source, "/__proto__/polluted", true)).toThrow();
    expect(() => resolveBinding({ path: "/constructor/prototype" }, source)).toThrow();
  });

  it("resolves top-level action bindings before serialization", () => {
    const context = resolveActionContext({ pace: { path: "/profile/pace" }, list: ["a", "b"] }, { profile: { pace: 5 } });
    expect(context).toEqual({ pace: 5, list: ["a", "b"] });
    const interaction = JSON.parse(serializeInteraction({ surfaceId: "s", sourceComponentId: "go", name: "plan.open", context }, "2026-10-08T12:00:00.000Z").slice("[A2UI_INTERACTION]\n".length));
    expect(interaction.action.context.pace).toBe(5);
  });

  it("rejects malformed action names and unsafe contexts", () => {
    expect(() => serializeInteraction({ surfaceId: "s", sourceComponentId: "b", name: "unsafe action", context: {} }, "2026-10-08T12:00:00.000Z")).toThrow();
    expect(() => serializeInteraction({ surfaceId: "s", sourceComponentId: "b", name: "safe.action", context: { item: { call: "openUrl" } } }, "2026-10-08T12:00:00.000Z")).toThrow();
    expect(() => resolveActionContext({ item: { path: "/__proto__" } }, {})).toThrow();
  });
});
