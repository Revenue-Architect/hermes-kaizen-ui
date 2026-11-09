import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@hermes/plugin-sdk': fileURLToPath(new URL('./tests/sdk-stub.tsx', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'], restoreMocks: true }
});
