import { createElement, type ComponentType } from 'react';
import { openuiLibrary } from '@openuidev/react-ui/genui-lib';
import { actionSends, actionSupport, collectActions } from './actions';
import { useSurface } from './surface';

type Def = (typeof openuiLibrary.components)[string];
type RenderProps = { props: Record<string, unknown>; renderNode: (value: unknown) => unknown };

/** Components whose clicks run an action. They get a visible disabled state (not a silent dead button). */
const ACTIONABLE = new Set(['Button', 'IconButton', 'ListBlock', 'SnippetCardBlock', 'OverviewCardBlock', 'ContextCardBlock', 'CompositeCardBlock', 'VisualCardBlock']);
/** Buttons without an explicit action send their label. */
const SENDS_BY_DEFAULT = new Set(['Button', 'IconButton']);

function guard(name: string, Original: ComponentType<RenderProps>): ComponentType<RenderProps> {
  function Guarded(p: RenderProps) {
    const surface = useSurface();
    const actions = collectActions(p.props);
    const unsupported = actions.map((a) => actionSupport(a, !!surface.openExternal)).find((s) => !s.ok);
    const sends = actions.length ? actions.some(actionSends) : SENDS_BY_DEFAULT.has(name);
    const blocked = surface.blocked && sends;
    if (!unsupported && !blocked) return createElement(Original, p);
    const reason = unsupported && !unsupported.ok ? unsupported.reason : surface.reason;
    return createElement('span', { className: 'hermes-openui-guarded', 'data-openui-guard': unsupported ? 'unsupported' : 'blocked', 'aria-disabled': true, title: reason, inert: true }, createElement(Original, p));
  }
  Guarded.displayName = `Guarded(${name})`;
  return Guarded;
}

/**
 * The stock library with its renderers wrapped. Schemas, groups, prompt and parser behaviour are the
 * published openuiLibrary's own (same `__libraryId`); only `component` differs for action-carrying components.
 */
export const library: typeof openuiLibrary = {
  ...openuiLibrary,
  components: Object.fromEntries(Object.entries(openuiLibrary.components).map(([name, def]) => [
    name,
    ACTIONABLE.has(name) ? ({ ...(def as Def), component: guard(name, (def as Def).component as unknown as ComponentType<RenderProps>) } as unknown as Def) : def,
  ])),
};
export const componentNames = Object.keys(openuiLibrary.components);
export { openuiLibrary };
