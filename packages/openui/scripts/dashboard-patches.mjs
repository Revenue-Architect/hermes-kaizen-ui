// Build-time patches for the dashboard library's runtime (@openuidev/react-components 0.0.2), shared by the
// esbuild build (scripts/build.mjs) and vitest (vitest.config.ts) so tests run what ships.
//
// 1. styles/defaults.mjs writes the whole default token set onto :root as soon as it is imported. In Desktop
//    that would set --openui-* on the entire window (and under the react-ui surfaces). It becomes a no-op: every
//    dashboard is wrapped in the library's ThemeProvider, which writes the full token set onto its own scope.
// 2. styles/css.mjs is the sink every component rule goes through. Each evaluation of the bundle gets its own store
//    and its own sheet (Desktop loads a new plugin build before disposing the old one, so a shared store would let
//    the old build's cleanup wipe the new build's rules), our cascade layer, and a reset that src/dash/library.ts
//    picks up straight after this module runs.
// 3. Everything these packages (and react-markdown) render goes through our element policy (src/v2/jsx-shim.tsx).
// Every patch requires its exact anchor and throws when the package changed, so an upgrade fails the build.
import { fileURLToPath } from 'node:url';

export const DEFAULTS_FILE = /@openuidev[\\/]react-components[\\/]dist[\\/]styles[\\/]defaults\.mjs$/;
export const CSS_FILE = /@openuidev[\\/]react-components[\\/]dist[\\/]styles[\\/]css\.mjs$/;
export const MATH_FILE = /@openuidev[\\/]react-components[\\/]dist[\\/]components[\\/]TextContentWrapper[\\/]mathRenderer\.mjs$/;
export const POLICY_IMPORTERS = /[\\/]node_modules[\\/](?:@openuidev[\\/](?:dashboard-library|react-components)|react-markdown)[\\/]/;
export const SHIM_PATH = fileURLToPath(new URL('../src/v2/jsx-shim.tsx', import.meta.url));

export function patchDefaults(code) {
  if (!code.includes('@layer openui-defaults{:where(:root){')) throw new Error('react-components patch: defaults anchor not found; the package changed');
  return 'export {};\n';
}

// 4. Math in Markdown would pull in KaTeX (CSS, fonts, a dynamic import). Dashboards show business text, so the
//    lazily loaded math renderer becomes a no-op rehype plugin and any $$…$$ stays as plain text.
export function patchMath(code) {
  if (!code.includes('rehype-katex') || !code.includes('katex/dist/katex.min.css')) throw new Error('react-components patch: math renderer anchor not found; the package changed');
  return 'export default function hermesNoMath() { return () => {}; }\n';
}

// 5. The dashboard charts pass a hardcoded blue palette as `customPalette`, which outranks the theme. An empty list
//    lets the theme's palettes (Desktop's Kaizen chart colours) apply.
export const PALETTE_FILE = /@openuidev[\\/]dashboard-library[\\/]dist[\\/]lib[\\/]Charts[\\/]chartPalette\.mjs$/;
export function patchPalette(code) {
  if (!code.includes('const DASHBOARD_CHART_PALETTE = [') || !code.includes('export { DASHBOARD_CHART_PALETTE };')) throw new Error('dashboard-library patch: chart palette anchor not found; the package changed');
  return 'export const DASHBOARD_CHART_PALETTE = [];\n';
}

const replaceOnce = (code, from, to, what) => {
  if (code.split(from).length !== 2) throw new Error(`react-components patch: ${what} anchor not found; the package changed`);
  return code.replace(from, to);
};

export function patchCss(code) {
  let out = replaceOnce(code, 'const SHEET_ID = "openui-styles";', 'const SHEET_ID = "hermes-openui-dashboard-styles-" + Math.random().toString(36).slice(2, 10);', 'sheet id');
  out = replaceOnce(out, 'const store = globalThis[STORE] ??= {', 'const store = {', 'store');
  out = replaceOnce(out, '\tlayer: void 0\n};', '\tlayer: "hermes-openui"\n};', 'layer');
  // A layer ranks by where it is first declared. Prepended, this sheet declared hermes-openui ahead of Desktop's
  // main CSS, so Tailwind's base reset beat every OpenUI component rule (11/05, seen on Desktop 0.23.0).
  out = replaceOnce(out, 'else document.head.prepend(tag);', 'else document.head.append(tag);', 'sheet position');
  out = replaceOnce(out, '//#endregion\nexport { configureStyles, css, keyframes };', `globalThis[Symbol.for("hermes-openui/dashboard-styles-reset")] = () => {
	if (typeof document !== "undefined") document.getElementById(SHEET_ID)?.remove();
	store.rules = ""; store.written = 0; store.emitted = false; store.scheduled = false;
};
//#endregion
export { configureStyles, css, keyframes };`, 'exports');
  return out;
}
