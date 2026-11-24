export const SHIM_PATH: string;
export const GENUI_FILE: RegExp;
export const PORTAL_CLASS: string;
export function patchGenuiSource(code: string, shim?: string): string;
export const REACT_DOM_SHIM: string;
export const reactDomShimPlugin: import('esbuild').Plugin;
export const REACT_CJS_SHIM: string;
