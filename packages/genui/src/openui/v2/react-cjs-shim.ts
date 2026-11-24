// CommonJS dependencies (zustand's use-sync-external-store) call require("react"). The plugin loader only
// supplies `react` as an ES import, so route those requires through this ES module, which imports it.
// @ts-ignore @types/react is `export =`; esbuild re-exports the real namespace.
export * from 'react';
