import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { A2UI_CATALOG_ID_V1, type A2uiComponent, type A2uiSurface } from "../src/types";
import { validateAndNormalize } from "../src/validation/index";
import { resolveBinding } from "../src/validation/bindings";

const root = process.cwd();
const catalogV1 = JSON.parse(readFileSync(join(root, "a2ui_core", "catalogs", "hermes-v1_0.json"), "utf8")) as { catalogId: string };

function jsonlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? jsonlFiles(path) : entry.isFile() && entry.name.endsWith(".jsonl") ? [path] : [];
  });
}

const read = (path: string) => readFileSync(path, "utf8");
const lines = (text: string) => text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as Record<string, unknown>);
const dump = (messages: unknown[]) => messages.map((message) => JSON.stringify(message)).join("\n");

function ok(text: string) {
  const result = validateAndNormalize(text);
  if (!result.ok) throw new Error(result.error);
  return result;
}

/** Component ids renamed n0, n1, ... in the order a walk from root meets them, so a view and its renamed twin compare equal. */
function relabel(surface: A2uiSurface): Record<string, unknown> {
  const names = new Map<string, string>();
  const order: string[] = [];
  const visit = (id: string) => {
    if (names.has(id) || !surface.components[id]) return;
    names.set(id, `n${names.size}`);
    order.push(id);
    const component = surface.components[id] as Record<string, unknown>;
    for (const key of ["child", "actionChild", "trigger", "content"]) if (typeof component[key] === "string" && component.component !== "CommandBlock") visit(component[key] as string);
    const children = component.children;
    if (Array.isArray(children)) children.forEach((child) => visit(child as string));
    else if (children && typeof children === "object") visit((children as { componentId: string }).componentId);
    if (Array.isArray(component.tabs)) for (const tab of component.tabs as Array<{ content: string }>) visit(tab.content);
  };
  visit("root");
  const linkKeys = ["id", "child", "actionChild", "trigger", "content", "componentId", "children"];
  const rename = (value: unknown, key?: string): unknown => {
    if (Array.isArray(value)) return value.map((item) => rename(item, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rename(v, k)]));
    return typeof value === "string" && key !== undefined && linkKeys.includes(key) && names.has(value) ? names.get(value) : value;
  };
  const components = Object.fromEntries(order.map((id) => [names.get(id)!, rename(surface.components[id])]));
  return { surfaceId: surface.surfaceId, components, orphans: Object.keys(surface.components).length - order.length };
}

/** Every value in the surface with its bindings resolved against the surface's own data model. */
function resolved(surface: A2uiSurface): unknown {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (Object.keys(record).length === 1 && typeof record.path === "string") return { resolvedFrom: record.path, value: resolveBinding(record, surface.dataModel) };
      return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, walk(child)]));
    }
    return value;
  };
  return walk(relabel(surface).components);
}

const twinCases = jsonlFiles(join(root, "fixtures", "mobile")).map((path) => [relative(join(root, "fixtures", "mobile"), path)] as const);

