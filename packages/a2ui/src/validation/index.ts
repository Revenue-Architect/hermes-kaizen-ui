import extensionSchemas from "../contracts/v0_9/extension-schemas.json";
import legacySchemas from "../contracts/v0_9/legacy-custom-component-schemas.json";
import registryManifest from "../contracts/v0_9/registry-manifest.json";
import * as generatedValidators from "./validators.generated.js";
import {
  A2UI_CATALOG_ID,
  A2UI_CATALOG_ID_V1,
  A2UI_MAX_COMPONENT_DEPTH,
  A2UI_MAX_COMPONENTS,
  A2UI_MAX_PAYLOAD_BYTES,
  type A2uiComponent,
  type A2uiSurface,
  type ValidationResult,
} from "../types.js";
import { updateDataModel } from "./bindings.js";

type JsonRecord = Record<string, unknown>;
type Schema = Record<string, unknown>;
type SurfaceState = {
  surfaceId: string;
  components: Map<string, A2uiComponent>;
  dataModel: Record<string, unknown>;
  created: boolean;
  updated: boolean;
  deleted: boolean;
};

type WireVersion = "v0.9" | "1.0";
/** A 1.0 component id is an identifier, as the SDK's Express compiler and processor require (UAX 31, kept to ASCII). */
const componentIdV1 = /^[A-Za-z_][A-Za-z0-9_]*$/u;
/** The component envelope keys 1.0 prefixes with @; the SDK 0.11 still writes the bare names, so the plugin takes both. */
const envelopeKeysV1: Record<string, string> = { "@accessibility": "accessibility", "@checks": "checks", "@catalogId": "catalogId", "@metadata": "metadata" };
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);
const eventName = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/u;
const builtInNames = registryManifest.basicEnabled as string[];
const extensionNames = Object.keys(extensionSchemas);
const legacyNames = Object.keys(legacySchemas);
const supportedNames = new Set([...builtInNames, ...legacyNames, ...extensionNames]);
const stackInRow = new Set([
  "MiniChart", "StatusBadge", "Slider", "TextField", "ChoicePicker", "DateTimeInput",
  "Card", "Column", "Row", "List", "Tabs", "InfoRow", "StepRail", "ActionCallout",
  "ArtifactTile", "BotBadge", "ExpandableSection", "ProgressMeter", "ActivityFeed",
  "ScheduleTile", "MessagePreview", "CommandBlock", "TaskTile", "KeyValueGrid",
  "ComparisonCard", "CitationCard", "SourceExcerpt", "DataTable", "DraftReview",
  "ChangeDiff", "MultiSeriesChart", "Agenda", "CalendarGrid", "DecisionTree",
  "ScenarioSlider", "RelationshipMap", "RoomMap", "BeforeAfterViewer", "JourneyMap",
  "EvidenceTrail",
]);
const alwaysStack = new Set([
  "ProgressMeter", "ActivityFeed", "ScheduleTile", "MessagePreview", "CommandBlock",
  "TaskTile", "KeyValueGrid", "ComparisonCard", "CitationCard", "SourceExcerpt",
  "DataTable", "DraftReview", "ChangeDiff", "MultiSeriesChart", "Agenda", "CalendarGrid",
  "DecisionTree", "ScenarioSlider", "RelationshipMap", "RoomMap", "BeforeAfterViewer",
  "JourneyMap", "EvidenceTrail",
]);

// Ajv standalone generation is performed during development/build. The
// shipped module imports only its precompiled validators; it does not compile
// model-provided schemas or evaluate generated code at runtime.
const validators = new Map(Object.entries(generatedValidators));

export const A2UI_SUPPORTED_COMPONENTS: readonly string[] = Object.freeze([...supportedNames]);

/** The version the first message names: "1.0", or "v0.9" for anything else (the shared loop then reports what is wrong). */
function firstVersion(payload: string): WireVersion {
  for (const rawLine of payload.split(/\r?\n/u)) {
    if (rawLine.trim().length === 0) continue;
    try {
      const first = JSON.parse(rawLine) as unknown;
      return isRecord(first) && first.version === "1.0" ? "1.0" : "v0.9";
    } catch {
      return "v0.9";
    }
  }
  return "v0.9";
}

