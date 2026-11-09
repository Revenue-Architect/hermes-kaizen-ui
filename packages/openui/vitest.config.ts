import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { GENUI_FILE, patchGenuiSource } from './scripts/react-ui-patches.mjs';

// Tests run the same patched react-ui bundle that ships in plugin.js.
export default defineConfig({
  plugins: [{
    name: 'hermes-react-ui-patch', enforce: 'pre',
    transform(code: string, id: string) { return GENUI_FILE.test(id.split('?')[0]!) ? { code: patchGenuiSource(code), map: null } : null; },
  }],
  test: { environment: 'jsdom', pool: 'forks', maxWorkers: 1, setupFiles: ['./tests/setup.ts'], server: { deps: { inline: [/@openuidev\/react-ui/] } } },
  resolve: { alias: { '@hermes/plugin-sdk': fileURLToPath(new URL('./tests/sdk.ts', import.meta.url)) } },
});
