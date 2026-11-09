import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { host, type ToolMediaRendererProps } from '@hermes/plugin-sdk';
import plugin, { A2uiCard, PLUGIN_ID } from '../src/plugin';
import { actionSummary, answerMessage, payloadFromSavedFile } from '../src/shared/surface-card';

const CATALOG = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';
const payload = [
  { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: CATALOG } },
  { version: 'v0.9', updateComponents: { surfaceId: 's1', components: [
    { id: 'root', component: 'Column', children: ['go'] },
    { id: 'go', component: 'Button', child: 'label', action: { event: { name: 'approve.deal' } } },
    { id: 'label', component: 'Text', text: 'Approve' },
  ] } },
].map((line) => JSON.stringify(line)).join('\n');

const store = new Map<string, unknown>();
const storage = { get: (key: string, fallback: unknown) => store.has(key) ? store.get(key) : fallback, set: (key: string, value: unknown) => void store.set(key, value), remove: (key: string) => void store.delete(key) };
const props = (over = {}) => ({
  file: { name: 'a.md', kind: 'file', mime: 'text/markdown', path: '/x/a.md', resolveUrl: async () => '' },
  args: { payload }, result: {}, sessionId: 's', toolName: 'a2ui_present', toolCallId: 'c', fallback: <p>file card</p>, ...over,
});

afterEach(cleanup);

beforeEach(() => {
  store.clear();
  vi.mocked(host.composer.submit).mockReset().mockReturnValue(true);
  let registered: unknown;
  plugin.register({ storage, register: (item: unknown) => { registered = item; return () => undefined; } } as never);
  expect(registered).toBeTruthy();
});

describe('A2uiCard', () => {
  it('sends a readable line with the interaction attached, then locks', async () => {
    render(<A2uiCard {...(props() as unknown as ToolMediaRendererProps)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(host.composer.submit).toHaveBeenCalledTimes(1));
    const [session, text] = vi.mocked(host.composer.submit).mock.calls[0]!;
    expect(session).toBe('s');
    expect(text.split('\n')[0]).toBe('Approve deal');
    expect(text).toContain('--- Attached Context ---');
    expect(text).toContain('[A2UI_INTERACTION]');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true));
    expect(store.get('answered.a.md')).toBe(true);
  });

  it('locks every mounted copy of the same surface', async () => {
    render(<><A2uiCard {...(props() as unknown as ToolMediaRendererProps)} /><A2uiCard {...(props() as unknown as ToolMediaRendererProps)} /></>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]!);
    await waitFor(() => {
      for (const button of screen.getAllByRole('button', { name: 'Approve' })) expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('stays unlocked and says so when no composer takes the message', async () => {
    vi.mocked(host.composer.submit).mockReturnValue(false);
    render(<A2uiCard {...(props() as unknown as ToolMediaRendererProps)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Open this chat');
    expect(store.has('answered.a.md')).toBe(false);
  });

  it('redraws from the saved file when the arguments are gone', async () => {
    const saved = `# copy\n\n<!-- ${PLUGIN_ID}:payload ${btoa(payload)} -->\n`;
    const resolveUrl = async () => `data:text/markdown;base64,${btoa(saved)}`;
    render(<A2uiCard {...(props({ args: {}, file: { name: 'a.md', kind: 'file', mime: '', path: '', resolveUrl } }) as unknown as ToolMediaRendererProps)} />);
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeTruthy();
  });

  it('shows the built-in file card when nothing can be recovered', async () => {
    render(<A2uiCard {...(props({ args: {} }) as unknown as ToolMediaRendererProps)} />);
    expect(await screen.findByText('file card')).toBeTruthy();
  });
});

describe('shared helpers', () => {
  it('reads a payload with non-ASCII text from a data URL', () => {
    const encode = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    const inner = encode('prix: 5 €');
    const url = `data:text/markdown;base64,${encode(`x <!-- p:payload ${inner} --> y`)}`;
    expect(payloadFromSavedFile('p', url)).toBe('prix: 5 €');
    expect(payloadFromSavedFile('other', url)).toBeNull();
  });
  it('keeps @ references from expanding', () => {
    expect(answerMessage('Sent', '{"a":"@file:x"}')).toContain('\\u0040file:x');
  });
  it('names actions', () => {
    expect(actionSummary('approve.deal_now')).toBe('Approve deal now');
  });
});
