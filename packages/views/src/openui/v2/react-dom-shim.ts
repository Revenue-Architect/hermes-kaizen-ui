// The Desktop plugin loader only lets a plugin import `@hermes/plugin-sdk` and `react*` (react-dom is not
// available to plugins). The library and Radix need just createPortal and flushSync, so provide them here.
// A portal is a plain element object the host's own react-dom reconciler renders.
const REACT_PORTAL_TYPE = Symbol.for('react.portal');

export function createPortal(children: unknown, container: Element | DocumentFragment, key?: string | null) {
  if (!container || (container.nodeType !== 1 && container.nodeType !== 11 && container.nodeType !== 9)) throw new Error('Target container is not a DOM element.');
  return { $$typeof: REACT_PORTAL_TYPE, key: key == null ? null : '' + key, children, containerInfo: container, implementation: null };
}
/** Radix only needs the callback to run; the host batches the resulting updates. */
export function flushSync<R>(fn?: () => R): R | undefined { return fn ? fn() : undefined; }
export function unstable_batchedUpdates<A, R>(fn: (a: A) => R, a: A): R { return fn(a); }
export const version = '19';
export default { createPortal, flushSync, unstable_batchedUpdates, version };
