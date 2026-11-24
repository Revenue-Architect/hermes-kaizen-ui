// What a dashboard can read: the MCP tools the user listed in dashboard_sources. The backend route decides what
// is listed; this side only needs each Query's source to be a plain `server.tool` name.
export const LIMITS = { refreshMinSeconds: 120, maxQueries: 6, maxActionSteps: 6, requestTimeoutSeconds: 45 } as const;

type Rest = <T>(path: string, opts?: { method?: string; body?: unknown; timeoutMs?: number }) => Promise<T>;
type StatusRequest = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

const SOURCE = /^[^\s.]{1,64}\.\S{1,128}$/;
export const isSourceName = (name: unknown): name is string => typeof name === 'string' && SOURCE.test(name);
export const serverOf = (source: string): string => source.slice(0, source.indexOf('.'));

/** `code` comes from the backend route. wrong_backend means this card belongs to another profile or connection. */
export class DataError extends Error {
  constructor(message: string, readonly code = 'failed') { super(message); }
}

const reasonOf = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 200) || 'Could not load the data.';
};

const delay = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });
/** Hermes has no event for "this server connected", and its status call never touches the server. */
export const STATUS_WAITS = [0, 2000, 4000, 8000, 16000, 30000];

export async function waitForServer(server: string, request: StatusRequest, onWaiting?: (waiting: boolean) => void, sleep = delay): Promise<void> {
  try {
    for (const wait of STATUS_WAITS) {
      if (wait) await sleep(wait);
      let row: { status?: string } | undefined;
      try {
        const answer = await request('mcp.servers.status', {}) as { servers?: { name?: string; status?: string }[] };
        row = answer?.servers?.find((item) => item?.name === server);
      } catch {
        return; // no status on this backend: the read itself reports any problem
      }
      if (!row || row.status === 'connected' || row.status === 'lazy') return;
      if (row.status === 'disabled') throw new DataError(`${server} is turned off in Hermes.`);
      if (row.status === 'failed') throw new DataError(`Hermes couldn't connect to ${server}.`);
      onWaiting?.(true);
    }
    throw new DataError(`${server} hasn't connected yet.`);
  } finally {
    onWaiting?.(false);
  }
}

export async function readSource(rest: Rest, source: string, args: unknown, backendId: string): Promise<unknown> {
  let answer: { ok?: unknown; data?: unknown; error?: unknown; code?: unknown };
  try {
    answer = await rest('/data', { method: 'POST', body: { source, args: args ?? {}, backend_id: backendId }, timeoutMs: LIMITS.requestTimeoutSeconds * 1000 });
  } catch (error) {
    throw new DataError(reasonOf(error));
  }
  if (!answer || answer.ok !== true || !('data' in answer)) {
    throw new DataError(reasonOf(answer?.error) || 'The data service returned an unexpected answer.', typeof answer?.code === 'string' ? answer.code : 'failed');
  }
  return answer.data;
}

/**
 * Renderer `toolProvider`: a null-prototype map holding this dashboard's own sources, so inherited names
 * (`constructor`, `toString`) are not tools. A failed read throws, it never resolves to an error object.
 */
export function createDashboardTools(sources: readonly string[], read: (source: string, args: unknown) => Promise<unknown>) {
  const map = Object.create(null) as Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  for (const source of sources) map[source] = (args) => read(source, args);
  return Object.freeze(map);
}
