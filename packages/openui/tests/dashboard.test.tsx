import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { host } from '@hermes/plugin-sdk';
import { dashboardExamples } from '../src/dash/examples';
import { isDashboardProgram, validateDashboardProgram } from '../src/dash/validate';
import { createDashboardTools, DataError, readSource, waitForServer } from '../src/dash/tools';
import { dashboardActionSupport, resetComponentStyles } from '../src/dash/library';
import { DashboardBlock, IDLE_GRACE_MS } from '../src/dash/block';
import { setRest } from '../src/dash/runtime';
import { removeDashboardStyles } from '../src/dash/styles';
import { OpenuiCard } from '../src/plugin';
import { props as blockProps } from './helpers';

const observers: { cb: (e: { isIntersecting: boolean }[]) => void; el?: Element }[] = [];
class IO { cb: any; constructor(cb: any) { this.cb = cb; observers.push(this as any); } observe(el: Element) { (this as any).el = el; } unobserve() {} disconnect() {} takeRecords() { return []; } }
const showAll = (on = true) => act(() => { for (const o of observers) o.cb([{ isIntersecting: on }]); });

const props = (code: string, extra: object = {}) => ({ ...blockProps(code), backendId: 'backend-a', ...extra });
const pipelineData = { asOf: '2026-11-05', totals: { open: 3, value: 9000 }, byStage: [{ stage: 'new', value: 4000 }], deals: [{ name: 'Northwind renewal', stage: 'new', value: 4000 }] };
const sent = (rest: any) => rest.mock.calls.map(([, options]: any[]) => options.body);

let rest: ReturnType<typeof vi.fn>;
beforeEach(() => {
  observers.length = 0;
  (globalThis as any).IntersectionObserver = IO;
  rest = vi.fn(async (_path: string, options: any) => (options.body.source === 'crm.get_pipeline' ? { ok: true, data: pipelineData } : { ok: true, data: { asOf: '', services: [] } }));
  setRest(rest as any);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); setRest(null); });