describe("A2UI 1.0 views", () => {
  it("accepts every converted fixture and every 1.0 bound case, and says they are 1.0", () => {
    const files = [...jsonlFiles(join(root, "fixtures", "v1_0")), ...jsonlFiles(join(root, "fixtures", "bound")).filter((file) => file.endsWith(".v1_0.jsonl"))];
    expect(files).toHaveLength(35);
    for (const file of files) {
      const result = ok(read(file));
      expect(result.version, file).toBe("1.0");
      expect(result.surfaces.length, file).toBeGreaterThan(0);
    }
  });

  it("uses the catalog id the Python side reads from the generated catalog", () => {
    expect(A2UI_CATALOG_ID_V1).toBe(catalogV1.catalogId);
  });

  it.each(twinCases)("draws %s the same whether it was saved as v0.9 or written as 1.0", (name) => {
    const old = ok(read(join(root, "fixtures", "mobile", name)));
    const next = ok(read(join(root, "fixtures", "v1_0", name)));
    expect(old.version).toBe("v0.9");
    expect(next.surfaces.map((surface) => surface.surfaceId)).toEqual(old.surfaces.map((surface) => surface.surfaceId));
    next.surfaces.forEach((surface, index) => {
      const before = old.surfaces[index]!;
      expect(relabel(surface), name).toEqual(relabel(before));
      expect(surface.dataModel).toEqual(before.dataModel);
      expect(resolved(surface)).toEqual(resolved(before));
    });
    expect(next.warnings).toEqual(old.warnings);
  });

  it.each(["meal-form", "notes-modal"])("draws the bound case %s the same in both versions, with the same resolved values", (name) => {
    const old = ok(read(join(root, "fixtures", "bound", `${name}.v0_9.jsonl`)));
    const next = ok(read(join(root, "fixtures", "bound", `${name}.v1_0.jsonl`)));
    expect(old.version).toBe("v0.9");
    expect(next.version).toBe("1.0");
    const [a, b] = [old.surfaces[0]!, next.surfaces[0]!];
    expect(Object.keys(a.dataModel).length).toBeGreaterThan(0);
    expect(b.dataModel).toEqual(a.dataModel);
    expect(relabel(b)).toEqual(relabel(a));
    expect(JSON.stringify(resolved(b))).toContain(name === "meal-form" ? '"resolvedFrom":"/meal"' : '"resolvedFrom":"/note"');
    expect(resolved(b)).toEqual(resolved(a));
  });

  it("hands the renderer {path} bindings, never @path, and tabs as label/content", () => {
    const messages = lines(read(join(root, "fixtures", "bound", "meal-form.v1_0.jsonl")));
    const created = messages[0]!.createSurface as { components: Array<Record<string, unknown>> };
    created.components.push({ id: "tabs", component: "Tabs", tabs: [{ title: "One", child: "heading" }] });
    (created.components.find((c) => c.id === "body")!.children as string[]).splice(0, 1);
    (created.components.find((c) => c.id === "body")!.children as string[]).push("tabs");
    const result = ok(dump(messages));
    const surface = result.surfaces[0]!;
    const meal = surface.components.meal as A2uiComponent;
    expect(meal.value).toEqual({ path: "/meal" });
    expect(JSON.stringify(surface)).not.toContain("@path");
    expect(surface.components.tabs).toMatchObject({ tabs: [{ label: "One", content: "heading" }] });
    expect(resolveBinding(meal.value, surface.dataModel)).toBe("Tomato soup");
  });
});

describe("resolveBinding by version", () => {
  const model = { a: { b: [10, 20] } };
  it("reads {path} in v0.9 and {@path} in 1.0, and treats the other form as plain data", () => {
    expect(resolveBinding({ path: "/a/b/1" }, model)).toBe(20);
    expect(resolveBinding({ path: "/a/b/1" }, model, "v0.9")).toBe(20);
    expect(resolveBinding({ "@path": "/a/b/1" }, model, "1.0")).toBe(20);
    expect(resolveBinding({ path: "/a/b/1" }, model, "1.0")).toEqual({ path: "/a/b/1" });
    expect(resolveBinding({ "@path": "/a/b/1" }, model)).toEqual({ "@path": "/a/b/1" });
    expect(resolveBinding({ "@path": "/a/x" }, model, "1.0")).toBeUndefined();
    expect(resolveBinding("/a/b/1", model, "1.0")).toBe("/a/b/1");
  });
});

