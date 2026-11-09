import type { ReactNode } from 'react';

// Replaces react-syntax-highlighter: its language grammars are 1.2 MB and trip Hermes' admission lint.
// Colours are explicit because Desktop's chat styles give every <pre> a dark ground in some themes.
export function Prism({ children }: { children?: ReactNode }) {
  return (
    <pre style={{ margin: 0, padding: 12, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', background: 'var(--muted, transparent)', color: 'var(--foreground, inherit)' }}>
      <code style={{ background: 'transparent', color: 'inherit' }}>{children}</code>
    </pre>
  );
}
export const oneLight = {};
export const vscDarkPlus = {};
