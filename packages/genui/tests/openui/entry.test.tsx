import { describe, expect, it } from 'vitest';
import plugin from '../../src/plugin';

describe('the combined Desktop entry', () => {
  it('registers each renderer for its own tool, plus the OpenUI catalog command', () => {
    const registered: { id: string; area: string; data: { tools?: string[]; id?: string } }[] = [];
    const disposers: (() => void)[] = [];
    plugin.register({
      storage: { get: (_key: string, fallback: unknown) => fallback, set() {}, remove() {} },
      os: { openExternal() {} },
      rest: async () => ({}),
      onDispose: (callback: () => void) => { disposers.push(callback); },
      register: (contribution: (typeof registered)[number]) => { registered.push(contribution); return () => undefined; },
    } as never);
    expect(plugin.id).toBe('hermes-genui');
    const renderers = registered.filter((item) => item.area === 'transcript.toolMedia').map((item) => [item.id, item.data.tools]);
    expect(renderers).toEqual([['a2ui-renderer', ['a2ui_present']], ['openui-renderer', ['openui_present']]]);
    expect(registered.some((item) => item.area === 'palette' && item.data.id === 'hermes-genui.openui-catalog')).toBe(true);
    expect(new Set(registered.map((item) => item.id)).size).toBe(registered.length);
    disposers.forEach((dispose) => dispose());
  });
});
