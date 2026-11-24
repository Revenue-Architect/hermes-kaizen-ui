import type { UiAction } from "../types.js";
import { resolveBinding } from "../validation/bindings.js";

const actionName = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/u;
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

/** Serializes the same v0.9 user-action envelope emitted by GenUI's UiEvent. */
export function serializeInteraction(action: UiAction, timestamp = new Date().toISOString()): string {
  if (!action || typeof action.surfaceId !== "string" || action.surfaceId.length < 1 || action.surfaceId.length > 128) {
    throw new TypeError("Interaction surface ID is invalid");
  }
  if (typeof action.sourceComponentId !== "string" || action.sourceComponentId.length < 1 || action.sourceComponentId.length > 128) {
    throw new TypeError("Interaction source component ID is invalid");
  }
  if (typeof action.name !== "string" || action.name.length > 80 || !actionName.test(action.name)) {
    throw new TypeError("Interaction name is invalid");
  }
  if (!isRecord(action.context) || Object.keys(action.context).length > 16 || !safeContext(action.context, 0)) {
    throw new TypeError("Interaction context is invalid");
  }
  const parsedTimestamp = new Date(timestamp);
  if (!Number.isFinite(parsedTimestamp.getTime())) throw new TypeError("Interaction timestamp is invalid");
  const body = {
    version: "v0.9",
    action: {
      surfaceId: action.surfaceId,
      name: action.name,
      sourceComponentId: action.sourceComponentId,
      timestamp: parsedTimestamp.toISOString(),
      context: action.context,
    },
  };
  return `[A2UI_INTERACTION]\n${JSON.stringify(body)}`;
}

/** Resolves top-level action-context bindings the same way GenUI's `resolveContext` does. */
export function resolveActionContext(
  contextDefinition: Record<string, unknown> | undefined,
  dataModel: Record<string, unknown>,
): Record<string, unknown> {
  if (!contextDefinition) return {};
  const resolved: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(contextDefinition)) {
    if (forbiddenKeys.has(key) || key.length < 1 || key.length > 80) {
      throw new TypeError("Interaction context key is invalid");
    }
    const item = isBinding(value) ? resolveBinding(value, dataModel) : value;
    resolved[key] = item === undefined ? null : item;
  }
  if (Object.keys(resolved).length > 16 || !safeContext(resolved, 0)) {
    throw new TypeError("Resolved interaction context is invalid");
  }
  return resolved;
}

function safeContext(value: unknown, depth: number): boolean {
  if (depth > 3) return false;
  if (value === null) return true;
  if (typeof value === "string") return value.length <= 2048;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 32 && value.every((item) => safeContext(item, depth + 1));
  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length > 16 || keys.some((key) => forbiddenKeys.has(key) || key === "call" || key === "functionCall" || key.length > 80)) return false;
    return keys.every((key) => safeContext(value[key], depth + 1));
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBinding(value: unknown): value is { path: string } {
  return isRecord(value) && Object.keys(value).length === 1 && typeof value.path === "string";
}
