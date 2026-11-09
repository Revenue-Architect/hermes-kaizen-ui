import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { libraryCss } from '../src/generated/library-css';

const root = postcss.parse(libraryCss);
const layers = root.nodes.filter((n: any) => n.type === 'atrule' && n.name === 'layer') as postcss.AtRule[];
const rules: postcss.Rule[] = []; const keyframes: string[] = [];
const collect = (node: postcss.Container, inKeyframes = false) => node.each((n) => {
  if (n.type === 'atrule') { if (n.name === 'keyframes') { keyframes.push(n.params); return; } collect(n as postcss.AtRule); }
  else if (n.type === 'rule' && !inKeyframes) rules.push(n);
});
for (const l of layers) collect(l);
const SCOPE = /^(?::is\(\[data-openui-library\], \.hermes-openui-portal\)|\[data-openui-library\]|\.hermes-openui-portal|:where\(:root\[data-hermes-mode="dark"\]\) :is\(\[data-openui-library\], \.hermes-openui-portal\)|\.openui-[\w-]+\.hermes-openui-portal)/;

describe('CSS containment', () => {
  it('everything lives in one named cascade layer, nothing unlayered', () => {
    expect(root.nodes.filter((n: any) => n.type !== 'comment').every((n: any) => n.type === 'atrule' && n.name === 'layer' && n.params === 'hermes-openui')).toBe(true);
  });
  it('every selector is scoped to the OpenUI surface or the library portal', () => {
    const bad = rules.flatMap((r) => r.selectors).filter((s) => !SCOPE.test(s.trim()));
    expect(bad.slice(0, 5)).toEqual([]);
    expect(rules.length).toBeGreaterThan(1000);
  });
  it('contains no global resets, element selectors, :root rules or @font-face/@import', () => {
    const sels = rules.flatMap((r) => r.selectors).join('\n');
    expect(sels.split('\n').every((s) => /openui|hermes/.test(s))).toBe(true);
    expect(/@(font-face|import|property|namespace)/.test(libraryCss)).toBe(false);
    for (const r of rules) for (const s of r.selectors) expect(s.trim().startsWith(':root')).toBe(false);
  });
  it('dark mode follows Desktop, not the OS', () => { expect(libraryCss).not.toMatch(/prefers-color-scheme/); expect(libraryCss).toContain(':where(:root[data-hermes-mode="dark"])'); });
  it('keyframes are renamed away from anything Desktop could define', () => {
    expect(keyframes.length).toBeGreaterThan(20); expect(keyframes.every((k) => k.startsWith('houi-'))).toBe(true);
    const anim = [...libraryCss.matchAll(/animation(?:-name)?:\s*([^;}]+)/g)].map((m) => m[1]);
    for (const a of anim) for (const word of a.split(/[\s,]+/)) if (/^(fadeIn|slideDown|slideUp|slideInFromRight)$/.test(word)) throw Error('unprefixed animation ' + word);
  });
  it('is generated from react-ui, themed to Kaizen (red accent, Hanken) and has no stock Inter or blue accent left in tokens', () => {
    expect(libraryCss).toContain('--openui-interactive-accent-default: var(--hoi-brand)');
    expect(libraryCss).not.toMatch(/"Inter", sans-serif/);
    expect(libraryCss).toContain('"Kaizen Hanken"');
  });
});