/** A 1.0 component with its @-prefixed envelope keys under their bare names, which is how the schemas and the renderer know them. */
function envelopeV1(component: A2uiComponent): A2uiComponent | string {
  const bare = Object.create(null) as JsonRecord;
  for (const [key, child] of Object.entries(component)) {
    if (!key.startsWith("@")) {
      bare[key] = child;
      continue;
    }
    const name = envelopeKeysV1[key];
    if (name === undefined) return `Unknown reserved key ${JSON.stringify(key.slice(0, 40))}`;
    if (hasOwn(component, name)) return `A component sets both ${key} and ${name}`;
    bare[name] = child;
  }
  if (hasOwn(bare, "catalogId") && bare.catalogId !== A2UI_CATALOG_ID_V1) return "A component names a catalog this plugin does not provide";
  return bare as A2uiComponent;
}

/** Parse and normalize one complete mobile-compatible A2UI JSONL payload, written as v0.9 or as 1.0 (the first message says which). */
export function validateAndNormalize(payload: string): ValidationResult {
  if (typeof payload !== "string") return invalid("Payload must be text");
  const version = firstVersion(payload);
  const v1 = version === "1.0";
  const binding = v1 ? "@path" : "path";
  try {
    if (utf8ByteLength(payload) > A2UI_MAX_PAYLOAD_BYTES) return invalid("Payload exceeds the 256 KiB limit");
    const states = new Map<string, SurfaceState>();
    const createdIds = new Set<string>();
    const updatedIds = new Set<string>();
    const referencedSurfaceIds = new Set<string>();
    const operations: Array<{ operation: "updateComponents"; surfaceId: string; components: A2uiComponent[] }> = [];
    const lines = payload.split(/\r?\n/u);
    const validatorFor = (name: string) => validators.get(v1 ? `V1_${name}` : name);

    /** updateComponents, and the components a 1.0 createSurface carries. Returns an error message, or undefined. */
    const addComponents = (surfaceId: unknown, rawComponents: unknown): string | undefined => {
      if (!validId(surfaceId) || !Array.isArray(rawComponents) || rawComponents.length < 1 || rawComponents.length > A2UI_MAX_COMPONENTS) {
        return "updateComponents has an invalid surface or component count";
      }
      const state = states.get(surfaceId) ?? emptyState(surfaceId);
      const inUpdate = new Set<string>();
      const normalized: A2uiComponent[] = [];
      for (const rawComponent of rawComponents) {
        if (!isRecord(rawComponent)) return "Component entries must be objects";
        let component = cloneJson(rawComponent) as A2uiComponent;
        const idOk = validId(component.id) && (!v1 || componentIdV1.test(component.id));
        if (!idOk || typeof component.component !== "string" || !supportedNames.has(component.component)) {
          return v1 ? "A component has an unknown type or an invalid ID (1.0 IDs use letters, digits and underscores)" : "A component has an unknown type or invalid ID";
        }
        if (inUpdate.has(component.id)) return "A component ID is repeated in one update";
        inUpdate.add(component.id);
        if (v1) {
          const enveloped = envelopeV1(component);
          if (typeof enveloped === "string") return enveloped;
          component = enveloped;
        } else {
          normalizeTabs(component);
        }
        const validate = validatorFor(component.component);
        if (!validate || !validate(component)) return schemaError(component.component, validate?.errors?.[0]?.message);
        const componentError = validateComponentSafety(component, v1);
        if (componentError) return componentError;
        state.components.set(component.id, component);
        normalized.push(component);
      }
      if (state.components.size > A2UI_MAX_COMPONENTS) return "Surface exceeds the 100 component limit";
      state.updated = true;
      state.deleted = false;
      states.set(surfaceId, state);
      updatedIds.add(surfaceId);
      operations.push({ operation: "updateComponents", surfaceId, components: normalized });
      return undefined;
    };

    const setModel = (surfaceId: string, path: string, value: unknown): string | undefined => {
      const state = states.get(surfaceId) ?? emptyState(surfaceId);
      try {
        state.dataModel = updateDataModel(state.dataModel, path, value);
      } catch {
        return "updateDataModel contains an unsafe or invalid path/value";
      }
      state.deleted = false;
      states.set(surfaceId, state);
      return undefined;
    };

    for (const rawLine of lines) {
      if (rawLine.trim().length === 0) continue;
      let decoded: unknown;
      try {
        decoded = JSON.parse(rawLine) as unknown;
      } catch {
        return invalid("Payload contains malformed JSON");
      }
      if (!isRecord(decoded)) return invalid("Each JSONL entry must be an object");
      const treeError = checkSafeTree(decoded, v1);
      if (treeError) return invalid(treeError);
      if (decoded.version !== version) return invalid(v1 ? "Every message must use A2UI 1.0" : "Only A2UI v0.9 and 1.0 messages are supported");
      const operationKeys = ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"].filter((key) => hasOwn(decoded, key));
      if (operationKeys.length !== 1 || Object.keys(decoded).some((key) => key !== "version" && key !== operationKeys[0])) {
        return invalid(`Each message must contain exactly one known ${v1 ? "1.0" : "v0.9"} operation`);
      }
      const op = operationKeys[0]!;

      if (op === "createSurface") {
        const create = decoded.createSurface;
        const allowed = v1 ? ["surfaceId", "catalogId", "sendDataModel", "components", "dataModel", "metadata"] : ["surfaceId", "catalogId", "sendDataModel"];
        if (!isRecord(create) || !onlyKeys(create, allowed)) {
          return invalid("createSurface contains unsupported fields");
        }
        const surfaceId = create.surfaceId;
        const catalogOk = v1 ? !hasOwn(create, "catalogId") || create.catalogId === A2UI_CATALOG_ID_V1 : create.catalogId === A2UI_CATALOG_ID;
        if (!validId(surfaceId) || !catalogOk ||
            (hasOwn(create, "sendDataModel") && typeof create.sendDataModel !== "boolean") ||
            createdIds.has(surfaceId)) {
          return invalid("createSurface has an unsupported catalog or invalid surface ID");
        }
        if (hasOwn(create, "metadata") && !(isRecord(create.metadata) && onlyKeys(create.metadata, ["extensions"]) &&
            (!hasOwn(create.metadata, "extensions") || isRecord(create.metadata.extensions)))) {
          return invalid("createSurface contains unsupported fields");
        }
        createdIds.add(surfaceId);
        const state = states.get(surfaceId) ?? emptyState(surfaceId);
        state.created = true;
        state.deleted = false;
        states.set(surfaceId, state);
        if (hasOwn(create, "dataModel")) {
          if (!isRecord(create.dataModel)) return invalid("createSurface dataModel must be an object");
          referencedSurfaceIds.add(surfaceId);
          const problem = setModel(surfaceId, "/", create.dataModel);
          if (problem) return invalid(problem);
        }
        if (hasOwn(create, "components")) {
          const problem = addComponents(surfaceId, create.components);
          if (problem) return invalid(problem);
        }
        continue;
      }

      if (op === "updateComponents") {
        const update = decoded.updateComponents;
        if (!isRecord(update) || !onlyKeys(update, ["surfaceId", "components"])) {
          return invalid("updateComponents contains unsupported fields");
        }
        const problem = addComponents(update.surfaceId, update.components);
        if (problem) return invalid(problem);
        continue;
      }

      if (op === "updateDataModel") {
        const update = decoded.updateDataModel;
        if (!isRecord(update) || !onlyKeys(update, ["surfaceId", "path", "value"]) || !validId(update.surfaceId) ||
            (hasOwn(update, "path") && (typeof update.path !== "string" || update.path.length > 256))) {
          return invalid("updateDataModel has invalid fields");
        }
        if (v1 && !hasOwn(update, "value")) return invalid("updateDataModel requires a value (null deletes)");
        const surfaceId = update.surfaceId;
        referencedSurfaceIds.add(surfaceId);
        const problem = setModel(surfaceId, (update.path as string | undefined) ?? "/", hasOwn(update, "value") ? update.value : null);
        if (problem) return invalid(problem);
        continue;
      }

      const remove = decoded.deleteSurface;
      if (!isRecord(remove) || !onlyKeys(remove, ["surfaceId"]) || !validId(remove.surfaceId)) {
        return invalid("deleteSurface has an invalid surface ID");
      }
      referencedSurfaceIds.add(remove.surfaceId);
      const state = states.get(remove.surfaceId) ?? emptyState(remove.surfaceId);
      state.deleted = true;
      states.set(remove.surfaceId, state);
    }

    if (createdIds.size === 0 || updatedIds.size === 0 || !sameSet(createdIds, updatedIds) ||
        [...referencedSurfaceIds].some((id) => !createdIds.has(id))) {
      return invalid("Every rendered surface must be created, updated, and scoped to this payload");
    }

    const warnings: string[] = [];
    for (const operation of operations) {
      const state = states.get(operation.surfaceId)!;
      if (state.deleted) continue;
      normalizeMobileRowLayout(state.components, warnings);
    }
    const surfaces: A2uiSurface[] = [];
    for (const [surfaceId, state] of states) {
      if (state.deleted) continue;
      if (!state.updated || !state.components.has("root")) return invalid("Each rendered surface requires a root component");
      for (const component of state.components.values()) {
        const validate = validatorFor(component.component);
        if (!validate || !validate(component)) return invalid(schemaError(component.component, validate?.errors?.[0]?.message));
        const safetyError = validateComponentSafety(component, v1);
        if (safetyError) return invalid(safetyError);
      }
      const graphError = validateComponentGraph(state.components, v1);
      if (graphError) return invalid(graphError);
      const finalComponents = Object.create(null) as Record<string, A2uiComponent>;
      // The renderer draws one internal shape: bindings as {path}, tabs as {label, content}. A 1.0 view is converted to it here.
      for (const [id, component] of state.components) finalComponents[id] = v1 ? toInternalShape(component) : component;
      surfaces.push({ surfaceId, components: finalComponents, dataModel: state.dataModel });
    }
    return { ok: true, surfaces, warnings: [...new Set(warnings)], version };
  } catch {
    return invalid("Payload could not be validated safely");
  }
}