describe("A2UI 1.0 rejections", () => {
  const view = (change: (messages: Array<Record<string, unknown>>) => void): string => {
    const messages = lines(JSON.stringify({
      version: "1.0",
      createSurface: {
        surfaceId: "s",
        components: [
          { id: "root", component: "Column", children: ["title", "go"] },
          { id: "title", component: "Text", text: { "@path": "/t" } },
          { id: "go", component: "Button", child: "go_label", action: { event: { name: "x.go", context: { t: { "@path": "/t" } } } } },
          { id: "go_label", component: "Text", text: "Go" },
        ],
        dataModel: { t: "hello" },
      },
    }));
    change(messages);
    return dump(messages);
  };
  const rows = (messages: Array<Record<string, unknown>>) => (messages[0]!.createSurface as { components: Array<Record<string, any>> }).components;
  const row = (messages: Array<Record<string, unknown>>, id: string) => rows(messages).find((r) => r.id === id)!;

  it("accepts the base view", () => {
    expect(ok(view(() => undefined)).surfaces[0]!.surfaceId).toBe("s");
  });

  const broken: Record<string, (m: Array<Record<string, unknown>>) => void> = {
    "function call": (m) => { row(m, "title").text = { "@call": "formatDate", args: { value: "x" } }; },
    "function call in an action": (m) => { row(m, "go").action.functionCall = { call: "openUrl" }; },
    theme: (m) => { (m[0]!.createSurface as Record<string, unknown>).theme = { primaryColor: "#ffffff" }; },
    "hyphenated id": (m) => { row(m, "go_label").id = "go-label"; row(m, "go").child = "go-label"; },
    "id starting with a digit": (m) => { row(m, "go_label").id = "1label"; row(m, "go").child = "1label"; },
    "plain path as a binding": (m) => { row(m, "title").text = { path: "/t" }; },
    "plain path in an event context": (m) => { row(m, "go").action.event.context = { t: { path: "/t" } }; },
    "unknown @ key": (m) => { row(m, "title")["@foo"] = 1; },
    "unknown @ key inside a binding": (m) => { row(m, "title").text = { "@path": "/t", "@extra": 1 }; },
    "both forms of an envelope key": (m) => { Object.assign(row(m, "title"), { "@accessibility": { label: "a" }, accessibility: { label: "b" } }); },
    "another catalog on a component": (m) => { row(m, "title")["@catalogId"] = "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"; },
    "the v0.9 catalog id": (m) => { (m[0]!.createSurface as Record<string, unknown>).catalogId = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"; },
    "a v0.9 message after a 1.0 one": (m) => { m.push({ version: "v0.9", updateDataModel: { surfaceId: "s", path: "/t", value: "x" } }); },
    "updateDataModel without a value": (m) => { m.push({ version: "1.0", updateDataModel: { surfaceId: "s", path: "/t" } }); },
    "a data model that is not an object": (m) => { (m[0]!.createSurface as Record<string, unknown>).dataModel = [1]; },
    "userMessage on an event": (m) => { row(m, "go").action.event.userMessage = "Going"; },
    "a missing child": (m) => { row(m, "root").children = ["title", "go", "ghost"]; },
    "an unreachable component": (m) => { rows(m).push({ id: "orphan", component: "Text", text: "lost" }); },
    "no root": (m) => { rows(m)[0]!.id = "top"; },
    "an unknown component": (m) => { row(m, "title").component = "Nope"; },
    "a text variant 1.0 does not know": (m) => { row(m, "title").variant = "h6"; },
    "a v0.9 style tab": (m) => { rows(m).push({ id: "tabs", component: "Tabs", tabs: [{ label: "A", content: "title" }] }); },
    "a text field without a value": (m) => { rows(m).push({ id: "field", component: "TextField", label: "N" }); },
    "a text field with a validation pattern": (m) => { rows(m).push({ id: "field", component: "TextField", label: "N", value: "x", validationRegexp: "^a$" }); },
  };

  it.each(Object.keys(broken))("refuses %s", (name) => {
    const result = validateAndNormalize(view(broken[name]!));
    expect(result.ok, name).toBe(false);
  });

  it.each([
    ["null deletes a value", (m: Array<Record<string, unknown>>) => { m.push({ version: "1.0", updateDataModel: { surfaceId: "s", path: "/t", value: null } }); }],
    ["@accessibility", (m: Array<Record<string, unknown>>) => { row(m, "title")["@accessibility"] = { label: "Title", live: "polite" }; }],
    ["accessibility as the SDK writes it", (m: Array<Record<string, unknown>>) => { row(m, "title").accessibility = { label: "Title" }; }],
    ["@catalogId of ours", (m: Array<Record<string, unknown>>) => { row(m, "title")["@catalogId"] = A2UI_CATALOG_ID_V1; }],
    ["@metadata", (m: Array<Record<string, unknown>>) => { row(m, "title")["@metadata"] = { extensions: { a2ui_note: 1 } }; }],
    ["text variant h4", (m: Array<Record<string, unknown>>) => { row(m, "title").variant = "h4"; }],
    ["a slider with steps", (m: Array<Record<string, unknown>>) => { rows(m).push({ id: "slide", component: "Slider", label: "S", max: 10, value: 3, steps: 5 }); (row(m, "root").children as string[]).push("slide"); }],
    ["a text field with a placeholder", (m: Array<Record<string, unknown>>) => { rows(m).push({ id: "field", component: "TextField", label: "N", value: "x", placeholder: "p" }); (row(m, "root").children as string[]).push("field"); }],
    // In 1.0 only @path is a binding: an object with a path key is ordinary data where the schema allows an object.
    ["ordinary path data in metadata", (m: Array<Record<string, unknown>>) => { row(m, "title").metadata = { extensions: { asset: { path: "/report.pdf" } } }; }],
    ["ordinary path data in @metadata", (m: Array<Record<string, unknown>>) => { row(m, "title")["@metadata"] = { extensions: { asset: { path: "/report.pdf" } } }; }],
    ["an extension key that is an identifier", (m: Array<Record<string, unknown>>) => { row(m, "title").metadata = { extensions: { note: 1 } }; }],
  ] as const)("accepts %s", (name, change) => {
    expect(validateAndNormalize(view(change)).ok, name).toBe(true);
  });

  it("keeps ordinary path data as it was written when it hands the view to the renderer", () => {
    const result = ok(view((m) => { row(m, "title").metadata = { extensions: { asset: { path: "/report.pdf" } } }; }));
    expect((result.surfaces[0]!.components.title as Record<string, any>).metadata).toEqual({ extensions: { asset: { path: "/report.pdf" } } });
  });

  it("holds extension keys to whole identifiers and numbers to finite ones", () => {
    const withExtensions = (extensions: string) => view((m) => { row(m, "title").metadata = { extensions: { n: 987654321 } }; })
      .replace('{"n":987654321}', extensions);
    expect(validateAndNormalize(withExtensions('{"note":1}')).ok).toBe(true);
    expect(validateAndNormalize(withExtensions('{"note\\n":1}')).ok).toBe(false);
    expect(validateAndNormalize(withExtensions('{"\\nnote":1}')).ok).toBe(false);
    expect(validateAndNormalize(withExtensions('{"n":1e400}')).ok).toBe(false);
    expect(validateAndNormalize(withExtensions('{"n":-1e400}')).ok).toBe(false);
    expect(validateAndNormalize(withExtensions('{"n":1e300}')).ok).toBe(true);
  });

  it("still checks the path of a list template", () => {
    const template = (path: string) => view((m) => {
      rows(m)[0] = { id: "root", component: "List", children: { componentId: "title", path } };
      rows(m).splice(2, 2);
    });
    expect(validateAndNormalize(template("/items")).ok).toBe(true);
    expect(validateAndNormalize(template("/__proto__/x")).ok).toBe(false);
    expect(validateAndNormalize(template(`/${"a".repeat(300)}`)).ok).toBe(false);
  });

  it("keeps a list template's plain path and still refuses an extra key in it", () => {
    const good = view((m) => {
      rows(m)[0] = { id: "root", component: "List", children: { componentId: "title", path: "/items" } };
      rows(m).splice(2, 2);
    });
    expect(validateAndNormalize(good).ok).toBe(true);
    const bad = good.replace('"path":"/items"', '"path":"/items","extra":1');
    expect(validateAndNormalize(bad).ok).toBe(false);
  });

  it("checks tab children by their 1.0 name", () => {
    const tabs = (child: string) => view((m) => {
      rows(m).splice(0, rows(m).length, { id: "root", component: "Tabs", tabs: [{ title: "One", child }] }, { id: "a", component: "Text", text: "A" });
    });
    expect(validateAndNormalize(tabs("a")).ok).toBe(true);
    expect(validateAndNormalize(tabs("ghost")).ok).toBe(false);
  });

  it("still reads a v0.9 payload by the v0.9 rules and names the supported versions otherwise", () => {
    const result = ok(read(join(root, "fixtures", "mobile", "action-needed.jsonl")));
    expect(result.version).toBe("v0.9");
    const refused = validateAndNormalize('{"version":"v0.8","createSurface":{}}');
    expect(refused).toEqual({ ok: false, error: "Only A2UI v0.9 and 1.0 messages are supported" });
  });
});
