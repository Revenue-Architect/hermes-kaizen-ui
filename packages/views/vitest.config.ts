import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { GENUI_FILE, patchGenuiSource } from './scripts/react-ui-patches.mjs';
import { CSS_FILE, DEFAULTS_FILE, MATH_FILE, PALETTE_FILE, patchCss, patchDefaults, patchMath, patchPalette, POLICY_IMPORTERS, SHIM_PATH } from './scripts/dashboard-patches.mjs';

const DASHBOARD_PATCHES: [RegExp, (code: string) => string][] = [[DEFAULTS_FILE, patchDefaults], [CSS_FILE, patchCss], [MATH_FILE, patchMath], [PALETTE_FILE, patchPalette]];
const sdk = (stub: string) => ({ '@hermes/plugin-sdk': fileURLToPath(new URL(stub, import.meta.url)) });

// Each renderer keeps its own suite and SDK stub. OpenUI's tests run the same patched react-ui bundle that ships in plugin.js.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: sdk('./tests/a2ui/sdk-stub.tsx') },
        test: { name: 'a2ui', environment: 'jsdom', include: ['tests/a2ui/**/*.test.{ts,tsx}'], restoreMocks: true },
      },
      {
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
        resolve: { alias: sdk('./tests/openui/sdk.ts') },
        test: {
          name: 'openui', environment: 'jsdom', include: ['tests/openui/**/*.test.{ts,tsx}'], pool: 'forks', maxWorkers: 1, setupFiles: ['./tests/openui/setup.ts'],
          server: { deps: { inline: [/@openuidev\/react-ui/, /@openuidev\/dashboard-library/, /@openuidev\/react-components/, /react-markdown/] } },
        },
      },
    ],
  },
});
