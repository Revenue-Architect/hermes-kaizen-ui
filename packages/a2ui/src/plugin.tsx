import { useMemo, useRef, useState, type ReactNode } from 'react';
import { host, TOOL_MEDIA_RENDERER_AREA, type HermesPlugin, type ToolMediaRendererProps } from '@hermes/plugin-sdk';
import { A2uiSurfaceView } from './components/index';
import { serializeInteraction } from './interactions/serialize';
import { actionSummary, answerMessage, bindAnswerStorage, markAnswered, useAnswered, useMediaRenderer, useSessionBusy, useSurfaceSource } from './shared/surface-card';
import { validateAndNormalize } from './validation/index';

export const PLUGIN_ID = 'hermes-a2ui';

export function A2uiCard(props: ToolMediaRendererProps): ReactNode {
  const fromArgs = typeof props.args?.payload === 'string' ? props.args.payload : null;
  const { payload, loading, images, imagesLoading } = useSurfaceSource(PLUGIN_ID, props.file, fromArgs);
  const renderMedia = useMediaRenderer(images, imagesLoading);
  const result = useMemo(() => (payload === null ? null : validateAndNormalize(payload)), [payload]);
  const busy = useSessionBusy(props.sessionId);
  const answered = useAnswered(props.file.name);
  const [error, setError] = useState('');
  const lock = useRef(false);

  if (loading) return <p role="status">Loading the interactive view.</p>;
  if (!result) return props.fallback;
  if (!result.ok) {
    return <section aria-label="A2UI source">
      <p role="status">Interactive view unavailable: {result.error}</p>
      {props.fallback}
    </section>;
  }

  return <section aria-label="Interactive view" style={{ minWidth: 0 }}>
    {result.surfaces.map((surface) => <A2uiSurfaceView
      key={`${props.toolCallId}:${surface.surfaceId}`}
      surface={surface}
      renderMedia={renderMedia}
      disabled={busy || answered}
      onInteraction={async (action) => {
        if (lock.current || busy || answered) return;
        lock.current = true;
        setError('');
        try {
          const message = answerMessage(actionSummary(action.name), serializeInteraction(action, undefined, result.version));
          if (!host.composer.submit(props.sessionId ?? null, message)) {
            throw new Error('Open this chat to send that.');
          }
          markAnswered(props.file.name);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Could not send that.');
          throw cause;
        } finally {
          lock.current = false;
        }
      }}
    />)}
    {error && <p role="alert">{error}</p>}
  </section>;
}

const plugin: HermesPlugin = {
  id: PLUGIN_ID,
  name: 'A2UI',
  register(ctx) {
    bindAnswerStorage(ctx.storage);
    ctx.register({
      id: 'renderer',
      area: TOOL_MEDIA_RENDERER_AREA,
      data: { tools: ['a2ui_present'], render: (props: ToolMediaRendererProps) => <A2uiCard {...props} /> },
    });
  },
};
export default plugin;
