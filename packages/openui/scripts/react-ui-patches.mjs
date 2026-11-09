// The two build-time patches applied to @openuidev/react-ui's genui-lib bundle. Shared by the esbuild
// plugin (scripts/build.mjs) and the vitest plugin (vitest.config.ts) so tests exercise the same code.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SHIM_PATH = fileURLToPath(new URL('../src/v2/jsx-shim.tsx', import.meta.url));
export const GENUI_FILE = /@openuidev[\\/]react-ui[\\/]dist[\\/]genui-lib[\\/]index\.mjs$/;
export const PORTAL_CLASS = 'hermes-openui-portal';

export function patchGenuiSource(code, shim = SHIM_PATH) {
  // 1. Every element the library creates goes through our element policy (images, links, inline styles).
  const spec = JSON.stringify(shim.split(path.sep).join('/'));
  let out = code.replace(/from "react\/jsx-runtime"/, `from ${spec}`);
  if (out === code) throw new Error('react-ui patch: jsx-runtime import not found; react-ui layout changed');
  // 2. The library's portals (Select, Modal, DatePicker, tooltips, gallery viewer) carry our scope class
  //    so the scoped stylesheet (and no one else's) styles them.
  const before = out;
  out = out.replace(/(createContext\(\{\s*theme: defaultLightTheme,\s*mode: "light",\s*portalThemeClassName: )""/, `$1"${PORTAL_CLASS}"`);
  if (out === before) throw new Error('react-ui patch: ThemeContext default not found; react-ui layout changed');
  // 3. Expose the library's ThemeContext so Desktop can supply the chart palette and mode.
  out += '\nexport { ThemeContext as HermesThemeContext };\n';
  return out;
}

export const REACT_CJS_SHIM = fileURLToPath(new URL('../src/v2/react-cjs-shim.ts', import.meta.url));
export const REACT_DOM_SHIM = fileURLToPath(new URL('../src/v2/react-dom-shim.ts', import.meta.url));
/** esbuild plugin: everything except react-dom's own files gets the shim instead of `react-dom`. */
export const reactDomShimPlugin = {
  name: 'hermes-react-dom-shim',
  setup(build) {
    build.onResolve({ filter: /^react$/ }, (args) => (args.kind === 'require-call' ? { path: REACT_CJS_SHIM } : undefined));
    build.onResolve({ filter: /^react-dom$/ }, (args) => (/[\\/]node_modules[\\/]react-dom[\\/]/.test(args.importer) ? undefined : { path: REACT_DOM_SHIM }));
  },
};
