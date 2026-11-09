import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

execFileSync(process.execPath, ['src/validation/generate-validators.mjs'], { stdio: 'inherit' });
await build({
  entryPoints: ['src/plugin.tsx'],
  outfile: 'desktop/plugin.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
  legalComments: 'eof',
  sourcemap: false,
  minify: false,
});
