import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { A2UI_RENDERED_COMPONENTS } from "../src/components/index";
import extensionSchemas from "../src/contracts/v0_9/extension-schemas.json";
import legacySchemas from "../src/contracts/v0_9/legacy-custom-component-schemas.json";
import registryManifest from "../src/contracts/v0_9/registry-manifest.json";
import { A2UI_SUPPORTED_COMPONENTS, validateAndNormalize } from "../src/validation/index";

const fixtureRoot = join(process.cwd(), "fixtures", "mobile");

function jsonlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? jsonlFiles(path) : entry.isFile() && entry.name.endsWith(".jsonl") ? [path] : [];
  });
}

function payload(components: unknown[], extraMessages: unknown[] = []): string {
  const surfaceId = "validation-test";
  return [
    { version: "v0.9", createSurface: { surfaceId, catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json" } },
    ...extraMessages,
    { version: "v0.9", updateComponents: { surfaceId, components } },
  ].map((message) => JSON.stringify(message)).join("\n");
}

describe("mobile contract parity", () => {
  it("accepts every copied mobile JSONL fixture and preserves independent surfaces", () => {
    const files = jsonlFiles(fixtureRoot);
    expect(files.length).toBeGreaterThanOrEqual(30);
    for (const file of files) {
      const result = validateAndNormalize(readFileSync(file, "utf8"));
      expect(result.ok, `${file}: ${result.ok ? "" : result.error}`).toBe(true);
      if (result.ok) expect(result.surfaces.length, file).toBeGreaterThan(0);
    }
  });

  it("has schema and fixture coverage for all 15 extension components", () => {
    const extensionNames = Object.keys(extensionSchemas).sort();
    expect(extensionNames).toHaveLength(15);
    const fixtureNames = new Set<string>();
    for (const file of jsonlFiles(fixtureRoot)) {
      const result = validateAndNormalize(readFileSync(file, "utf8"));
      if (result.ok) for (const surface of result.surfaces) {
        for (const component of Object.values(surface.components)) fixtureNames.add(component.component);
      }
    }
    for (const name of extensionNames) expect(fixtureNames, `fixture for ${name}`).toContain(name);
  });

  it("matches the actual mobile registry to implemented schemas and renderers", () => {
    const fromManifest = [
      ...registryManifest.basicEnabled,
      ...registryManifest.legacyCustom,
      ...registryManifest.extensions,
    ].sort();
    expect(registryManifest.basicDisabled).toEqual(["AudioPlayer", "Video"]);
    expect(Object.keys(legacySchemas).sort()).toEqual([...registryManifest.legacyCustom].sort());
    expect(Object.keys(extensionSchemas).sort()).toEqual([...registryManifest.extensions].sort());
    expect([...A2UI_SUPPORTED_COMPONENTS].sort()).toEqual(fromManifest);
    expect([...A2UI_RENDERED_COMPONENTS].sort()).toEqual(fromManifest);
    for (const disabled of registryManifest.basicDisabled) expect(A2UI_SUPPORTED_COMPONENTS).not.toContain(disabled);

    const availableSchemas = new Set<string>(A2UI_SUPPORTED_COMPONENTS);
    const availableRenderers = new Set<string>(A2UI_RENDERED_COMPONENTS);
    const fixtureComponents = new Map<string, string[]>();
    for (const file of jsonlFiles(fixtureRoot)) {
      const result = validateAndNormalize(readFileSync(file, "utf8"));
      if (!result.ok) continue;
      const relative = file.slice(fixtureRoot.length + 1).replaceAll("\\", "/");
      for (const surface of result.surfaces) for (const component of Object.values(surface.components)) {
        const paths = fixtureComponents.get(component.component) ?? [];
        if (!paths.includes(relative)) paths.push(relative);
        fixtureComponents.set(component.component, paths);
      }
    }
    const coverage = fromManifest.map((component) => ({
      component,
      schema: availableSchemas.has(component),
      renderer: availableRenderers.has(component),
      fixtures: (fixtureComponents.get(component) ?? []).sort(),
    }));
    mkdirSync(join(process.cwd(), "fixtures"), { recursive: true });
    writeFileSync(join(process.cwd(), "fixtures", "generated-component-coverage.json"), `${JSON.stringify({
      catalogVersion: "v0.9",
      generatedBy: "tests/validation.test.ts",
      counts: {
        registry: coverage.length,
        schema: coverage.filter((entry) => entry.schema).length,
        renderer: coverage.filter((entry) => entry.renderer).length,
        fixtureRepresented: coverage.filter((entry) => entry.fixtures.length > 0).length,
      },
      components: coverage,
    }, null, 2)}\n`, "utf8");
  });

  it("keeps mobile row compatibility repairs without changing metric values", () => {
    const result = validateAndNormalize(readFileSync(join(fixtureRoot, "metric-row-ranged-unweighted.jsonl"), "utf8"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.surfaces[0]!.components.cpu!.weight).toBe(1);
    expect(result.surfaces[0]!.components.cpu!.value).toBe(65);

    const mixed = validateAndNormalize(readFileSync(join(fixtureRoot, "mixed-executive-summary.jsonl"), "utf8"));
    expect(mixed.ok).toBe(true);
    if (mixed.ok) expect(mixed.surfaces[0]!.components.metrics!.component).toBe("Row");

    const authoredWeight = validateAndNormalize(payload([
      { id: "root", component: "Row", children: ["metric-a", "metric-b"] },
      { id: "metric-a", component: "MetricTile", label: "A", value: 1, weight: 0 },
      { id: "metric-b", component: "MetricTile", label: "B", value: 2 },
    ]));
    expect(authoredWeight.ok).toBe(true);
    if (authoredWeight.ok) {
      expect(authoredWeight.surfaces[0]!.components["metric-a"]!.weight).toBe(0);
      expect(authoredWeight.surfaces[0]!.components["metric-b"]!.weight).toBe(1);
    }
  });
});

describe("strict A2UI boundaries", () => {
  it("rejects oversized UTF-8 payloads before parsing", () => {
    expect(validateAndNormalize("🙂".repeat(65_537)).ok).toBe(false);
  });

  it("rejects prototype keys, client functions, unknown components and unsupported media", () => {
    const base = JSON.parse(payload([{ id: "root", component: "Text", text: "safe" }]).split("\n")[0]!);
    const proto = `${JSON.stringify(base)}\n{"version":"v0.9","updateComponents":{"surfaceId":"validation-test","components":[{"id":"root","component":"Text","text":"x","__proto__":{}}]}}`;
    expect(validateAndNormalize(proto).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "Text", text: { call: "openUrl", args: { url: "https://invalid.test" } } }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "UnknownWidget", value: "x" }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "Video", url: "https://invalid.test/x.mp4" }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "Text", text: "safe", unsupported: true }])).ok).toBe(false);
    const wrongCatalog = JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "validation-test", catalogId: "https://invalid.test/catalog.json" } });
    expect(validateAndNormalize(`${wrongCatalog}\n${payload([{ id: "root", component: "Text", text: "safe" }]).split("\n").slice(1).join("\n")}`).ok).toBe(false);
  });

  it("rejects bad envelopes, invalid refs, cycles, multiple parents and excessive depth", () => {
    expect(validateAndNormalize('{"version":"v0.9","surfaceUpdate":{}}').ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "Card", child: "missing" }])).ok).toBe(false);
    expect(validateAndNormalize(payload([
      { id: "root", component: "Column", children: ["a"] },
      { id: "a", component: "Card", child: "root" },
    ])).ok).toBe(false);
    expect(validateAndNormalize(payload([
      { id: "root", component: "Column", children: ["a", "b"] },
      { id: "a", component: "Card", child: "shared" },
      { id: "b", component: "Card", child: "shared" },
      { id: "shared", component: "Text", text: "x" },
    ])).ok).toBe(false);
    const chain: Array<Record<string, unknown>> = [];
    for (let index = 0; index <= 12; index += 1) chain.push({
      id: index === 0 ? "root" : `node-${index}`,
      component: "Card",
      child: index === 12 ? "leaf" : `node-${index + 1}`,
    });
    chain.push({ id: "leaf", component: "Text", text: "too deep" });
    expect(validateAndNormalize(payload(chain)).ok).toBe(false);
  });

  it("enforces semantic geometry, table, chart, calendar, tree and scenario constraints", () => {
    expect(validateAndNormalize(payload([{ id: "root", component: "DataTable", title: "T", columns: ["A", "B"], rows: [["one"]] }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "MultiSeriesChart", title: "T", labels: ["A", "B"], unit: "x", series: [{ label: "S", values: [1] }] }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "CalendarGrid", title: "T", timezone: "UTC", events: [
      { date: "2026-01-01", time: "09:00", label: "A", detail: "A" },
      { date: "2026-01-09", time: "09:00", label: "B", detail: "B" },
    ] }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "DecisionTree", title: "T", start: "a", nodes: [
      { id: "a", label: "A", detail: "A", options: [{ label: "next", target: "a" }] },
    ] }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "ScenarioSlider", title: "T", inputLabel: "Input", unit: "x", min: 0, max: 10, value: 11, multiplier: 2, offset: 0, assumptions: "A" }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "RoomMap", title: "T", provenance: "survey", rooms: [
      { id: "r", label: "Room", detail: "Room", x: 0.8, y: 0, width: 0.3, height: 0.4 },
    ] }])).ok).toBe(false);
    expect(validateAndNormalize(payload([{ id: "root", component: "BeforeAfterViewer", title: "T", before: "A", after: "B", beforeMedia: "image-a" }])).ok).toBe(false);
  });

  it("applies updateDataModel safely inside a complete payload", () => {
    const result = validateAndNormalize(payload([
      { id: "root", component: "Text", text: { path: "/profile/name" } },
    ], [
      { version: "v0.9", updateDataModel: { surfaceId: "validation-test", path: "/profile/name", value: "Kai" } },
    ]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.surfaces[0]!.dataModel).toEqual({ profile: { name: "Kai" } });
    const unsafe = payload([{ id: "root", component: "Text", text: "safe" }], [
      { version: "v0.9", updateDataModel: { surfaceId: "validation-test", path: "/__proto__/polluted", value: true } },
    ]);
    expect(validateAndNormalize(unsafe).ok).toBe(false);
  });

  it("accepts an explicit deleteSurface after a complete surface", () => {
    const surfaceId = "validation-test";
    const messages = [
      { version: "v0.9", createSurface: { surfaceId, catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json" } },
      { version: "v0.9", updateComponents: { surfaceId, components: [{ id: "root", component: "Text", text: "safe" }] } },
      { version: "v0.9", deleteSurface: { surfaceId } },
    ];
    expect(validateAndNormalize(messages.map((message) => JSON.stringify(message)).join("\n"))).toEqual({ ok: true, surfaces: [], warnings: [] });
  });
});
