import { createContext, useContext, type ReactNode } from 'react';

export const PORTAL_CLASS = 'hermes-openui-portal';
export const SURFACE_ATTR = 'data-openui-library';
export const STYLE_ID = 'hermes-openui-library-css';

export interface SurfaceState {
  /** Sends are not allowed right now (read-only chat, stale message, busy, sending, streaming). */
  blocked: boolean;
  /** Why: shown as the visible disabled state. */
  reason: string;
  /** Host media renderer for Hermes-declared image artifacts. */
  renderMedia?: (path: string, options?: { alt?: string }) => ReactNode;
  /** Audited external-link bridge (window.hermesDesktop.openExternal); undefined when the host has none. */
  openExternal?: (url: string) => unknown;
  /** Dashboards: no image is ever loaded (business text may carry Markdown images); show the alt text instead. */
  noImages?: boolean;
}

export const SurfaceContext = createContext<SurfaceState>({ blocked: true, reason: 'Open the original chat to interact.' });
export const useSurface = () => useContext(SurfaceContext);

const refs = { count: 0 };
// Per bundle evaluation: Desktop loads a new plugin build before disposing the old one, and the old build's cleanup
// must only ever remove its own sheet, or surfaces of the new build lose their styling until one remounts.
const sheetId = STYLE_ID + '-' + Math.random().toString(36).slice(2, 10);
/** One shared <style> for every surface of this build (the sheet is ~300 KB). Always scoped to [data-openui-library] and the portal class. */
export function acquireStyles(css: string): () => void {
  if (typeof document === 'undefined') return () => {};
  let el = document.getElementById(sheetId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = sheetId;
    el.setAttribute('data-hermes-plugin', 'hermes-openui-desktop');
    el.textContent = css;
    document.head.appendChild(el);
  }
  refs.count++;
  return () => { refs.count--; };
}
/** Plugin dispose: remove this build's sheet. */
export function removeStyles() { if (typeof document !== 'undefined') document.getElementById(sheetId)?.remove(); refs.count = 0; }
