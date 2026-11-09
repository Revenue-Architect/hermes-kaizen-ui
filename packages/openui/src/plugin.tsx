import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { host, PALETTE_AREA, TOOL_MEDIA_RENDERER_AREA, type HermesPlugin, type ToolMediaRendererProps } from '@hermes/plugin-sdk';
import { actionSummary, answerMessage, bindAnswerStorage, markAnswered, useAnswered, useMediaRenderer, useSessionBusy, useSurfaceSource } from './shared/surface-card';
import { LibraryOpenuiBlock, setOpenExternal, type BlockProps } from './v2/block';
import { libraryExamples } from './v2/examples';
import { library } from './v2/library';
import { removeStyles, SURFACE_ATTR, SurfaceContext, acquireStyles } from './v2/surface';
import { DesktopTheme } from './v2/theme';
import { libraryCss } from './generated/library-css';
import { DashboardBlock } from './dash/block';
import { resetComponentStyles } from './dash/library';
import { setRest } from './dash/runtime';
import { removeDashboardStyles } from './dash/styles';
import { isDashboardProgram } from './dash/validate';

export const PLUGIN_ID = 'hermes-openui';

export function OpenuiBlock(props: BlockProps) {
  return <LibraryOpenuiBlock {...props} />;
}

/** The line people see for a click: the button's own message when it has one. */
export function clickSummary(serialized: string): string {
  try {
    const action = JSON.parse(serialized.slice(serialized.indexOf('\n') + 1)).action;
    const message = action?.context?.message;
    return typeof message === 'string' && message.trim() ? message : actionSummary(String(action?.name ?? ''));
  } catch {
    return 'Sent';
  }
}

/** The tool result names the backend a dashboard belongs to; a reopened chat may hand it back already parsed. */
function backendIdOf(result: unknown): string {
  try {
    const value = typeof result === 'string' ? JSON.parse(result) : result;
    return typeof value?.backend_id === 'string' ? value.backend_id : '';
  } catch {
    return '';
  }
}

export function OpenuiCard(props: ToolMediaRendererProps): ReactNode {
  const fromArgs = typeof props.args?.program === 'string' ? props.args.program : null;
  const { payload: program, loading, images, imagesLoading } = useSurfaceSource(PLUGIN_ID, props.file, fromArgs);
  const renderMedia = useMediaRenderer(images, imagesLoading);
  const busy = useSessionBusy(props.sessionId);
  const answered = useAnswered(props.file.name);
  const origin = useMemo(() => ({ messageId: props.file.name.replace(/\.md$/u, ''), blockIndex: 0 }), [props.file.name]);
  const submit = async (serialized: string): Promise<{ status: 'accepted' | 'blocked'; reason?: string }> => {
    if (!host.composer.submit(props.sessionId ?? null, answerMessage(clickSummary(serialized), serialized))) {
      return { status: 'blocked', reason: 'Open this chat to send that.' };
    }
    markAnswered(props.file.name);
    return { status: 'accepted' };
  };

  if (loading) return <p role="status">Loading the interactive view.</p>;
  if (program === null) return props.fallback;
  if (isDashboardProgram(program)) {
    return <DashboardBlock code={program} backendId={backendIdOf(props.result)} fenceClosed streaming={false} readOnly={false} busy={busy} answered={answered} origin={origin} submitInteraction={submit} />;
  }
  return <OpenuiBlock
    code={program}
    fenceClosed
    streaming={false}
    readOnly={false}
    busy={busy}
    answered={answered}
    origin={origin}
    renderMedia={renderMedia}
    submitInteraction={submit}
  />;
}

function Gallery() {
  const names = Object.keys(libraryExamples);
  const [page, setPage] = useState(names[0]!);
  useLayoutEffect(() => acquireStyles(libraryCss), []);
  return <section style={{ padding: 24, overflow: 'auto', height: '100%' }} aria-label="OpenUI catalog">
    <h2 style={{ fontSize: 22, fontWeight: 650, marginBottom: 16 }}>OpenUI · {Object.keys(library.components).length} components</h2>
    <nav role="tablist" aria-label="Catalog sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      {names.map((name) => <button key={name} type="button" role="tab" aria-selected={page === name} onClick={() => setPage(name)}>{name}</button>)}
    </nav>
    <section {...{ [SURFACE_ATTR]: '1' }} className="hermes-openui-surface">
      <SurfaceContext.Provider value={{ blocked: true, reason: 'Preview only: ask in a chat to use buttons.' }}>
        <DesktopTheme><Renderer key={page} response={libraryExamples[page]!} library={library} isStreaming={false} toolProvider={null} /></DesktopTheme>
      </SurfaceContext.Provider>
    </section>
  </section>;
}

const plugin: HermesPlugin = {
  id: PLUGIN_ID,
  name: 'OpenUI',
  register(ctx) {
    bindAnswerStorage(ctx.storage);
    setOpenExternal((url) => ctx.os.openExternal(url));
    setRest((path, options) => ctx.rest(path, options));
    ctx.register({
      id: 'renderer',
      area: TOOL_MEDIA_RENDERER_AREA,
      data: { tools: ['openui_present'], render: (props: ToolMediaRendererProps) => <OpenuiCard {...props} /> },
    });
    let close: (() => void) | undefined;
    const open = () => { close = host.openWorkspace('hermes-openui-catalog', { title: 'OpenUI catalog', minWidth: '22rem', render: () => <Gallery /> }); };
    ctx.register({ id: 'catalog-command', area: PALETTE_AREA, data: { id: 'hermes-openui.catalog', label: 'OpenUI: browse component catalog', keywords: ['openui', 'components'], run: open } });
    ctx.onDispose(() => { close?.(); removeStyles(); setOpenExternal(undefined); setRest(null); removeDashboardStyles(); resetComponentStyles(); });
  },
};
export default plugin;
