import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { host, type ToolMediaRendererProps } from '@hermes/plugin-sdk';
import { A2uiSurfaceView } from '../src/components';
import plugin, { A2uiCard, PLUGIN_ID } from '../src/plugin';
import type { A2uiSurface } from '../src/types';
import { validateAndNormalize } from '../src/validation/index';

const fixture = (...parts: string[]) => readFileSync(join(process.cwd(), 'fixtures', ...parts), 'utf8').trim();
const store = new Map<string, unknown>();
const storage = { get: (key: string, fallback: unknown) => store.has(key) ? store.get(key) : fallback, set: (key: string, value: unknown) => void store.set(key, value), remove: (key: string) => void store.delete(key) };
const props = (over = {}) => ({
  file: { name: 'a.md', kind: 'file', mime: 'text/markdown', path: '/x/a.md', resolveUrl: async () => '' },
  args: {}, result: {}, sessionId: 's', toolName: 'a2ui_present', toolCallId: 'c', fallback: <p>file card</p>, ...over,
}) as unknown as ToolMediaRendererProps;
const savedFile = (text: string) => `# copy\n\n<!-- ${PLUGIN_ID}:payload ${btoa(String.fromCharCode(...new TextEncoder().encode(text)))} -->\n`;
const fromSaved = (text: string) => props({ file: { name: 'saved.md', kind: 'file', mime: '', path: '', resolveUrl: async () => `data:text/markdown;base64,${btoa(savedFile(text))}` } });

afterEach(cleanup);
beforeEach(() => {
  store.clear();
  vi.mocked(host.composer.submit).mockReset().mockReturnValue(true);
  plugin.register({ storage, register: () => () => undefined } as never);
});

function drawn(text: string): A2uiSurface {
  const result = validateAndNormalize(text);
  if (!result.ok) throw new Error(result.error);
  return result.surfaces[0]!;
}

describe('1.0 input details', () => {
  it('shows a text field placeholder, in a single line and in a long field', () => {
    const surface = drawn(JSON.stringify({ version: '1.0', createSurface: { surfaceId: 'p', components: [
      { id: 'root', component: 'Column', children: ['one', 'many'] },
      { id: 'one', component: 'TextField', label: 'Name', value: '', placeholder: 'Your name' },
      { id: 'many', component: 'TextField', label: 'Notes', value: '', variant: 'longText', placeholder: 'Anything else' },
    ] } }));
    render(<A2uiSurfaceView surface={surface} />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).placeholder).toBe('Your name');
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).placeholder).toBe('Anything else');
  });

  it('snaps a slider to its steps and leaves one without steps alone', () => {
    const surface = drawn(JSON.stringify({ version: '1.0', createSurface: { surfaceId: 'p', components: [
      { id: 'root', component: 'Column', children: ['a', 'b'] },
      { id: 'a', component: 'Slider', label: 'Stepped', min: 0, max: 10, value: 2, steps: 5 },
      { id: 'b', component: 'Slider', label: 'Free', min: 0, max: 10, value: 2 },
    ] } }));
    render(<A2uiSurfaceView surface={surface} />);
    expect((screen.getByLabelText('Stepped') as HTMLInputElement).step).toBe('2');
    expect((screen.getByLabelText('Free') as HTMLInputElement).hasAttribute('step')).toBe(false);
  });

  it('draws 1.0 tabs and switches between them', () => {
    const surface = drawn(JSON.stringify({ version: '1.0', createSurface: { surfaceId: 'p', components: [
      { id: 'root', component: 'Tabs', tabs: [{ title: 'First', child: 'one' }, { title: 'Second', child: 'two' }] },
      { id: 'one', component: 'Text', text: 'First body' },
      { id: 'two', component: 'Text', text: 'Second body' },
    ] } }));
    render(<A2uiSurfaceView surface={surface} />);
    expect(screen.getByText('First body')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Second' }));
    expect(screen.getByText('Second body')).toBeTruthy();
  });
});

describe('a 1.0 view in the chat card', () => {
  it('sends what was typed, resolved through @path bindings, then locks', async () => {
    render(<A2uiCard {...props({ args: { payload: fixture('bound', 'meal-form.v1_0.jsonl') } })} />);
    const meal = screen.getByLabelText('Meal') as HTMLInputElement;
    expect(meal.value).toBe('Tomato soup');
    fireEvent.change(meal, { target: { value: 'Pasta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan it' }));
    await waitFor(() => expect(host.composer.submit).toHaveBeenCalledTimes(1));
    const [, text] = vi.mocked(host.composer.submit).mock.calls[0]!;
    expect(text.split('\n')[0]).toBe('Meal plan');
    expect(text).toContain('[A2UI_INTERACTION]');
    expect(text).toContain('Pasta');
    expect(text).toContain('"servings"');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Plan it' }) as HTMLButtonElement).disabled).toBe(true));
  });

  it('redraws a 1.0 view from the saved file when the arguments are gone', async () => {
    render(<A2uiCard {...fromSaved(fixture('v1_0', 'action-needed.jsonl'))} />);
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeTruthy();
  });
});

describe('a view saved as v0.9 before the upgrade', () => {
  it.each(['action-needed.jsonl', 'meal-plan-form.jsonl', 'travel-itinerary.jsonl', 'status-overview.jsonl'])('still opens: %s', async (name) => {
    render(<A2uiCard {...fromSaved(fixture('mobile', name))} />);
    expect(await screen.findByLabelText('Interactive view')).toBeTruthy();
    expect(screen.queryByText(/Interactive view unavailable/)).toBeNull();
  });

  it('still answers a click with its v0.9 context', async () => {
    render(<A2uiCard {...fromSaved(fixture('bound', 'meal-form.v0_9.jsonl'))} />);
    const meal = await screen.findByLabelText('Meal');
    fireEvent.change(meal, { target: { value: 'Salad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan it' }));
    await waitFor(() => expect(host.composer.submit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(host.composer.submit).mock.calls[0]![1]).toContain('Salad');
  });

  it('draws a v0.9 view straight from the tool arguments too', () => {
    render(<A2uiCard {...props({ args: { payload: fixture('mobile', 'action-needed.jsonl') } })} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
  });
});

describe('the repeated list the skill documents', () => {
  // fixtures/skill/repeated-list.v1_0.jsonl is the skill's Express example compiled (tests/test_v1_0.py keeps the two the same).
  it('draws every item, in order, from explicit children', () => {
    const surface = drawn(fixture('skill', 'repeated-list.v1_0.jsonl'));
    expect(Array.isArray(surface.components.items!.children)).toBe(true);
    const { container } = render(<A2uiSurfaceView surface={surface} />);
    const shown = ['Draft the brief', 'Review with Sam', 'Send the invoice'].map((text) => screen.getByText(text));
    expect(shown).toHaveLength(3);
    expect(shown.every((node, index) => index === 0 || shown[index - 1]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(container.textContent).toBe('Draft the briefReview with SamSend the invoice');
  });
});
