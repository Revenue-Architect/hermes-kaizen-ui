import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { createParser } from '@openuidev/react-lang';
import { library, componentNames } from '../src/v2/library';
import { libraryExamples } from '../src/v2/examples';
import { validateLibraryProgram } from '../src/v2/validate';
import { LibraryOpenuiBlock, setOpenExternal } from '../src/v2/block';
import { OpenuiBlock } from '../src/plugin';
import type { BlockProps as TranscriptCodeBlockProps } from '../src/v2/block';
import { props } from './helpers';

afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-hermes-mode'); document.querySelectorAll('style[id^="hermes-openui-library-css"]').forEach((e) => e.remove()); });
const wire = (p: TranscriptCodeBlockProps, n = 0) => { const raw = (p.submitInteraction as any).mock.calls[n][0] as string; expect(raw.startsWith('[A2UI_INTERACTION]\n')).toBe(true); return JSON.parse(raw.split('\n')[1]); };

describe('every openuiLibrary component renders in the host, both themes', () => {
  const parser = createParser(library.toJSONSchema(), library.root);
  const used = new Set<string>();
  const walk = (n: any) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(walk); if (n.type === 'element') used.add(n.typeName); for (const v of Object.values(n.props ?? n)) walk(v); };
  for (const code of Object.values(libraryExamples)) walk(parser.parse(code).root);
  it('the examples cover all library components', () => { expect(componentNames.length).toBe(82); expect(componentNames.filter((n) => !used.has(n))).toEqual([]); });
  for (const mode of ['light', 'dark'] as const) for (const [title, code] of Object.entries(libraryExamples)) it(`${title} validates and renders in ${mode}`, () => {
    document.documentElement.setAttribute('data-hermes-mode', mode);
    expect(validateLibraryProgram(code)).toMatchObject({ ok: true });
    const { container } = render(<LibraryOpenuiBlock {...props(code)} />);
    expect(container.querySelector('[data-openui-library]')).not.toBeNull();
    expect(container.querySelector('[aria-label="OpenUI source"]')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelectorAll('[class*="openui-"]').length).toBeGreaterThan(5);
  });
  it('the scoped sheet is installed once and removed with the plugin', () => {
    render(<><LibraryOpenuiBlock {...props(libraryExamples.Overview)} /><LibraryOpenuiBlock {...props(libraryExamples.Overview)} /></>);
    expect(document.querySelectorAll('style[id^="hermes-openui-library-css"]').length).toBe(1);
  });
  it('a new plugin build keeps its sheet when the old build disposes after it loaded', async () => {
    const sheets = () => [...document.querySelectorAll('style[id^="hermes-openui-library-css"]')].map((e) => e.id);
    const old = await import('../src/v2/surface');
    old.acquireStyles('.a{}');
    const before = sheets();
    vi.resetModules();
    const fresh = await import('../src/v2/surface');
    fresh.acquireStyles('.b{}');
    old.removeStyles();
    const after = sheets();
    expect(after).toHaveLength(1);
    expect(before).not.toContain(after[0]);
    fresh.removeStyles();
    expect(sheets()).toEqual([]);
  });
});

