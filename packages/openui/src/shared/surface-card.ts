// Client helpers shared by the A2UI and OpenUI plugins. Copied into each package by scripts/sync-shared.mjs.
import { useSyncExternalStore } from 'react';
import { host, useValue, type PluginContext } from '@hermes/plugin-sdk';

export function decodeBase64Utf8(encoded: string): string {
  const binary = atob(encoded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** The payload embedded in a saved surface file, given that file as a data URL or as text. */
export function payloadFromSavedFile(pluginId: string, source: string): string | null {
  let text = source;
  const dataUrl = /^data:[^,]*;base64,(.*)$/su.exec(source);
  if (dataUrl) text = decodeBase64Utf8(dataUrl[1]!);
  const marker = `<!-- ${pluginId}:payload `;
  const start = text.lastIndexOf(marker);
  if (start < 0) return null;
  const end = text.indexOf(" -->", start);
  if (end < 0) return null;
  try {
    return decodeBase64Utf8(text.slice(start + marker.length, end));
  } catch {
    return null;
  }
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