/** A validated 1.0 component in the shape the widgets read: `{"@path": p}` becomes `{path: p}` and tabs are `{label, content}`. */
function toInternalShape(component: A2uiComponent): A2uiComponent {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (!isRecord(value)) return value;
    if (hasOwn(value, "@path")) return { path: value["@path"] };
    const copy = Object.create(null) as JsonRecord;
    for (const [key, child] of Object.entries(value)) copy[key] = convert(child);
    return copy;
  };
  const internal = convert(component) as A2uiComponent;
  if (internal.component === "Tabs" && Array.isArray(internal.tabs)) {
    internal.tabs = internal.tabs.map((tab) => {
      if (!isRecord(tab)) return tab;
      const { title, child, ...rest } = tab;
      return { ...rest, label: title, content: child };
    });
  }
  return internal;
}

function validateComponentSafety(component: A2uiComponent, v1 = false): string | undefined {
  const binding = v1 ? "@path" : "path";
  if (!(v1 ? validBindingsV1(component) : validBindings(component))) return "A component contains an invalid data binding";
  if (!validEventActions(component, binding)) return "A component contains an invalid event action";
  if (component.component === "Button" && !validEventAction(component.action, binding)) return "Button actions must be fixed Hermes events";
  if (!validComponentSemantics(component)) return `${component.component} values are not semantically valid`;
  if ([...legacyNames, ...extensionNames].includes(component.component) && !allCustomStringsNonempty(component)) {
    return `${component.component} contains blank text`;
  }
  return undefined;
}

