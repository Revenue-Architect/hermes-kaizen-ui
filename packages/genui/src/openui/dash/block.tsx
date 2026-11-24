import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { host, useValue } from '@hermes/plugin-sdk';
import { serializeInteraction } from '../interactions/serialize';
import { interactionContext, type LibraryActionEventLike } from '../v2/actions';
import { getOpenExternal, reasonFor, type BlockProps } from '../v2/block';
import { SurfaceContext, type SurfaceState } from '../v2/surface';
import { dashboardLibrary } from './library';
import { acquireDashboardStyles } from './styles';
import { DashboardTheme } from './theme';
import { createDashboardTools, DataError, readSource, serverOf, waitForServer } from './tools';
import { pluginRest, restAvailable, restGeneration } from './runtime';
import { validateDashboardProgram } from './validate';

export const DASHBOARD_ATTR = 'data-openui-dashboard';
/** A surface keeps its live data this long after it scrolls away or the window hides, so quick scrolls don't refetch. */
export const IDLE_GRACE_MS = 20_000;
/** At most this many reads per surface per minute, whatever the program's buttons and filters do. */
export const READS_PER_MINUTE = 20;

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * Live while on screen and the window is visible; after IDLE_GRACE_MS away the data provider is dropped,
 * which stops refresh timers and further reads (filters are kept; results reload on return).
 */
