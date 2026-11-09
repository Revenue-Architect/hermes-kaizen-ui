import { createParser, type ElementNode } from '@openuidev/react-lang';
import { library, componentNames } from './library';
import type { Defaults } from './actions';

export const MAX_PROGRAM_BYTES = 2_950_000; // room for one 2 MB data:image
const MAX_ELEMENTS = 1000;
const MAX_DEPTH = 48;
const MAX_IMAGES = 100;
const names = new Set(componentNames);
let parser: ReturnType<typeof createParser> | undefined;

export type Validation = { ok: true; defaults: Defaults; elements: number } | { ok: false; error: string };

const isElement = (v: unknown): v is ElementNode => !!v && typeof v === 'object' && (v as { type?: unknown }).type === 'element';

/** Declared defaults the renderer does not keep in form state until a control changes. */
function declaredDefault(node: ElementNode): unknown {
  const p = node.props as Record<string, any>;
  switch (node.typeName) {
    case 'Slider': return Array.isArray(p.defaultValue) ? p.defaultValue : undefined;
    case 'RadioGroup': return typeof p.defaultValue === 'string' ? p.defaultValue : undefined;
    case 'Chips': case 'OptionCards': return p.defaultValue ?? undefined;
    case 'CheckBoxGroup': case 'SwitchGroup': {
      const out: Record<string, boolean> = {};
      for (const item of p.items ?? []) if (isElement(item)) { const ip = item.props as Record<string, any>; if (typeof ip.name === 'string') out[ip.name] = ip.defaultChecked === true; }
      return Object.keys(out).length ? out : undefined;
    }
    default: return undefined;
  }
}

export function validateLibraryProgram(code: string): Validation {
  try {
    if (typeof code !== 'string' || !code.trim()) throw Error('Empty program.');
    if (new TextEncoder().encode(code).length > MAX_PROGRAM_BYTES) throw Error('UI exceeds the size limit.');
    parser ??= createParser(library.toJSONSchema(), library.root);
    const result = parser.parse(code);
    if (!result.root) throw Error('The program has no root = Stack(...).');
    if (result.meta.incomplete) throw Error('The program is incomplete.');
    if (result.meta.unresolved.length) throw Error('Unresolved reference: ' + result.meta.unresolved.slice(0, 3).join(', '));
    if (result.queryStatements.length || result.mutationStatements.length) throw Error('Live Query/Mutation calls are not available in Desktop.');
    if (result.meta.errors.length) { const e = result.meta.errors[0] as { message?: string; component?: string }; throw Error(`${e.component ? e.component + ': ' : ''}${e.message ?? 'The program does not match the component library.'}`); }
    const defaults: Defaults = {};
    let count = 0, images = 0;
    const seenForms = new Set<string>();
    const walk = (value: unknown, depth: number, form?: string) => {
      if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1, form); return; }
      if (!value || typeof value !== 'object') return;
      if (!isElement(value)) { for (const item of Object.values(value)) walk(item, depth + 1, form); return; }
      if (++count > MAX_ELEMENTS || depth > MAX_DEPTH) throw Error('UI is too large or deeply nested.');
      if (!names.has(value.typeName)) throw Error('Unknown component: ' + value.typeName);
      const p = value.props as Record<string, any>;
      if (/^Image/.test(value.typeName)) { images += value.typeName === 'ImageGallery' ? (p.images?.length ?? 1) : 1; if (images > MAX_IMAGES) throw Error('Too many images.'); }
      if (value.typeName === 'Form') {
        if (form) throw Error('Forms cannot be nested.');
        if (typeof p.name !== 'string' || !p.name || seenForms.has(p.name) || ['__proto__', 'constructor', 'prototype'].includes(p.name)) throw Error('Forms need unique safe names.');
        seenForms.add(p.name); defaults[p.name] ??= {}; form = p.name;
      }
      if (form && typeof p.name === 'string' && value.typeName !== 'Form') {
        if (['__proto__', 'constructor', 'prototype', 'call', 'functionCall'].includes(p.name)) throw Error('Unsafe field name.');
        const d = declaredDefault(value); if (d !== undefined) defaults[form][p.name] = d;
      }
      for (const item of Object.values(p)) walk(item, depth + 1, form);
    };
    walk(result.root, 0);
    return { ok: true, defaults, elements: count };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid UI.' };
  }
}