function validBindings(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) stack.push(...item);
    else if (isRecord(item)) {
      const keys = Object.keys(item);
      if (hasOwn(item, "path")) {
        const isChildTemplate = hasOwn(item, "componentId") && onlyKeys(item, ["componentId", "path"]) && typeof item.componentId === "string";
        if ((!isChildTemplate && (keys.length !== 1 || typeof item.path !== "string")) || typeof item.path !== "string" || item.path.length > 256 || hasForbiddenPathSegment(item.path)) return false;
      }
      stack.push(...Object.values(item));
    }
  }
  return true;
}

/** 1.0: a binding is exactly `{"@path": "..."}`. A plain `path` key is only the child template's, and any other @ key is refused. */
function validBindingsV1(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) stack.push(...item);
    else if (isRecord(item)) {
      if (Object.keys(item).some((key) => key.startsWith("@") && key !== "@path")) return false;
      if (hasOwn(item, "@path")) {
        const path = item["@path"];
        if (Object.keys(item).length !== 1 || typeof path !== "string" || path.length > 256 || hasForbiddenPathSegment(path)) return false;
      } else if (hasOwn(item, "path")) {
        const path = item.path;
        const isChildTemplate = hasOwn(item, "componentId") && onlyKeys(item, ["componentId", "path"]) && typeof item.componentId === "string";
        if (!isChildTemplate || typeof path !== "string" || path.length > 256 || hasForbiddenPathSegment(path)) return false;
      }
      stack.push(...Object.values(item));
    }
  }
  return true;
}

