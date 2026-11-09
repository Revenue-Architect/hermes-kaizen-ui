// Client helpers shared by the A2UI and OpenUI plugins. Copied into each package by scripts/sync-shared.mjs.
import { createElement, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { host, useValue, type PluginContext } from '@hermes/plugin-sdk';
import { classifyImageSrc } from './images';

export function decodeBase64Utf8(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

export type SavedImages = ReadonlyMap<string, string>;
export interface SavedSurface { payload: string | null; images: SavedImages }

const NO_IMAGES: SavedImages = new Map();
const IMAGE_TYPE = /^image\/(?:png|jpeg|gif|webp)$/;

function imagesIn(pluginId: string, text: string): SavedImages {
  const images = new Map<string, string>();
  const marker = `<!-- ${pluginId}:image `;
  for (let start = text.indexOf(marker); start >= 0; start = text.indexOf(marker, start + marker.length)) {
    const end = text.indexOf(" -->", start);
    if (end < 0) break;
    const [name, mime, data] = text.slice(start + marker.length, end).split(" ");
    if (!name || !mime || !data || !IMAGE_TYPE.test(mime)) continue;
    try {
      images.set(decodeBase64Utf8(name.replace(/-/gu, "+").replace(/_/gu, "/")), `data:${mime};base64,${data}`);
    } catch {
      continue;
    }
  }
  return images;
}

/** The payload and images embedded in a saved surface file, given that file as a data URL or as text. */
export function readSavedFile(pluginId: string, source: string): SavedSurface {
  let text = source;
  const dataUrl = /^data:[^,]*;base64,(.*)$/su.exec(source);
  try {
    if (dataUrl) text = decodeBase64Utf8(dataUrl[1]!);
  } catch {
    return { payload: null, images: NO_IMAGES };
  }
  const images = imagesIn(pluginId, text);
  const marker = `<!-- ${pluginId}:payload `;
  const start = text.lastIndexOf(marker);
  const end = start < 0 ? -1 : text.indexOf(" -->", start);
  if (end < 0) return { payload: null, images };
  try {
    return { payload: decodeBase64Utf8(text.slice(start + marker.length, end)), images };
  } catch {
    return { payload: null, images };
  }
}

export function payloadFromSavedFile(pluginId: string, source: string): string | null {
  return readSavedFile(pluginId, source).payload;
}

const STRING_LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/gu;

/** Does this program or payload name a local image? A false yes only costs one read of the saved file. */
export function namesLocalImage(source: string): boolean {
  const code = source.replace(/^\s*(?:#|\/\/).*$/gmu, '');
  return [...code.matchAll(STRING_LITERAL)].some(([literal]) => classifyImageSrc(literal.slice(1, -1).replace(/\\(.)/gu, '$1')).kind === 'media');
}

/** The program from the tool's arguments when the chat still has them; the saved file for anything else. */
export function useSurfaceSource(pluginId: string, file: { resolveUrl(): Promise<string> }, fromArgs: string | null): { payload: string | null; loading: boolean; images: SavedImages; imagesLoading: boolean } {
  const needsFile = useMemo(() => fromArgs === null || namesLocalImage(fromArgs), [fromArgs]);
  const [saved, setSaved] = useState<SavedSurface & { loading: boolean }>({ payload: null, images: NO_IMAGES, loading: needsFile });
  useEffect(() => {
    if (!needsFile) return;
    let live = true;
    file.resolveUrl().then(
      (url) => { if (live) setSaved({ ...readSavedFile(pluginId, url), loading: false }); },
      () => { if (live) setSaved({ payload: null, images: NO_IMAGES, loading: false }); },
    );
    return () => { live = false; };
  }, [file, needsFile, pluginId]);
  return { payload: fromArgs ?? saved.payload, loading: fromArgs === null && saved.loading, images: saved.images, imagesLoading: needsFile && saved.loading };
}

export type MediaOptions = { alt?: string; style?: CSSProperties };
export type MediaRenderer = (source: string, options?: MediaOptions) => ReactNode;

/** Draws a local image from the saved file, or a link the image policy allows. Null means show your own fallback. */
export function useMediaRenderer(images: SavedImages, loading: boolean): MediaRenderer {
  return useMemo(() => (source: string, options: MediaOptions = {}) => {
    const decision = classifyImageSrc(source);
    if (decision.kind === 'reject') return null;
    if (decision.kind === 'media' && loading) return createElement('span', { 'aria-busy': true, style: { display: 'block', minHeight: 48 } });
    const src = decision.kind === 'url' ? decision.src : images.get(decision.path);
    return src ? createElement('img', {
      src, alt: options.alt ?? '', decoding: 'async', draggable: false, referrerPolicy: 'no-referrer',
      style: { display: 'block', margin: 0, maxWidth: '100%', height: 'auto', ...options.style }, // chat styling adds a large margin to images
    }) : null;
  }, [images, loading]);
}

/** One message: a line for people, then the machine context Desktop folds away. */
export function answerMessage(summary: string, machineText: string): string {
  // Hermes would otherwise expand an @file: or @url: reference found in user-entered values.
  const body = machineText.replace(/@/gu, "\\u0040");
  const line = summary.replace(/\s+/gu, " ").trim().slice(0, 200) || "Sent";
  return `${line}\n\n--- Attached Context ---\n\n${body}`;
}

/** "approve.deal_now" becomes "Approve deal now". */
export function actionSummary(name: string): string {
  const words = name.replace(/[._-]+/gu, " ").trim();
  return words ? `${words[0]!.toUpperCase()}${words.slice(1)}` : "Sent";
}

// `busyBySession` is keyed by runtime id and a renderer is handed the stored id. The host only exposes the
// pair for the focused chat, so every pair seen is kept for tiles that lose focus.
const runtimeIds = new Map<string, string>();

export function useSessionBusy(sessionId: string | null): boolean {
  const busy = useValue(host.state.busyBySession);
  const runtime = useValue(host.state.focusedSessionId);
  const stored = useValue(host.state.focusedStoredSessionId);
  if (stored && runtime) runtimeIds.set(stored, runtime);
  const key = sessionId ? (runtimeIds.get(sessionId) ?? sessionId) : null;
  return Boolean(key && busy?.[key]);
}

// One answered flag per surface file, shared by every mounted copy of that surface.
let storage: PluginContext['storage'] | null = null;
const listeners = new Set<() => void>();
const answeredKey = (surfaceFile: string) => `answered.${surfaceFile}`;

export function bindAnswerStorage(next: PluginContext['storage'] | null): void {
  storage = next;
}

export function markAnswered(surfaceFile: string): void {
  storage?.set(answeredKey(surfaceFile), true);
  for (const listener of listeners) listener();
}

export function useAnswered(surfaceFile: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => Boolean(storage?.get(answeredKey(surfaceFile), false)),
  );
}
