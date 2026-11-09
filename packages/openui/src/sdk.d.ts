declare module '@hermes/plugin-sdk' {
  import type { ReactNode } from 'react';
  export const PALETTE_AREA: string;
  export const TOOL_MEDIA_RENDERER_AREA: string;
  interface ReadableStore<T> { get(): T; listen(listener: (value: T) => void): () => void }
  export function useValue<T>(store: ReadableStore<T>): T;
  export const host: {
    composer: { submit(sessionId: string | null, text: string): boolean };
    state: {
      busyBySession: ReadableStore<Record<string, boolean>>;
      focusedSessionId: ReadableStore<string | null>;
      focusedStoredSessionId: ReadableStore<string | null>;
    };
    openWorkspace(id: string, options: { title: string; minWidth?: string; render: () => ReactNode }): () => void;
  };
  export interface ToolMediaRendererProps {
    file: { path: string; name: string; kind: string; mime: string; resolveUrl(): Promise<string> };
    toolName: string; toolCallId: string; args: Record<string, unknown>; result: unknown;
    sessionId: string | null; fallback: ReactNode;
  }
  export interface PluginContext {
    register(contribution: { id: string; area: string; title?: string; order?: number; data?: unknown; render?: () => ReactNode }): () => void;
    onDispose(callback: () => void): void;
    os: { openExternal(url: string): unknown };
    storage: { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void; remove(key: string): void };
  }
  export interface HermesPlugin { id: string; name?: string; defaultEnabled?: boolean; register(ctx: PluginContext): void }
}
