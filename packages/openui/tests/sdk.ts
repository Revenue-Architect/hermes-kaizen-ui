export const TOOL_MEDIA_RENDERER_AREA = 'transcript.toolMedia';
export const PALETTE_AREA = 'palette';
const atom = <T,>(value: T) => ({ get: () => value, listen: () => () => undefined });
export const host = {
  openWorkspace: () => () => {},
  composer: { submit: () => true },
  request: (async () => ({ servers: [] })) as (method: string, params?: unknown) => Promise<unknown>,
  state: { profile: atom('default'), connectionId: atom<string | null>(null), busyBySession: atom<Record<string, boolean>>({}), focusedSessionId: atom<string | null>(null), focusedStoredSessionId: atom<string | null>(null) },
};
export const useValue = <T,>(store: { get(): T }): T => store.get();
