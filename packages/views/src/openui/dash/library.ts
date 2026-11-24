import { createElement, type ComponentType } from 'react';
import { library as stockDashboardLibrary } from '@openuidev/dashboard-library';
import { actionSends, actionSupport, collectActions, type Support } from '../v2/actions';
import { useSurface } from '../v2/surface';

type Def = (typeof stockDashboardLibrary.components)[string];
type RenderProps = { props: Record<string, unknown>; renderNode: (value: unknown) => unknown };

/**
 * This bundle's own reset for the component rules (see scripts/dashboard-patches.mjs). Taken right after the
 * library's modules ran, so a later plugin build publishing its own cannot be picked up by mistake.
 */
const RESET = Symbol.for('hermes-openui/dashboard-styles-reset');
const slot = globalThis as unknown as Record<symbol, (() => void) | undefined>;
export const resetComponentStyles: () => void = slot[RESET] ?? (() => {});
delete slot[RESET];

/** Components that carry an `action` in this library (from its JSON schema: Button, IconButton, Col). */
const ACTIONABLE = new Set(['Button', 'IconButton', 'Col']);
const SENDS_BY_DEFAULT = new Set(['Button', 'IconButton']);

type Step = { type?: string };
/**
 * Dashboards add one step to the ordinary policy: `run`, which refreshes a Query. The validator has already
 * proved every @Run names a declared Query and that no Mutation exists, so a run step can only re-read data.
 */
export function dashboardActionSupport(action: unknown, canOpen: boolean): Support {
  const steps: Step[] | undefined = action && typeof action === 'object' && Array.isArray((action as { steps?: unknown }).steps) ? (action as { steps: Step[] }).steps : undefined;
  if (steps?.some((s) => s?.type === 'run')) {
    const rest = { ...(action as object), steps: steps.filter((s) => s?.type !== 'run') };
    return rest.steps.length ? actionSupport(rest, canOpen) : { ok: true };
  }
  return actionSupport(action, canOpen);
}

function guard(name: string, Original: ComponentType<RenderProps>): ComponentType<RenderProps> {
  function Guarded(p: RenderProps) {
    const surface = useSurface();
    const actions = collectActions(p.props);
    const unsupported = actions.map((a) => dashboardActionSupport(a, !!surface.openExternal)).find((s) => !s.ok);
    const sends = actions.length ? actions.some(actionSends) : SENDS_BY_DEFAULT.has(name);
    const blocked = surface.blocked && sends;
    if (!unsupported && !blocked) return createElement(Original, p);
    const reason = unsupported && !unsupported.ok ? unsupported.reason : surface.reason;
    return createElement('span', { className: 'hermes-openui-guarded', 'data-openui-guard': unsupported ? 'unsupported' : 'blocked', 'aria-disabled': true, title: reason, inert: true }, createElement(Original, p));
  }
  Guarded.displayName = `DashboardGuarded(${name})`;
  return Guarded;
}

/** The published dashboard library with action-carrying renderers wrapped; schemas and prompt are its own. */
export const dashboardLibrary: typeof stockDashboardLibrary = {
  ...stockDashboardLibrary,
  components: Object.fromEntries(Object.entries(stockDashboardLibrary.components).map(([name, def]) => [
    name,
    ACTIONABLE.has(name) ? ({ ...(def as Def), component: guard(name, (def as Def).component as unknown as ComponentType<RenderProps>) } as unknown as Def) : def,
  ])),
};
export const dashboardComponentNames = Object.keys(stockDashboardLibrary.components);
export { stockDashboardLibrary };
