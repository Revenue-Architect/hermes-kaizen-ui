/** A validated, self-contained A2UI surface, in the one shape the widgets draw (written as v0.9 or as 1.0). */
export interface A2uiSurface {
  surfaceId: string;
  components: Record<string, A2uiComponent>;
  dataModel: Record<string, unknown>;
}

/** A component whose component-specific payload was checked against the bundled registry. */
export interface A2uiComponent {
  id: string;
  component: string;
  [key: string]: unknown;
}

/** A chat action emitted by one component in one surface. */
export interface UiAction {
  surfaceId: string;
  sourceComponentId: string;
  name: string;
  context: Record<string, unknown>;
}

/** The A2UI wire versions the plugin reads. */
export type A2uiVersion = "v0.9" | "1.0";

export type ValidationResult =
  | { ok: true; surfaces: A2uiSurface[]; warnings: string[]; version: A2uiVersion }
  | { ok: false; error: string };

export const A2UI_MAX_PAYLOAD_BYTES = 256 * 1024;
export const A2UI_MAX_COMPONENTS = 100;
export const A2UI_MAX_COMPONENT_DEPTH = 12;
export const A2UI_CATALOG_ID =
  "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
/** The plugin's own A2UI 1.0 catalog. It must equal `catalogId` in a2ui_core/catalogs/hermes-v1_0.json (a test checks). */
export const A2UI_CATALOG_ID_V1 =
  "https://github.com/Revenue-Architect/hermes-kaizen-ui/blob/main/packages/a2ui/a2ui_core/catalogs/hermes-v1_0.json";