export function useLive(el: HTMLElement | null, enabled: boolean): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [live, setLive] = useState(false);
  // Observes whichever element is mounted now (a callback ref feeds `el`, so a surface that appears later counts).
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { rootMargin: '200px 0px' });
    io.observe(el);
    return () => { io.disconnect(); setOnScreen(false); };
  }, [el]);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const want = enabled && onScreen && visible;
  useEffect(() => {
    if (want) { setLive(true); return; }
    const timer = setTimeout(() => setLive(false), IDLE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [want]);
  return live && enabled;
}

type QueryError = { source?: string; message?: string };

/** One dashboard: a live, read-only OpenUI view over the sources this Hermes lists. */
export function DashboardBlock(props: BlockProps & { backendId: string }) {
  const validation = useMemo(() => validateDashboardProgram(props.code), [props.code]);
  const rootRef = useRef<HTMLElement | null>(null);
  const [surfaceEl, setSurfaceEl] = useState<HTMLElement | null>(null);
  const attach = useCallback((node: HTMLElement | null) => { rootRef.current = node; setSurfaceEl(node); }, []);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'status'; text: string } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [waitingFor, setWaitingFor] = useState('');
  const lock = useRef(false);
  const reads = useRef<number[]>([]);
  const openExternal = getOpenExternal();
  useLayoutEffect(() => { acquireDashboardStyles(); }, []);
  const live = useLive(surfaceEl, validation.ok && restAvailable());
  const generation = restGeneration();
  const profile = useValue(host.state.profile);
  const connectionId = useValue(host.state.connectionId);
  const owner = `${connectionId ?? ''}\n${profile}`;

  // Toggling the provider is also how Retry re-runs every query (a fresh query manager), keeping filter state.
  const provider = useRef<unknown>(null);
  // Status: failures are the query manager's own per-query errors (onError re-fires with [] once they clear, so a
  // later success of another query cannot hide one that is still failing). Loading counts this provider epoch's
  // pending reads; a read from an earlier epoch (before going idle or a Retry) settles without touching it.
  const epoch = useRef(0);
  const counter = useRef({ epoch: 0, n: 0 });
  const [, repaint] = useState(0);
  const [queryErrors, setQueryErrors] = useState<QueryError[]>([]);
  const tools = useMemo(() => {
    const servers = new Map<string, Promise<void>>();
    return createDashboardTools(validation.ok ? validation.sources : [], async (source, args) => {
      const mine = epoch.current;
      if (counter.current.epoch !== mine) counter.current = { epoch: mine, n: 0 };
      counter.current.n++; repaint((x) => x + 1);
      try {
        const now = Date.now();
        reads.current = reads.current.filter((t) => now - t < 60_000);
        if (reads.current.length >= READS_PER_MINUTE) throw Error('Too many refreshes; wait a minute and try again.');
        reads.current.push(now);
        const server = serverOf(source);
        let ready = servers.get(server);
        if (!ready) {
          ready = waitForServer(server, (method, params) => host.request(method, params), (waiting) => { if (!waiting || epoch.current === mine) setWaitingFor(waiting ? server : ''); });
          servers.set(server, ready);
          // Shared only while waiting: every later read asks again, so a server that dropped isn't called.
          const done = () => servers.delete(server);
          ready.then(done, done);
        }
        await ready;
        if (epoch.current !== mine) throw new DataError('This read is no longer needed.', 'stale');
        return await readSource(pluginRest, source, args, props.backendId);
      } catch (error) {
        if (error instanceof DataError && error.code === 'wrong_backend' && epoch.current === mine) setPaused(true);
        throw error;
      } finally {
        if (counter.current.epoch === mine) { counter.current.n--; repaint((x) => x + 1); }
      }
    });
    // A new plugin context, card or connection needs a new provider; the validation only changes with the program.
  }, [generation, owner, props.backendId, validation]);

  const previousOwner = useRef(owner);
  useEffect(() => {
    if (previousOwner.current === owner) return;
    previousOwner.current = owner;
    setPaused(false);
    setRetrying(true);
  }, [owner]);

  const active = live && !retrying && !paused ? tools : null;
  if (provider.current !== active) { provider.current = active; epoch.current++; }
  const pending = counter.current.epoch === epoch.current ? counter.current.n : 0;
  useEffect(() => { if (retrying) setRetrying(false); }, [retrying]);
  const onError = useCallback((errors: QueryError[]) => setQueryErrors((errors ?? []).filter((e) => e?.source === 'query')), []);
  const status: { state: 'idle' | 'loading' | 'ok' | 'failed' | 'paused'; reason?: string } = paused
    ? { state: 'paused' }
    : !active
      ? { state: retrying ? 'loading' : 'idle' }
      : queryErrors.length ? { state: 'failed', reason: String(queryErrors[0]!.message ?? 'Could not load the data.').slice(0, 200) }
        : pending > 0 ? { state: 'loading' } : { state: 'ok' };

  const disabled = props.readOnly || props.busy || sending || props.streaming || Boolean(props.answered);
  const reason = reasonFor(props, sending, Boolean(props.answered));
  const surface = useMemo<SurfaceState>(() => ({ blocked: disabled, reason, renderMedia: undefined, openExternal, noImages: true }), [disabled, reason, openExternal]);
  const onAction = useCallback(async (event: LibraryActionEventLike) => {
    if (event.type === 'open_url') {
      const url = String(event.params?.url ?? '').trim();
      if (!openExternal || !/^(?:https?:\/\/|mailto:)/i.test(url)) { setNotice({ kind: 'status', text: 'This link cannot be opened from a dashboard.' }); return; }
      try { await openExternal(url); } catch { setNotice({ kind: 'error', text: 'Could not open the link.' }); }
      return;
    }
    if (event.type !== 'continue_conversation') return; // run / set / reset stay inside the renderer
    if (lock.current) return;
    if (disabled) { setNotice({ kind: 'status', text: reason || 'This dashboard cannot send a request.' }); return; }
    const context = interactionContext(event, {});
    if (!context) { setNotice({ kind: 'status', text: 'This button has no message to send.' }); return; }
    lock.current = true; setSending(true); setNotice(null);
    try {
      const outcome = await props.submitInteraction(serializeInteraction({
        surfaceId: `openui-dashboard-${props.origin.messageId.slice(0, 80)}-${props.origin.blockIndex}`,
        sourceComponentId: 'openui-dashboard-button',
        name: 'openui.continue',
        context: { renderer: 'openui-dashboard', ...context },
      }));
      if (outcome.status !== 'accepted') throw Error(outcome.reason || 'The original chat cannot accept this request.');
    } catch (cause) {
      setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'Could not send this request.' });
    } finally { lock.current = false; setSending(false); }
  }, [disabled, openExternal, props, reason]);

  const source = (
    <section aria-label="Dashboard source">
      <p role="status">{validation.ok ? 'Could not render this dashboard.' : `Dashboard unavailable: ${validation.error}`}</p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}><code>{props.code.length > 20000 ? props.code.slice(0, 20000) + '\n…' : props.code}</code></pre>
    </section>
  );
  if (!validation.ok) return source;
  const strip = status.state === 'failed'
    ? <div className="hod-status" data-state="failed" role="alert"><span className="hod-pill"><span className="hod-dot" />Couldn't load live data: {status.reason}</span><button type="button" className="hod-retry" disabled={!live} onClick={() => setRetrying(true)}>Retry</button><span>Figures shown are placeholders, not real values.</span></div>
    : status.state === 'paused'
      ? <div className="hod-status" data-state="idle" role="status"><span className="hod-pill">Switch to the Hermes profile this came from to load live data</span></div>
      : status.state === 'loading'
        ? <div className="hod-status" data-state="loading" role="status"><span className="hod-pill"><span className="hod-dot" />{waitingFor ? `Connecting to ${waitingFor}…` : 'Loading live data…'}</span></div>
        : !live
          ? <div className="hod-status" data-state="idle" role="status"><span className="hod-pill">Live data loads when this dashboard is on screen</span></div>
          : <div className="hod-status" data-state="ok" role="status"><span className="hod-pill"><span className="hod-dot" />Live · read-only</span></div>;
  return (
    <section ref={attach} {...{ [DASHBOARD_ATTR]: '1' }} data-dim={status.state === 'failed' || status.state === 'paused' || !live ? 'true' : 'false'} aria-label="Live dashboard" className="hermes-openui-dashboard">
      {strip}
      <div className="hod-body">
        <Boundary key={props.origin.messageId + ':' + props.origin.blockIndex + props.code} fallback={source}>
          <SurfaceContext.Provider value={surface}><DashboardTheme>
            <Renderer response={props.code} library={dashboardLibrary} isStreaming={false} toolProvider={active} onAction={onAction as never} onError={onError as never} queryLoader={null} />
          </DashboardTheme></SurfaceContext.Provider>
        </Boundary>
      </div>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} className="hermes-openui-note" data-kind={notice.kind}>{notice.text}</p>}
    </section>
  );
}
