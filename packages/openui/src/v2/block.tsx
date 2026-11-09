import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { serializeInteraction } from '../interactions/serialize';
import { interactionContext, type LibraryActionEventLike } from './actions';
import { library } from './library';
import { acquireStyles, SURFACE_ATTR, SurfaceContext, type SurfaceState } from './surface';
import { validateLibraryProgram } from './validate';
import { DesktopTheme } from './theme';
import { libraryCss } from '../generated/library-css';

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export interface BlockProps {
  code: string;
  fenceClosed: boolean;
  streaming: boolean;
  readOnly: boolean;
  busy: boolean;
  answered?: boolean;
  origin: Readonly<{ messageId: string; blockIndex: number }>;
  submitInteraction(prompt: string): Promise<{ status: 'accepted' | 'blocked'; reason?: string }>;
  renderMedia?: (path: string, options?: { alt?: string }) => ReactNode;
}

const ANSWERED_REASON = 'This view has been answered.';
let hostOpenExternal: ((url: string) => unknown) | undefined;
export function setOpenExternal(open: ((url: string) => unknown) | undefined): void { hostOpenExternal = open; }
export const getOpenExternal = () => hostOpenExternal;

export function reasonFor(p: Pick<BlockProps, 'readOnly' | 'busy' | 'streaming'>, sending: boolean, superseded = false): string {
  if (p.readOnly) return 'Open the original chat to interact.';
  if (superseded) return ANSWERED_REASON;
  if (p.streaming) return 'This response is still arriving.';
  if (p.busy) return 'Hermes is busy; try again when it finishes.';
  if (sending) return 'Sending…';
  return '';
}

/** Renders one `openui` fence with the real @openuidev/react-ui openuiLibrary. */
export function LibraryOpenuiBlock(props: BlockProps & { validation?: ReturnType<typeof validateLibraryProgram> | null }) {
  const validation = useMemo(() => props.validation ?? (props.fenceClosed && !props.streaming ? validateLibraryProgram(props.code) : null), [props.validation, props.code, props.fenceClosed, props.streaming]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'status'; text: string } | null>(null);
  const lock = useRef(false);
  const superseded = Boolean(props.answered);
  const openExternal = hostOpenExternal;
  useLayoutEffect(() => acquireStyles(libraryCss), []);
  const disabled = props.readOnly || props.busy || sending || props.streaming || superseded;
  const reason = reasonFor(props, sending, superseded);
  const surface = useMemo<SurfaceState>(() => ({ blocked: disabled, reason, renderMedia: props.renderMedia, openExternal }), [disabled, reason, props.renderMedia, openExternal]);
  const defaults = validation?.ok ? validation.defaults : {};
  const identity = `${props.origin.messageId}:${props.origin.blockIndex}`;
  useEffect(() => { if (!disabled) setNotice((n) => (n?.kind === 'status' ? null : n)); }, [disabled]);

  const onAction = useCallback(async (event: LibraryActionEventLike) => {
    if (event.type === 'open_url') {
      const url = String(event.params?.url ?? '').trim();
      if (!openExternal || !/^(?:https?:\/\/|mailto:)/i.test(url)) { setNotice({ kind: 'status', text: 'This link cannot be opened from generated UI.' }); return; }
      try { await openExternal(url); } catch { setNotice({ kind: 'error', text: 'Could not open the link.' }); }
      return;
    }
    if (event.type !== 'continue_conversation') { setNotice({ kind: 'status', text: 'This action is not supported in Desktop.' }); return; }
    if (lock.current) return;
    if (disabled) { setNotice({ kind: 'status', text: reason || 'This surface cannot send a request.' }); return; }
    const context = interactionContext(event, defaults);
    if (!context) { setNotice({ kind: 'status', text: 'This button has no message to send.' }); return; }
    lock.current = true; setSending(true); setNotice(null);
    try {
      const outcome = await props.submitInteraction(serializeInteraction({
        surfaceId: `openui-${props.origin.messageId.slice(0, 90)}-${props.origin.blockIndex}`,
        sourceComponentId: 'openui-button',
        name: 'openui.continue',
        context: { renderer: 'openui', ...context },
      }));
      if (outcome.status !== 'accepted') throw Error(outcome.reason || 'The original chat cannot accept this request.');
    } catch (cause) {
      setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'Could not send this request.' });
    } finally { lock.current = false; setSending(false); }
  }, [defaults, disabled, openExternal, props, reason]);

  const source = (
    <section aria-label="OpenUI source">
      <p role="status">{!validation ? 'Preparing the interactive response…' : validation.ok ? 'Could not render this response.' : `Interactive response unavailable: ${validation.error}`}</p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}><code>{props.code.length > 20000 ? props.code.slice(0, 20000) + '\n…' : props.code}</code></pre>
    </section>
  );
  if (!validation?.ok) return source;
  return (
    <section {...{ [SURFACE_ATTR]: '1' }} data-openui-library-version="openuiLibrary" aria-label="OpenUI interactive response" className="hermes-openui-surface">
      {props.readOnly && <p role="status" className="hermes-openui-note">Open the original chat to interact.</p>}
      <Boundary key={identity + props.code} fallback={source}>
        <SurfaceContext.Provider value={surface}><DesktopTheme>
          <Renderer response={props.code} library={library} isStreaming={false} toolProvider={null} onAction={onAction as never} />
        </DesktopTheme></SurfaceContext.Provider>
      </Boundary>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} className="hermes-openui-note" data-kind={notice.kind}>{notice.text}</p>}
    </section>
  );
}
