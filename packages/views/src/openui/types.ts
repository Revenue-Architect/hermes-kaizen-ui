/** A validated, self-contained A2UI v0.9 surface. */
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

export type ValidationResult =
  | { ok: true; surfaces: A2uiSurface[]; warnings: string[] }
  | { ok: false; error: string };

export const A2UI_MAX_PAYLOAD_BYTES = 256 * 1024;
export const A2UI_MAX_COMPONENTS = 100;
export const A2UI_MAX_COMPONENT_DEPTH = 12;
export const A2UI_CATALOG_ID =
  "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";

