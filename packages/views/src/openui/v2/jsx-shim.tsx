// Substituted for `react/jsx-runtime` inside @openuidev/react-ui's compiled bundle only (see
// scripts/react-ui-patches.mjs). Our own code keeps using the real runtime.
import * as base from 'react/jsx-runtime';
import { applyElementPolicy } from './element-policy';

export const Fragment = base.Fragment;
export const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown) => {
  const [t, p] = applyElementPolicy(type, props);
  return (base.jsx as (t: unknown, p: unknown, k?: unknown) => unknown)(t, p, key);
};
export const jsxs = (type: unknown, props: Record<string, unknown>, key?: unknown) => {
  const [t, p] = applyElementPolicy(type, props);
  return (base.jsxs as (t: unknown, p: unknown, k?: unknown) => unknown)(t, p, key);
};
