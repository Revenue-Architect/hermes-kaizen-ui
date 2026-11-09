import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { GENUI_FILE, patchGenuiSource, reactDomShimPlugin } from './react-ui-patches.mjs';
import { CSS_FILE, DEFAULTS_FILE, MATH_FILE, PALETTE_FILE, patchCss, patchDefaults, patchMath, patchPalette, POLICY_IMPORTERS, SHIM_PATH } from './dashboard-patches.mjs';

const SYNTAX_SHIM = fileURLToPath(new URL('../src/v2/syntax-shim.tsx', import.meta.url));

execFileSync(process.execPath, ['scripts/scope-css.mjs'], { stdio: 'inherit' });

const patchReactUi = { name: 'hermes-react-ui-patch', setup(b) {
  b.onLoad({ filter: GENUI_FILE }, async (args) => ({ contents: patchGenuiSource(await readFile(args.path, 'utf8')), loader: 'js', resolveDir: args.path.replace(/[\\/][^\\/]*$/, '') }));
} };
const patchDashboard = { name: 'hermes-dashboard-patch', setup(b) {
  for (const [filter, patch] of [[DEFAULTS_FILE, patchDefaults], [CSS_FILE, patchCss], [MATH_FILE, patchMath], [PALETTE_FILE, patchPalette]]) {
    b.onLoad({ filter }, async (args) => ({ contents: patch(await readFile(args.path, 'utf8')), loader: 'js', resolveDir: args.path.replace(/[\\/][^\\/]*$/, '') }));
  }
  b.onResolve({ filter: /^react\/jsx-runtime$/ }, (args) => (POLICY_IMPORTERS.test(args.importer) ? { path: SHIM_PATH } : undefined));
} };
const noSyntaxHighlighter = { name: 'no-syntax-highlighter', setup(b) {
  b.onResolve({ filter: /^react-syntax-highlighter(\/.*)?$/ }, () => ({ path: SYNTAX_SHIM }));
} };
const shared = {
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', legalComments: 'eof',
  define: { 'process.env.NODE_ENV': '"production"' },
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
  plugins: [patchReactUi, patchDashboard, noSyntaxHighlighter, reactDomShimPlugin],
};

await mkdir('desktop', { recursive: true });
await build({ ...shared, entryPoints: ['src/plugin.tsx'], outfile: 'desktop/plugin.js' });

// The model's catalog, the Python checker's component list and the test programs all come from the library itself.
const temp = '.build';
await mkdir(temp, { recursive: true });
const forNode = { ...shared, platform: 'node', external: [], plugins: [patchReactUi, patchDashboard, noSyntaxHighlighter] };
await build({ ...forNode, entryPoints: ['src/v2/catalog-prompt.ts'], outfile: `${temp}/catalog.mjs`, banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" } });
await build({ ...forNode, entryPoints: ['src/v2/examples.ts'], outfile: `${temp}/examples.mjs` });
await build({ ...forNode, entryPoints: ['src/dash/catalog-prompt.ts'], outfile: `${temp}/dash-catalog.mjs`, banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" } });
const catalog = await import(`../${temp}/catalog.mjs`);
const { libraryExamples } = await import(`../${temp}/examples.mjs`);
await mkdir('skills/openui/references', { recursive: true });
await writeFile('skills/openui/references/CATALOG.md', `${catalog.libraryPrompt}\n`);
const dash = await import(`../${temp}/dash-catalog.mjs`);
await writeFile('skills/openui/references/DASHBOARDS.md', `${dash.dashboardPrompt}\n`);
const IMAGE_FIELD = /^(?!.*alt$).*(?:image|thumbnail|banner|picture)|^src$/i;
const hasImageField = (node) => Boolean(node) && typeof node === 'object' && Object.entries(node).some(([key, value]) => (key === 'properties' && Object.keys(value).some((name) => IMAGE_FIELD.test(name))) || hasImageField(value));
const schemas = catalog.openuiLibrary.toJSONSchema().$defs;
// Arguments are positional in schema order, so each component maps to the argument positions that hold images.
const imageComponents = Object.fromEntries(Object.keys(catalog.openuiLibrary.components).sort().flatMap((name) => {
  const positions = Object.entries(schemas[name]?.properties ?? {}).flatMap(([field, schema], position) => (IMAGE_FIELD.test(field) || hasImageField(schema) ? [position] : []));
  return positions.length ? [[name, positions]] : [];
}));
if (!imageComponents.ImageBlock) throw new Error('build: the component schema no longer names image fields');
await writeFile('openui_core/catalog.json', `${JSON.stringify({ components: Object.keys(catalog.openuiLibrary.components).sort(), dashboard_components: dash.dashboardComponents, image_components: imageComponents }, null, 1)}\n`);
await mkdir('tests/fixtures', { recursive: true });
await writeFile('tests/fixtures/examples.json', `${JSON.stringify(libraryExamples, null, 1)}\n`);
await writeFile('tests/fixtures/dashboard-examples.json', `${JSON.stringify(dash.dashboardExamples, null, 1)}\n`);
await rm(temp, { recursive: true, force: true });
