import type { Context } from 'react';
import '@openuidev/react-ui/genui-lib';
declare module '@openuidev/react-ui/genui-lib' {
  /** Added by scripts/react-ui-patches.mjs: the library's own (otherwise private) ThemeContext. */
  export const HermesThemeContext: Context<{ theme: Record<string, unknown>; mode: 'light' | 'dark'; portalThemeClassName: string }>;
}
