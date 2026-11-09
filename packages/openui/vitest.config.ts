import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { GENUI_FILE, patchGenuiSource } from './scripts/react-ui-patches.mjs';
import { CSS_FILE, DEFAULTS_FILE, MATH_FILE, PALETTE_FILE, patchCss, patchDefaults, patchMath, patchPalette, POLICY_IMPORTERS, SHIM_PATH } from './scripts/dashboard-patches.mjs';

const DASHBOARD_PATCHES: [RegExp, (code: string) => string][] = [[DEFAULTS_FILE, patchDefaults], [CSS_FILE, patchCss], [MATH_FILE, patchMath], [PALETTE_FILE, patchPalette]];

// Tests run the same patched react-ui bundle that ships in plugin.js.
export default defineConfig({
  plugins: [{
    name: 'hermes-react-ui-patch', enforce: 'pre',
    resolveId(source: string, importer?: string) { return source === 'react/jsx-runtime' && importer && POLICY_IMPORTERS.test(importer) ? SHIM_PATH : null; },
    transform(code: string, id: string) {
      const file = id.split('?')[0]!;
      if (GENUI_FILE.test(file)) return { code: patchGenuiSource(code), map: null };
      const patch = DASHBOARD_PATCHES.find(([match]) => match.test(file));
      return patch ? { code: patch[1](code), map: null } : null;
    },
  }],
  test: { environment: 'jsdom', pool: 'forks', maxWorkers: 1, setupFiles: ['./tests/setup.ts'], server: { deps: { inline: [/@openuidev\/react-ui/, /@openuidev\/dashboard-library/, /@openuidev\/react-components/, /react-markdown/] } } },
  resolve: { alias: { '@hermes/plugin-sdk': fileURLToPath(new URL('./tests/sdk.ts', import.meta.url)) } },
});
