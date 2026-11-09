// The plugin's REST client (ctx.rest, scoped to /api/plugins/hermes-openui), held from register() to dispose so a
// hot reload never calls through a retired context.
type Rest = <T>(path: string, opts?: { method?: string; body?: unknown; timeoutMs?: number }) => Promise<T>;

let current: Rest | null = null;
let generation = 0;

export function setRest(rest: Rest | null): void {
  current = rest;
  generation++;
}

/** Calls through whichever context is current at call time; fails once the plugin is disposed. */
export const pluginRest: Rest = <T>(path: string, opts?: { method?: string; body?: unknown; timeoutMs?: number }) => {
  if (!current) return Promise.reject(Error('OpenUI dashboards are not loaded.'));
  return current<T>(path, opts);
};

/** Changes on every register/dispose, so surfaces drop work queued under an old context. */
export const restGeneration = () => generation;
export const restAvailable = () => current !== null;
