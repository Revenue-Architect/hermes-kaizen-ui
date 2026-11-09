// Prints the browser validator's verdict for each payload in a JSON array. tests/test_parity.py compares them.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/validation/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  write: false,
  loader: { '.json': 'json' },
});
const url = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { validateAndNormalize } = await import(url);
const corpus = JSON.parse(readFileSync(process.argv[2], 'utf8'));
process.stdout.write(JSON.stringify(corpus.map((payload) => {
  const result = validateAndNormalize(payload);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
})));