function validEventActions(value: unknown, binding = "path"): boolean {
  const stack: unknown[] = [value];
  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) stack.push(...item);
    else if (isRecord(item)) {
      if (hasOwn(item, "call") || hasOwn(item, "functionCall") || (binding === "@path" && hasOwn(item, "@call"))) return false;
      if (hasOwn(item, "event") && !validEventAction(item, binding)) return false;
      stack.push(...Object.values(item));
    }
  }
  return true;
}

function validEventAction(action: unknown, binding = "path"): boolean {
  if (!isRecord(action) || !onlyKeys(action, ["event"]) || !isRecord(action.event)) return false;
  const event = action.event;
  if (!onlyKeys(event, ["name", "context"]) || typeof event.name !== "string" || event.name.length > 80 || !eventName.test(event.name)) return false;
  if (!hasOwn(event, "context")) return true;
  if (!isRecord(event.context) || Object.keys(event.context).length > 16) return false;
  return Object.entries(event.context).every(([key, item]) => key.length > 0 && key.length <= 80 && safeAuthoredContext(item, 0, binding));
}

function safeAuthoredContext(value: unknown, depth: number, binding = "path"): boolean {
  if (depth > 3) return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 2048;
  if (Array.isArray(value)) return value.length <= 32 && value.every((child) => safeAuthoredContext(child, depth + 1, binding));
  if (isRecord(value)) return onlyKeys(value, [binding]) && typeof value[binding] === "string" && (value[binding] as string).length <= 256 && !hasForbiddenPathSegment(value[binding] as string);
  return false;
}