describe('dashboard validation', () => {
  for (const [name, code] of Object.entries(dashboardExamples)) it(`${name} example is valid`, () => expect(validateDashboardProgram(code)).toMatchObject({ ok: true }));

  const base = dashboardExamples.Sales!;
  const bad: Record<string, [string, RegExp]> = {
    'a Mutation': [base + '\nsave = Mutation("crm.save", {})', /read-only/],
    'a source that is not server.tool': [base.replace('"crm.get_pipeline"', '"pipeline"'), /literal "server.tool"/],
    'a source from state': [base.replace('Query("crm.get_pipeline"', 'Query($tool'), /literal/],
    'an expression as an argument': [base.replace('{stage: $stage}', '{stage: $stage, n: 1 + 2}'), /plain value/],
    'fast auto-refresh': [base.replace('deals: []}, 300)', 'deals: []}, 30)'), /at least 120/],
    'figures in defaults': [base.replace('open: 0', 'open: 42'), /defaults must be 0/],
    'rows in defaults': [base.replace('deals: []}', 'deals: [{name: "x"}]}'), /default lists must be empty/],
    'a typed-in metric': [base.replace('SmallCard("Open deals", "" + pipe.totals.open)', 'SmallCard("Open deals", "12")'), /figures must come from a Query/],
    'a typed-in chart series': [base.replace('Series("Value", pipe.byStage.value)', 'Series("Value", [1, 2, 3])'), /Query|typed/],
    'a typed-in table column': [base.replace('Col("Deal", pipe.deals.name)', 'Col("Deal", ["A", "B"])'), /typed list/],
    'an unwired filter': [base.replace('{stage: $stage}', '{stage: "all"}'), /filter would change nothing/],
    'an unused query': [base + '\nextra = Query("crm.other", {}, {totals: {}})', /never shown/],
    '@Run on something that is not a query': [base.replace('@Run(pipe)', '@Run(header)'), /only refresh a declared Query|Unresolved reference/],
    'no query at all': ['root = Dashboard([DashboardHeader("Hi")])', /at least one Query/],
    'an image block': [base.replace('dealsCard = LargeCard([', 'dealsCard = LargeCard([ImageBlock("https://example.com/x.png"), '), /not available in dashboards/],
    'a typed figure built with an expression': [base.replace('"" + pipe.totals.open', '"" + 42000'), /must come from a Query/],
    'a typed figure added to a live one': [base.replace('"" + pipe.totals.open', 'pipe.totals.open + 1000'), /must come from a Query/],
    'a typed list behind an alias': [base.replace('Col("Deal", pipe.deals.name)', 'Col("Deal", names)') + '\nnames = ["A", "B"]', /typed list/],
    'a root that is not Dashboard': [base.replace('root = Dashboard([header, section])', 'root = Stack([header])'), /starts with root = Dashboard/],
  };
  for (const [why, [code, error]] of Object.entries(bad)) it(`rejects ${why}`, () => {
    const result = validateDashboardProgram(code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });

  it('accepts a result that is a list, with an empty list as its default', () => {
    const code = `root = Dashboard([section])\nrows = Query("crm.list", {}, [])\nsection = Section([CardRow([LargeCard([Table([Col("Name", rows.name)])])])])`;
    expect(validateDashboardProgram(code)).toMatchObject({ ok: true, sources: ['crm.list'] });
  });
  it('accepts plain number, true/false and list arguments', () => {
    expect(validateDashboardProgram(base.replace('{stage: $stage}', '{stage: $stage, limit: 25, open: true, tags: ["a", "b"]}'))).toMatchObject({ ok: true });
  });
  it('accepts a start value a filter sets freely', () => {
    expect(validateDashboardProgram(base.replace('$stage = "all"', '$stage = ""'))).toMatchObject({ ok: true });
  });
  it('tells a dashboard from an ordinary program', () => {
    expect(isDashboardProgram(base)).toBe(true);
    expect(isDashboardProgram('root = Stack([TextContent("Dashboard(x)")])')).toBe(false);
    expect(isDashboardProgram('root = Stack([TextContent("hi")])\nunused = Dashboard([])')).toBe(false);
  });
});

describe('the data tool map', () => {
  it('holds this dashboard\'s own sources and no inherited names', () => {
    const tools = createDashboardTools(['crm.a', 'crm.b'], async () => 1);
    expect(Object.keys(tools).sort()).toEqual(['crm.a', 'crm.b']);
    expect((tools as any).constructor).toBeUndefined();
  });
  it('returns any JSON the source gave and sends the backend id', async () => {
    rest.mockResolvedValueOnce({ ok: true, data: [1, 2] });
    await expect(readSource(rest as any, 'crm.a', { x: 'y' }, 'b1')).resolves.toEqual([1, 2]);
    expect(rest).toHaveBeenCalledWith('/data', expect.objectContaining({ method: 'POST', body: { source: 'crm.a', args: { x: 'y' }, backend_id: 'b1' } }));
    rest.mockResolvedValueOnce({ ok: true, data: 0 });
    await expect(readSource(rest as any, 'crm.a', {}, 'b1')).resolves.toBe(0);
  });
  it('throws on a failed or malformed answer, never resolves to an error', async () => {
    rest.mockResolvedValueOnce({ ok: false, code: 'held', error: 'crm failed recently.' });
    await expect(readSource(rest as any, 'crm.a', {}, 'b1')).rejects.toMatchObject({ code: 'held', message: 'crm failed recently.' });
    rest.mockResolvedValueOnce({ ok: true });
    await expect(readSource(rest as any, 'crm.a', {}, 'b1')).rejects.toBeInstanceOf(DataError);
    rest.mockRejectedValueOnce(Error('network down'));
    await expect(readSource(rest as any, 'crm.a', {}, 'b1')).rejects.toThrow('network down');
  });
});

describe('waiting for a server', () => {
  const status = (...values: string[]) => { let at = 0; return vi.fn(async () => ({ servers: [{ name: 'crm', status: values[Math.min(at++, values.length - 1)] }] })); };
  const noWait = async () => {};

  it('goes straight on when connected or lazy', async () => {
    for (const value of ['connected', 'lazy']) {
      const request = status(value);
      await waitForServer('crm', request as any, undefined, noWait);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it('waits while it connects and reports that it is waiting', async () => {
    const request = status('configured', 'connecting', 'connected');
    const seen: boolean[] = [];
    await waitForServer('crm', request as any, (waiting) => seen.push(waiting), noWait);
    expect(request).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([true, true, false]);
  });
  it('gives up with a reason, and stops at once for a failed or disabled server', async () => {
    await expect(waitForServer('crm', status('connecting') as any, undefined, noWait)).rejects.toThrow(/hasn't connected/);
    await expect(waitForServer('crm', status('failed') as any, undefined, noWait)).rejects.toThrow(/couldn't connect/);
    await expect(waitForServer('crm', status('disabled') as any, undefined, noWait)).rejects.toThrow(/turned off/);
  });
  it('lets the read report it when status is unavailable or the server is unknown', async () => {
    await waitForServer('crm', (async () => { throw Error('no such method'); }) as any, undefined, noWait);
    await waitForServer('crm', (async () => ({ servers: [] })) as any, undefined, noWait);
  });
});

describe('dashboard actions', () => {
  it('allows refreshing a query, local state and links, but nothing else new', () => {
    expect(dashboardActionSupport({ steps: [{ type: 'run' }] }, true)).toEqual({ ok: true });
    expect(dashboardActionSupport({ steps: [{ type: 'run' }, { type: 'reset' }] }, true)).toEqual({ ok: true });
    expect(dashboardActionSupport({ steps: [{ type: 'run' }, { type: 'custom_write' }] }, true).ok).toBe(false);
  });
});

describe('the live dashboard surface', () => {
  it('reads nothing until it is on screen, then shows live figures', async () => {
    render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    expect(rest).not.toHaveBeenCalled();
    expect(screen.getByText(/loads when this dashboard is on screen/)).toBeTruthy();
    showAll();
    await waitFor(() => expect(sent(rest)[0]).toMatchObject({ source: 'crm.get_pipeline', backend_id: 'backend-a' }));
    await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Live · read-only/)).toBeTruthy());
  });

  it('shows the failure reason, keeps the dashboard visible and retries', async () => {
    rest.mockResolvedValue({ ok: false, code: 'failed', error: 'upstream down' });
    const { container } = render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    showAll();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/upstream down/));
    expect(container.querySelector('.hod-body')?.textContent).toMatch(/Open deals/);
    rest.mockReset();
    rest.mockResolvedValue({ ok: true, data: pipelineData });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('waits for the server before the first read', async () => {
    let connected = false;
    vi.spyOn(host as any, 'request').mockImplementation(async () => ({ servers: [{ name: 'crm', status: connected ? 'connected' : 'connecting' }] }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    showAll();
    await waitFor(() => expect(screen.getByText(/Connecting to crm/)).toBeTruthy());
    expect(rest).not.toHaveBeenCalled();
    connected = true;
    await act(async () => { vi.advanceTimersByTime(2100); });
    await waitFor(() => expect(rest).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
  });

  it('pauses, without an error, on a card from another backend', async () => {
    rest.mockResolvedValue({ ok: false, code: 'wrong_backend', error: 'other' });
    render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    showAll();
    await waitFor(() => expect(screen.getByText(/Switch to the Hermes profile/)).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    const calls = rest.mock.calls.length;
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    expect(rest.mock.calls.length).toBe(calls);
  });

  it('a query that still fails keeps the failure showing when another query succeeds', async () => {
    const two = dashboardExamples.Sales!.replace('root = Dashboard([header, section])', 'root = Dashboard([header, section, moneySection])')
      + '\nmoney = Query("crm.finance", {}, {totals: {open: 0}})\nmoneySection = Section([CardRow([SmallCard("Outstanding", "" + money.totals.open)])], null, "Money")';
    expect(validateDashboardProgram(two)).toMatchObject({ ok: true });
    rest.mockImplementation(async (_p: string, options: any) => (options.body.source === 'crm.finance' ? { ok: false, code: 'failed', error: 'finance down' } : { ok: true, data: pipelineData }));
    render(<DashboardBlock {...props(two)} />);
    showAll();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/finance down/));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(sent(rest).filter((b: any) => b.source === 'crm.get_pipeline').length).toBeGreaterThan(1));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.getByRole('alert').textContent).toMatch(/finance down/);
    expect(screen.queryByText(/Live · read-only/)).toBeNull();
  });

  it('a read that settles after going idle cannot leave the strip stuck or wrong', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let release: (v: unknown) => void = () => {};
    rest.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    showAll();
    await waitFor(() => expect(screen.getByText(/Loading live data/)).toBeTruthy());
    showAll(false);
    await act(async () => { vi.advanceTimersByTime(IDLE_GRACE_MS + 50); });
    showAll(true);
    await waitFor(() => expect(rest.mock.calls.length).toBeGreaterThan(1));
    await act(async () => { release({ ok: true, data: pipelineData }); });
    await waitFor(() => expect(screen.getByText(/Live · read-only/)).toBeTruthy());
  });

  it('stops reading after it has been off screen for the grace period', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    showAll();
    await waitFor(() => expect(rest).toHaveBeenCalled());
    showAll(false);
    await act(async () => { vi.advanceTimersByTime(IDLE_GRACE_MS + 50); });
    await waitFor(() => expect(screen.getByText(/loads when this dashboard is on screen/)).toBeTruthy());
  });

  it('many off-screen dashboards in a long chat make no reads', async () => {
    render(<>{Array.from({ length: 6 }, (_, i) => <DashboardBlock key={i} {...props(dashboardExamples.Sales!, { origin: { messageId: 'm' + i, blockIndex: 0 } })} />)}</>);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(rest).not.toHaveBeenCalled();
  });

  it('an invalid dashboard shows its source and the reason', () => {
    render(<DashboardBlock {...props('root = Dashboard([DashboardHeader("Hi")])')} />);
    expect(screen.getByText(/Dashboard unavailable: .*at least one Query/)).toBeTruthy();
  });

  it('keeps reading live data after a button has been answered', async () => {
    render(<DashboardBlock {...props(dashboardExamples.Sales!, { answered: true })} />);
    showAll();
    await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
  });
});

describe('keeping up with the server and the connection', () => {
  const statuses = (get: () => string) => vi.spyOn(host as any, 'request').mockImplementation(async () => ({ servers: [{ name: 'crm', status: get() }] }));
  const S = () => dashboardExamples.Sales!;

  it('asks for the server state again before a later read', async () => {
    let status = 'connected';
    statuses(() => status);
    render(<DashboardBlock {...props(S())} />);
    showAll();
    await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
    const calls = rest.mock.calls.length;
    status = 'failed';
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/couldn't connect/));
    expect(rest.mock.calls.length).toBe(calls);
  });

  it('resumes when the connection changes, even with the same profile name', async () => {
    rest.mockResolvedValue({ ok: false, code: 'wrong_backend', error: 'other' });
    const view = render(<DashboardBlock {...props(S())} />);
    showAll();
    await waitFor(() => expect(screen.getByText(/Switch to the Hermes profile/)).toBeTruthy());
    rest.mockReset();
    rest.mockResolvedValue({ ok: true, data: pipelineData });
    const state = host.state as any;
    const original = state.connectionId;
    state.connectionId = { get: () => 'connection-b', listen: () => () => undefined };
    try {
      view.rerender(<DashboardBlock {...props(S())} />);
      await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
      expect(screen.queryByText(/Switch to the Hermes profile/)).toBeNull();
    } finally {
      state.connectionId = original;
    }
  });

  it('a new connection gets its own server check', async () => {
    let first = true;
    vi.spyOn(host as any, 'request').mockImplementation(() => {
      if (first) { first = false; return new Promise(() => {}); }
      return Promise.resolve({ servers: [{ name: 'crm', status: 'connected' }] });
    });
    const view = render(<DashboardBlock {...props(S())} />);
    showAll();
    await waitFor(() => expect(host.request).toHaveBeenCalledTimes(1));
    const state = host.state as any;
    const original = state.connectionId;
    state.connectionId = { get: () => 'connection-b', listen: () => () => undefined };
    try {
      view.rerender(<DashboardBlock {...props(S())} />);
      await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
    } finally {
      state.connectionId = original;
    }
  });

  it('a late answer from another backend cannot pause a card that has moved on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let release: (v: unknown) => void = () => {};
    rest.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    render(<DashboardBlock {...props(S())} />);
    showAll();
    await waitFor(() => expect(rest).toHaveBeenCalledTimes(1));
    showAll(false);
    await act(async () => { vi.advanceTimersByTime(IDLE_GRACE_MS + 50); });
    showAll(true);
    await waitFor(() => expect(screen.getByText('Northwind renewal')).toBeTruthy());
    await act(async () => { release({ ok: false, code: 'wrong_backend', error: 'other' }); });
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(screen.queryByText(/Switch to the Hermes profile/)).toBeNull();
    expect(screen.getByText('Northwind renewal')).toBeTruthy();
  });

  it('does not read after a long server wait if the card has left the screen', async () => {
    let status = 'connecting';
    statuses(() => status);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<DashboardBlock {...props(S())} />);
    showAll();
    await waitFor(() => expect(screen.getByText(/Connecting to crm/)).toBeTruthy());
    showAll(false);
    await act(async () => { vi.advanceTimersByTime(IDLE_GRACE_MS + 50); });
    status = 'connected';
    for (let i = 0; i < 4; i++) await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(rest).not.toHaveBeenCalled();
  });
});