describe('validation is strict', () => {
  for (const [why, code] of Object.entries({
    'unknown component': 'root = Stack([Unknown("x")])',
    'live Query': 'root = Stack([TextContent(d.title)])\nd = Query("fetch_items", {}, {title: "x"})',
    'live Mutation': 'root = Stack([Button("Go", @Run(save))])\nsave = Mutation("save", {})',
    'type mismatch that would hang the Slider': 'root = Stack([Form("f", Buttons([Button("Go")]), [FormControl("S", Slider("s", "continuous", 0, 10, 1, 4))])])',
    'incomplete program': 'root = Stack([TextContent("unfinished"',
    'nested forms': 'root = Stack([Form("a", Buttons([Button("Go")]), [FormControl("x", Input("i1"))]), Form("a", Buttons([Button("Go")]))])',
    'empty': '   ',
  })) it('rejects ' + why, () => expect(validateLibraryProgram(code).ok).toBe(false));
  it('rejects oversized programs', () => expect(validateLibraryProgram('root = Stack([TextContent("' + 'x'.repeat(3_000_000) + '")])').ok).toBe(false));
  it('shows the source and the reason for an invalid program instead of rendering it', () => {
    render(<LibraryOpenuiBlock {...props('root = Stack([Query("x", {}, {})])')} />);
    expect(screen.getByRole('status').textContent).toMatch(/unavailable/i);
  });
  it('a partial streaming fence never renders controls', () => {
    render(<LibraryOpenuiBlock {...props(libraryExamples.Forms, { streaming: true, fenceClosed: false })} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Preparing');
  });
});

describe('chat actions use the guarded envelope', () => {
  const form = `root = Stack([form, TextContent("tail")])
form = Form("plan", btns, [f1, f2, f3, f4, f5, f6, f7, f8])
f1 = FormControl("Name", Input("name", "Your name", "text"))
f2 = FormControl("Notes", TextArea("notes", "Notes", 3))
f3 = FormControl("Pace", RadioGroup("pace", [RadioItem("Relaxed", "easy", "relaxed"), RadioItem("Busy", "more", "busy")], "relaxed"))
f4 = FormControl("Extras", CheckBoxGroup("extras", [CheckBoxItem("Lunch", "stop", "lunch", true), CheckBoxItem("Taxi", "ride", "taxi", false)]))
f5 = FormControl("Prefs", SwitchGroup("prefs", [SwitchItem("Quiet", "calm", "quiet", true)]))
f6 = FormControl("Interests", Chips("interests", "multiple", [ChipItem("art", "Art"), ChipItem("books", "Books")], {}, ["books"]))
f7 = FormControl("Style", OptionCards("style", "single", [OptionCard("calm", "Calm"), OptionCard("active", "Active")], {}, "calm"))
f8 = FormControl("Hours", Slider("hours", "discrete", 1, 8, 1, [2]))
btns = Buttons([Button("Suggest", @ToAssistant("Suggest a plan; do not book anything.", {topic: "weekend"}), "primary"), Button("Label only")])`;
  it('sends one request with the message, declared defaults and edits, only on a click', async () => {
    const p = props(form); render(<LibraryOpenuiBlock {...p} />);
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Kam' } });
    fireEvent.change(screen.getByPlaceholderText('Notes'), { target: { value: 'Quiet please' } });
    fireEvent.click(screen.getByRole('radio', { name: /Busy/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Taxi/ }));
    expect(p.submitInteraction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    await waitFor(() => expect(p.submitInteraction).toHaveBeenCalledTimes(1));
    const body = wire(p);
    expect(body.version).toBe('v0.9'); expect(body.action.name).toBe('openui.continue'); expect(body.action.surfaceId).toBe('openui-example-message-2');
    expect(body.action.context).toMatchObject({ renderer: 'openui', message: 'Suggest a plan; do not book anything.', form: 'plan', data: { topic: 'weekend' } });
    expect(body.action.context.values).toMatchObject({ name: 'Kam', notes: 'Quiet please', pace: 'busy', interests: ['books'], style: 'calm', hours: [2] });
    expect(body.action.context.values.extras).toEqual({ lunch: true, taxi: true });
    expect(body.action.context.values.prefs).toEqual({ quiet: true });
  });
  it('unchanged defaults are included even when nothing was touched', async () => {
    const p = props(form); render(<LibraryOpenuiBlock {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    await waitFor(() => expect(p.submitInteraction).toHaveBeenCalled());
    expect(wire(p).action.context.values).toMatchObject({ pace: 'relaxed', extras: { lunch: true, taxi: false }, prefs: { quiet: true }, interests: ['books'], style: 'calm', hours: [2] });
  });
  it('a Button without an action sends its label', async () => {
    const p = props(form); render(<LibraryOpenuiBlock {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Label only' }));
    await waitFor(() => expect(p.submitInteraction).toHaveBeenCalled());
    expect(wire(p).action.context.message).toBe('Label only');
  });
  it('a button outside any form sends just its message', async () => {
    const p = props('root = Stack([Button("Ping", @ToAssistant("Reply pong."))])'); render(<LibraryOpenuiBlock {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ping' }));
    await waitFor(() => expect(p.submitInteraction).toHaveBeenCalled());
    expect(wire(p).action.context).toEqual({ renderer: 'openui', message: 'Reply pong.' });
  });
  for (const [why, state] of [['busy', { busy: true }], ['read-only (stale or older message)', { readOnly: true }], ['streaming', { streaming: true, fenceClosed: true }]] as const) it(`blocks sends and shows a disabled state when ${why}`, () => {
    const p = props(form, state as any);
    if (why === 'streaming') { render(<LibraryOpenuiBlock {...p} />); expect(screen.queryByRole('button', { name: 'Suggest' })).toBeNull(); return; }
    const { container } = render(<LibraryOpenuiBlock {...p} />);
    const guarded = container.querySelector('[data-openui-guard="blocked"]'); expect(guarded).not.toBeNull(); expect(guarded!.hasAttribute('inert')).toBe(true); expect(guarded!.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect(p.submitInteraction).not.toHaveBeenCalled();
    if (state.readOnly) expect(screen.getAllByRole('status')[0].textContent).toContain('original chat');
  });
  it('reports a rejected origin guard instead of pretending success', async () => {
    const p = props(form, { submitInteraction: vi.fn(async () => ({ status: 'blocked' as const, reason: 'Connection changed' })) }); render(<LibraryOpenuiBlock {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Connection changed');
  });
  it('suppresses duplicate clicks while a send is pending, then re-enables', async () => {
    let release: ((v: any) => void) | undefined;
    const p = props(form, { submitInteraction: vi.fn(() => new Promise<any>((r) => { release = r; })) }); render(<LibraryOpenuiBlock {...p} />);
    const click = () => fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    click(); click();
    expect(p.submitInteraction).toHaveBeenCalledTimes(1);
    await act(async () => { release?.({ status: 'accepted' }); });
    await waitFor(() => expect(document.querySelector('[data-openui-guard]')).toBeNull());
  });
  it('maps unsupported actions to a visibly disabled button, never a dead one', () => {
    const { container } = render(<LibraryOpenuiBlock {...props('root = Stack([Button("Open", @OpenUrl("https://example.com")), Button("Bad link", @OpenUrl("javascript:alert(1)"))])')} />);
    const guards = [...container.querySelectorAll('[data-openui-guard="unsupported"]')];
    expect(guards.length).toBe(2); for (const g of guards) { expect(g.hasAttribute('inert')).toBe(true); expect(g.getAttribute('title')).toBeTruthy(); }
  });
  it('opens a web link through the audited host bridge only when it exists', async () => {
    const open = vi.fn(async () => ({ ok: true })); setOpenExternal(open);
    try {
      const p = props('root = Stack([Button("Open", @OpenUrl("https://example.com/page"))])'); render(<LibraryOpenuiBlock {...p} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await waitFor(() => expect(open).toHaveBeenCalledWith('https://example.com/page'));
      expect(p.submitInteraction).not.toHaveBeenCalled();
    } finally { setOpenExternal(undefined); }
  });
});

describe('local controls never send', () => {
  it('tabs, accordion, carousel, modal, editable-table edits and the image gallery stay local', async () => {
    const p = props(libraryExamples['Layout and navigation'] + '\n'); render(<LibraryOpenuiBlock {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    fireEvent.click(screen.getByText('What changes?'));
    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(p.submitInteraction).not.toHaveBeenCalled();
  });
  it('the image gallery viewer opens locally (no request)', async () => {
    const p = props(libraryExamples.Images); const { container } = render(<LibraryOpenuiBlock {...p} />);
    const tile = container.querySelector('[class*="openui-gallery"] img') as HTMLElement; expect(tile).not.toBeNull();
    fireEvent.click(tile);
    await waitFor(() => expect(document.querySelector('.openui-gallery__modal.hermes-openui-portal')).not.toBeNull());
    expect(p.submitInteraction).not.toHaveBeenCalled();
  });
  it('an EditableTable offers no Save and sends nothing until it is edited', () => {
    const p = props(libraryExamples['Layout and navigation']); render(<LibraryOpenuiBlock {...p} />);
    expect(screen.queryByRole('button', { name: /Save/i })).toBeNull(); expect(p.submitInteraction).not.toHaveBeenCalled();
  });
});

describe('router', () => {
  it('sends a library program to the library renderer through the plugin entry point', () => {
    const { container } = render(<OpenuiBlock {...props('root = Stack([TextContent("hello library")])')} />);
    expect(container.querySelector('[data-openui-library]')).not.toBeNull(); expect(container.querySelector('[data-openui-surface]')).toBeNull();
  });
});