function validComponentSemantics(component: A2uiComponent): boolean {
  const value = component as JsonRecord;
  switch (component.component) {
    case "MetricTile": {
      const hasMin = hasOwn(value, "min"), hasMax = hasOwn(value, "max");
      if (hasMin !== hasMax) return false;
      if (hasMin && !(Number(value.max) > Number(value.min))) return false;
      return !hasOwn(value, "asOf") || validTimestamp(value.asOf);
    }
    case "MiniChart":
      return Array.isArray(value.points) && value.points.every((point) => isRecord(point) && typeof point.value === "number" && Number.isFinite(point.value)) && (!hasOwn(value, "asOf") || validTimestamp(value.asOf));
    case "ProgressMeter":
      return typeof value.current === "number" && value.current >= 0 && typeof value.total === "number" && value.total > 0;
    case "CommandBlock":
      return typeof value.content === "string" && value.content.trim().length > 0;
    case "DataTable":
      return Array.isArray(value.columns) && Array.isArray(value.rows) && value.rows.every((row) => Array.isArray(row) && row.length === (value.columns as unknown[]).length);
    case "MultiSeriesChart":
      return Array.isArray(value.labels) && Array.isArray(value.series) && value.series.every((series) => isRecord(series) && Array.isArray(series.values) && series.values.length === (value.labels as unknown[]).length && series.values.every((sample) => typeof sample === "number" && Number.isFinite(sample)));
    case "Agenda":
    case "CalendarGrid": {
      if (!Array.isArray(value.events)) return false;
      const dates = [...new Set(value.events.filter(isRecord).map((event) => event.date))].filter((date): date is string => typeof date === "string").sort();
      if (dates.length === 0 || dates.some((date) => !validDateOnly(date))) return false;
      if (component.component === "CalendarGrid") {
        const diffDays = (Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86_400_000;
        return diffDays <= 6;
      }
      return true;
    }
    case "DecisionTree": {
      if (!Array.isArray(value.nodes)) return false;
      const nodes = value.nodes.filter(isRecord);
      const ids = nodes.map((node) => node.id);
      if (new Set(ids).size !== nodes.length || typeof value.start !== "string" || !ids.includes(value.start)) return false;
      const byId = new Map(nodes.map((node) => [String(node.id), node]));
      const visiting = new Set<string>(), visited = new Set<string>();
      const walk = (id: string, depth: number): boolean => {
        if (depth > A2UI_MAX_COMPONENT_DEPTH || visiting.has(id) || !byId.has(id)) return false;
        if (visited.has(id)) return true;
        visiting.add(id);
        const options = byId.get(id)!.options as unknown[];
        if (!options.every((option) => isRecord(option) && walk(String(option.target), depth + 1))) return false;
        visiting.delete(id);
        visited.add(id);
        return true;
      };
      return walk(value.start, 0) && visited.size === nodes.length;
    }
    case "ScenarioSlider": {
      const { min, max, value: current, multiplier, offset } = value;
      if (![min, max, current, multiplier, offset].every((item) => typeof item === "number" && Number.isFinite(item))) return false;
      if (!(Number(min) < Number(max) && Number(current) >= Number(min) && Number(current) <= Number(max))) return false;
      return Number.isFinite(Number(min) * Number(multiplier) + Number(offset)) && Number.isFinite(Number(max) * Number(multiplier) + Number(offset));
    }
    case "RelationshipMap": {
      if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false;
      const nodes = value.nodes.filter(isRecord), ids = new Set(nodes.map((node) => node.id));
      return ids.size === nodes.length && value.edges.every((edge) => isRecord(edge) && ids.has(edge.source) && ids.has(edge.target));
    }
    case "RoomMap": {
      if (!Array.isArray(value.rooms)) return false;
      const rooms = value.rooms.filter(isRecord), ids = new Set(rooms.map((room) => room.id));
      return ids.size === rooms.length && rooms.every((room) => typeof room.x === "number" && typeof room.y === "number" && typeof room.width === "number" && typeof room.height === "number" && room.x + room.width <= 1.000001 && room.y + room.height <= 1.000001);
    }
    case "BeforeAfterViewer":
      return hasOwn(value, "beforeMedia") === hasOwn(value, "afterMedia");
    default:
      return true;
  }
}

function validateComponentGraph(components: Map<string, A2uiComponent>, v1 = false): string | undefined {
  const parentCount = new Map<string, number>();
  const childRefs = new Map<string, string[]>();
  for (const [id, component] of components) {
    const refs = componentReferences(component, v1);
    childRefs.set(id, refs);
    for (const ref of refs) {
      if (!components.has(ref)) return `Component reference "${ref}" is missing`;
      parentCount.set(ref, (parentCount.get(ref) ?? 0) + 1);
      if (parentCount.get(ref)! > 1) return `Component "${ref}" has more than one parent`;
    }
  }
  if ((parentCount.get("root") ?? 0) !== 0) return "Root component cannot have a parent";
  const active = new Set<string>(), visited = new Set<string>();
  const walk = (id: string, depth: number): boolean => {
    if (depth > A2UI_MAX_COMPONENT_DEPTH || active.has(id)) return false;
    if (visited.has(id)) return true;
    active.add(id);
    for (const child of childRefs.get(id) ?? []) if (!walk(child, depth + 1)) return false;
    active.delete(id);
    visited.add(id);
    return true;
  };
  if (!walk("root", 1)) return "Component graph contains a cycle or exceeds depth 12";
  if (visited.size !== components.size) return "Every component must be reachable from root";
  return undefined;
}

function componentReferences(component: A2uiComponent, v1 = false): string[] {
  const data = component as JsonRecord;
  const refs: string[] = [];
  const refKeys = component.component === "CommandBlock" ? ["child", "actionChild", "trigger"] : ["child", "actionChild", "content", "trigger"];
  for (const key of refKeys) {
    const value = data[key];
    if (value !== undefined && value !== null) {
      if (typeof value !== "string") throw new TypeError("Component reference must be a string");
      refs.push(value);
    }
  }
  if (Array.isArray(data.children)) {
    for (const child of data.children) {
      if (typeof child !== "string") throw new TypeError("Child reference must be a string");
      refs.push(child);
    }
  } else if (isRecord(data.children)) {
    if (component.component === "Row") throw new TypeError("Row templates cannot be classified safely");
    if (typeof data.children.componentId !== "string" || typeof data.children.path !== "string") throw new TypeError("Child template is invalid");
    refs.push(data.children.componentId);
  } else if (data.children !== undefined && data.children !== null) {
    throw new TypeError("Children must be a list or a data-bound template");
  }
  if (Array.isArray(data.tabs)) {
    for (const tab of data.tabs) {
      const target = isRecord(tab) ? tab[v1 ? "child" : "content"] : undefined;
      if (typeof target !== "string") throw new TypeError("Tab reference is invalid");
      refs.push(target);
    }
  }
  return refs;
}

function normalizeTabs(component: A2uiComponent): void {
  if (component.component !== "Tabs" || !Array.isArray(component.tabs)) return;
  component.tabs = component.tabs.map((item) => {
    if (!isRecord(item)) return item;
    const tab = { ...item };
    const usesSpecNames = hasOwn(tab, "title") || hasOwn(tab, "child");
    if (!usesSpecNames) return tab;
    if (hasOwn(tab, "label") || hasOwn(tab, "content") || typeof tab.title !== "string" || typeof tab.child !== "string") {
      throw new TypeError("Tabs entry has conflicting names");
    }
    tab.label = tab.title;
    tab.content = tab.child;
    delete tab.title;
    delete tab.child;
    return tab;
  });
}

function normalizeMobileRowLayout(components: Map<string, A2uiComponent>, warnings: string[]): void {
  for (const component of components.values()) {
    if (component.component !== "Row") continue;
    const children = component.children;
    if (isRecord(children)) throw new TypeError("Data-bound Row children are unsupported by the mobile layout contract");
    if (!Array.isArray(children) || children.some((id) => typeof id !== "string")) continue;
    const rowChildren = children.map((id) => components.get(id as string)).filter((child): child is A2uiComponent => Boolean(child));
    const childTypes = new Set(rowChildren.map((child) => child.component));
    const allMetricTiles = rowChildren.length > 0 && rowChildren.every((child) => child.component === "MetricTile");
    const allButtons = rowChildren.length > 1 && rowChildren.every((child) => child.component === "Button");
    if (allMetricTiles || allButtons) {
      // The mobile normalizer adds default flex weight only when the field is
      // absent. Preserve any authored number exactly, including unusual ones.
      for (const child of rowChildren) if (!hasOwn(child, "weight")) child.weight = 1;
      continue;
    }
    const hasButton = childTypes.has("Button");
    const unweightedText = rowChildren.some((child) => child.component === "Text" && !hasPositiveWeight(child));
    const hasUnweightedWidthDependentChild = rowChildren.some((child) => stackInRow.has(child.component) && !hasPositiveWeight(child));
    const hasUnweightedMetricTile = rowChildren.some((child) => child.component === "MetricTile" && !hasPositiveWeight(child));
    const hasLongUnweightedText = rowChildren.some((child) => child.component === "Text" && !hasPositiveWeight(child) && (typeof child.text !== "string" || child.text.trim().length > 36));
    const mixedMetricRow = childTypes.has("MetricTile") && hasUnweightedMetricTile;
    const hasFullWidthObject = rowChildren.some((child) => alwaysStack.has(child.component));
    const mustStack = hasFullWidthObject || (hasButton && unweightedText) || hasUnweightedWidthDependentChild || hasLongUnweightedText || mixedMetricRow;
    if (mustStack) {
      component.component = "Column";
      warnings.push("Mobile-compatible layout repair changed an overflowing Row to Column");
    }
  }
}

function allCustomStringsNonempty(component: A2uiComponent): boolean {
  const stack: unknown[] = [component];
  while (stack.length) {
    const item = stack.pop();
    if (typeof item === "string" && item.trim().length === 0) return false;
    if (Array.isArray(item)) stack.push(...item);
    else if (isRecord(item)) stack.push(...Object.values(item));
  }
  return true;
}

function checkSafeTree(value: unknown, v1 = false): string | undefined {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (stack.length) {
    const item = stack.pop()!;
    if (item.depth > 32) return "JSON nesting exceeds the safe limit";
    if (Array.isArray(item.value)) {
      for (const child of item.value) stack.push({ value: child, depth: item.depth + 1 });
    } else if (isRecord(item.value)) {
      for (const [key, child] of Object.entries(item.value)) {
        if (forbiddenKeys.has(key)) return "JSON contains a forbidden prototype key";
        if (hasOwn(item.value, "call") || hasOwn(item.value, "functionCall") || (v1 && hasOwn(item.value, "@call"))) return "Client functions are not supported";
        stack.push({ value: child, depth: item.depth + 1 });
      }
    }
  }
  return undefined;
}

function hasForbiddenPathSegment(path: string): boolean {
  return path.split("/").some((part) => forbiddenKeys.has(part.replace(/~1/gu, "/").replace(/~0/gu, "~")));
}

// ISO dates and date-times only: Date.parse accepts engine-specific forms the tool's Python check can't match.
const timestampPattern = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/u;

function validTimestamp(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 40) return false;
  const found = timestampPattern.exec(value);
  if (!found || !validDateOnly(found[1]!)) return false;
  return Number(found[2] ?? 0) <= 23 && Number(found[3] ?? 0) <= 59 && Number(found[4] ?? 0) <= 59;
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && value >= "0001-01-01" && date.toISOString().slice(0, 10) === value;
}

function hasPositiveWeight(component: A2uiComponent): boolean {
  return typeof component.weight === "number" && Number.isInteger(component.weight) && component.weight > 0;
}

function onlyKeys(value: JsonRecord, allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(value).every((key) => set.has(key));
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function emptyState(surfaceId: string): SurfaceState {
  return { surfaceId, components: new Map(), dataModel: Object.create(null) as Record<string, unknown>, created: false, updated: false, deleted: false };
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!isRecord(value)) return value;
  const result = Object.create(null) as JsonRecord;
  for (const [key, child] of Object.entries(value)) result[key] = cloneJson(child);
  return result;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function schemaError(component: string, message?: string): string {
  const detail = (message ?? "does not match its schema").replace(/[\r\n]+/gu, " ").slice(0, 90);
  return `Invalid ${component} component: ${detail}`;
}

function invalid(error: string): ValidationResult {
  return { ok: false, error: error.slice(0, 180) };
}