describe('nested arguments', () => {
  const base = () => dashboardExamples.Sales!;
  it('accepts objects with a filter inside them', () => {
    expect(validateDashboardProgram(base().replace('{stage: $stage}', '{input: {stage: $stage, range: {from: "2026-01-01", to: "2026-02-01"}}}'))).toMatchObject({ ok: true });
  });
  it('still rejects expressions inside them', () => {
    expect(validateDashboardProgram(base().replace('{stage: $stage}', '{input: {stage: $stage, n: 1 + 2}}'))).toMatchObject({ ok: false });
  });
});

describe('the plugin card', () => {
  const card = (result: unknown): any => ({
    args: { program: dashboardExamples.Sales }, result, sessionId: 's', toolName: 'openui_present', toolCallId: 't', fallback: <p>file card</p>,
    file: { name: 'a.md', kind: 'file', mime: 'text/markdown', path: '/x/a.md', resolveUrl: async () => '' },
  });
  for (const [form, result] of [['an object', { backend_id: 'b9' }], ['a JSON string', JSON.stringify({ backend_id: 'b9' })]] as const) {
    it(`takes the backend id from ${form} result`, async () => {
      render(<OpenuiCard {...card(result)} />);
      showAll();
      await waitFor(() => expect(sent(rest)[0]).toMatchObject({ backend_id: 'b9' }));
    });
  }
});

