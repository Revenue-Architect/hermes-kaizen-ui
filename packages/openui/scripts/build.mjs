import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { GENUI_FILE, patchGenuiSource, reactDomShimPlugin } from './react-ui-patches.mjs';

const SYNTAX_SHIM = fileURLToPath(new URL('../src/v2/syntax-shim.tsx', import.meta.url));

execFileSync(process.execPath, ['scripts/scope-css.mjs'], { stdio: 'inherit' });

const patchReactUi = { name: 'hermes-react-ui-patch', setup(b) {
  b.onLoad({ filter: GENUI_FILE }, async (args) => ({ contents: patchGenuiSource(await readFile(args.path, 'utf8')), loader: 'js', resolveDir: args.path.replace(/[\\/][^\\/]*$/, '') }));
} };
const noSyntaxHighlighter = { name: 'no-syntax-highlighter', setup(b) {
  b.onResolve({ filter: /^react-syntax-highlighter(\/.*)?$/ }, () => ({ path: SYNTAX_SHIM }));
} };
const shared = {
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', legalComments: 'eof',
  define: { 'process.env.NODE_ENV': '"production"' },
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
  plugins: [patchReactUi, noSyntaxHighlighter, reactDomShimPlugin],
};

await mkdir('desktop', { recursive: true });
await build({ ...shared, entryPoints: ['src/plugin.tsx'], outfile: 'desktop/plugin.js' });

// The model's catalog, the Python checker's component list and the test programs all come from the library itself.
const temp = '.build';
await mkdir(temp, { recursive: true });
const forNode = { ...shared, platform: 'node', external: [], plugins: [patchReactUi, noSyntaxHighlighter] };
await build({ ...forNode, entryPoints: ['src/v2/catalog-prompt.ts'], outfile: `${temp}/catalog.mjs`, banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" } });
await build({ ...forNode, entryPoints: ['src/v2/examples.ts'], outfile: `${temp}/examples.mjs` });
const catalog = await import(`../${temp}/catalog.mjs`);
const { libraryExamples } = await import(`../${temp}/examples.mjs`);
await mkdir('skills/openui/references', { recursive: true });
await writeFile('skills/openui/references/CATALOG.md', `${catalog.libraryPrompt}\n`);
await writeFile('openui_core/catalog.json', `${JSON.stringify({ components: Object.keys(catalog.openuiLibrary.components).sort() }, null, 1)}\n`);
await mkdir('tests/fixtures', { recursive: true });
await writeFile('tests/fixtures/examples.json', `${JSON.stringify(libraryExamples, null, 1)}\n`);
await rm(temp, { recursive: true, force: true });
