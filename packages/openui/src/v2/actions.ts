// Action classification and the guarded [A2UI_INTERACTION] payload for the real openuiLibrary.
import type { Fields } from '../context';

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor', 'call', 'functionCall']);
export const MAX_STRING = 2000;
const URL_STEP = /^(?:https?:\/\/|mailto:)/i;

export type Support = { ok: true } | { ok: false; reason: string };
type Step = { type?: string; url?: string; [key: string]: unknown };
type PlanLike = { steps?: Step[]; type?: string; params?: Record<string, unknown>; url?: string };

const isPlan = (value: unknown): value is PlanLike => !!value && typeof value === 'object';

/** `canOpen`: the audited external-link bridge exists. Every other step type either stays local or sends one chat request. */
export function actionSupport(action: unknown, canOpen: boolean): Support {
  if (action === undefined || action === null) return { ok: true };
  if (!isPlan(action)) return { ok: false, reason: 'This action is not supported in Desktop.' };
  const steps: Step[] = Array.isArray(action.steps) ? action.steps : [{ type: action.type ?? 'continue_conversation', url: (action.params?.url as string | undefined) ?? action.url }];
  for (const step of steps) {
    switch (step?.type) {
      case 'continue_conversation': case 'set': case 'reset': break;
      case 'open_url': {
        if (typeof step.url !== 'string' || !URL_STEP.test(step.url.trim())) return { ok: false, reason: 'Only web links can be opened from generated UI.' };
        if (!canOpen) return { ok: false, reason: 'This Desktop build cannot open links from generated UI.' };
        break;
      }
      case 'run': return { ok: false, reason: 'Live data actions are not available in Desktop.' };
      default: return { ok: false, reason: 'This action is not supported in Desktop.' };
    }
  }
  return { ok: true };
}

/** Does clicking this action send a chat request (as opposed to staying local or opening a link)? */
export function actionSends(action: unknown): boolean {
  if (action === undefined || action === null) return false;
  if (!isPlan(action)) return false;
  if (Array.isArray(action.steps)) return action.steps.some((s) => s?.type === 'continue_conversation');
  return (action.type ?? 'continue_conversation') === 'continue_conversation';
}

/** Every `action` carried by a component's evaluated props, including nested element nodes (ListItem, card items). */
export function collectActions(props: unknown, depth = 0, out: unknown[] = []): unknown[] {
  if (!props || typeof props !== 'object' || depth > 6) return out;
  if (Array.isArray(props)) { for (const item of props) collectActions(item, depth + 1, out); return out; }
  const record = props as Record<string, unknown>;
  if ('action' in record && record.action) out.push(record.action);
  if (record.type === 'element' && record.props) collectActions(record.props, depth + 1, out);
  else for (const [key, value] of Object.entries(record)) if (key !== 'action' && value && typeof value === 'object') collectActions(value, depth + 1, out);
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
function dateString(value: Date): string | null {
  if (!Number.isFinite(value.getTime())) return null;
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** Bounds every value to the envelope's limits (depth 3, <=16 keys, <=32 items, strings <= 2048). */
export function toWire(value: unknown, depth: number): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return dateString(value);
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value === 'bigint') return String(value);
  const tooDeep = depth >= 3;
  if (tooDeep) { try { return JSON.stringify(value, (_k, v) => v instanceof Date ? dateString(v) : v)?.slice(0, MAX_STRING) ?? null; } catch { return null; } }
  if (Array.isArray(value)) return value.slice(0, 32).map((item) => toWire(item, depth + 1) ?? null);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 16)) {
      if (FORBIDDEN.has(key) || key.length > 80) continue;
      const wire = toWire(item, depth + 1);
      if (wire !== undefined) out[key] = wire;
    }
    return out;
  }
  return undefined;
}

export type Defaults = Record<string, Record<string, unknown>>;
export interface LibraryActionEventLike { type: string; params?: Record<string, unknown>; humanFriendlyMessage?: string; formState?: Record<string, unknown>; formName?: string }

const unwrap = (entry: unknown) => (entry && typeof entry === 'object' && 'value' in (entry as object) && 'componentType' in (entry as object)) ? (entry as { value: unknown }).value : entry;

/** Merges declared defaults (from the program) under the user's edits (from the renderer store). */
export function collectValues(event: LibraryActionEventLike, defaults: Defaults): { form?: string; values: Fields } {
  const state = (event.formState ?? {}) as Record<string, unknown>;
  const merged: Record<string, Record<string, unknown>> = {};
  const formsInState = new Set<string>();
  const addForm = (name: string, fields: unknown) => {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return;
    const target = (merged[name] ??= { ...(defaults[name] ?? {}) });
    for (const [field, entry] of Object.entries(fields as Record<string, unknown>)) target[field] = unwrap(entry);
    formsInState.add(name);
  };
  const loose: Record<string, unknown> = {};
  if (event.formName) {
    merged[event.formName] = { ...(defaults[event.formName] ?? {}) };
    addForm(event.formName, state[event.formName]);
  } else {
    for (const name of Object.keys(defaults)) merged[name] = { ...defaults[name] };
    for (const [key, value] of Object.entries(state)) {
      if (key.startsWith('$')) loose[key] = value;
      else if (value && typeof value === 'object' && !Array.isArray(value) && !('value' in value && 'componentType' in value)) addForm(key, value);
    }
  }
  const names = Object.keys(merged);
  const values: Record<string, unknown> = {};
  const put = (key: string, raw: unknown) => { if (FORBIDDEN.has(key) || Object.keys(values).length >= 16) return; const wire = toWire(raw, 2); if (wire !== undefined) values[key.slice(0, 80)] = wire; };
  if (event.formName || names.length === 1) {
    const form = event.formName ?? names[0];
    for (const [field, value] of Object.entries(merged[form] ?? {})) put(field, value);
    for (const [key, value] of Object.entries(loose)) put(key, value);
    return { form, values: values as Fields };
  }
  for (const name of names) for (const [field, value] of Object.entries(merged[name])) put(`${name}.${field}`, value);
  for (const [key, value] of Object.entries(loose)) put(key, value);
  return { values: values as Fields };
}

export function interactionContext(event: LibraryActionEventLike, defaults: Defaults): { message: string; form?: string; values?: Fields; data?: unknown } | null {
  const message = String(event.humanFriendlyMessage ?? '').trim().slice(0, MAX_STRING);
  if (!message) return null;
  const { form, values } = collectValues(event, defaults);
  const hasValues = Object.keys(values).length > 0;
  const data = event.params && 'context' in event.params ? toWire(event.params.context, 1) : undefined;
  return { message, ...(form ? { form } : {}), ...(hasValues || form ? { values } : {}), ...(data !== undefined && data !== null ? { data } : {}) };
}