describe('dashboard styles stay inside dashboards', () => {
  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  it('sets no --openui-* variables on :root and writes component rules into the plugin sheet', async () => {
    render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    await flush();
    expect(document.getElementById('openui-defaults')).toBeNull();
    expect(document.getElementById('openui-styles')).toBeNull();
    const rootVars = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
      .map((r) => r.cssText).filter((t) => /^(:root|:where\(:root\)|html|body)\b/.test(t.trim()) && t.includes('--openui-'));
    expect(rootVars).toEqual([]);
    const sheet = document.querySelector('style[id^="hermes-openui-dashboard-styles"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.textContent!.startsWith('@layer hermes-openui{')).toBe(true);
  });
  it('a new plugin build keeps its styles when the old build disposes after it loaded', async () => {
    const sheets = () => [...document.querySelectorAll('style[id^="hermes-openui-dashboard-"]')].map((e) => e.id);
    const first = render(<DashboardBlock {...props(dashboardExamples.Sales!)} />);
    await flush();
    const before = sheets();
    expect(before.length).toBeGreaterThan(0);
    vi.resetModules();
    const fresh = await import('../src/dash/block');
    const runtime = await import('../src/dash/runtime');
    runtime.setRest(rest as any);
    render(<fresh.DashboardBlock {...props(dashboardExamples.Service!)} />);
    await flush();
    first.unmount();
    removeDashboardStyles();
    resetComponentStyles();
    const after = sheets();
    expect(after.filter((id) => before.includes(id))).toEqual([]);
    expect(after.length).toBeGreaterThan(0);
  });
});

describe('dashboard text cannot load images', () => {
  it('a Markdown image in a dashboard renders as text and requests nothing', async () => {
    const code = dashboardExamples.Sales!.replace('dealsCard = LargeCard([', 'dealsCard = LargeCard([MarkDownRenderer("Note ![pic](https://example.com/p.png)"), ');
    expect(validateDashboardProgram(code)).toMatchObject({ ok: true });
    const { container } = render(<DashboardBlock {...props(code)} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toMatch(/pic/);
  });
});
