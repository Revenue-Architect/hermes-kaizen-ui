// Strict validation for dashboard programs (root = Dashboard(...)). The renderer only ever runs what this accepts:
// literal source names, filters wired into those reads, numbers that come from the reads, no Mutation, and @Run
// only on a declared Query.
import { createParser, type ElementNode } from '@openuidev/react-lang';
import { parseExpression, split, tokenize, type ASTNode } from '@openuidev/lang-core';
import { dashboardComponentNames, dashboardLibrary } from './library';
import { isSourceName, LIMITS } from './tools';

export const MAX_DASHBOARD_BYTES = 200_000;
const MAX_ELEMENTS = 600;
const MAX_DEPTH = 40;
const componentNames = new Set(dashboardComponentNames);
const FILTERS = new Set(['FilterSelect', 'FilterMultiSelect', 'DatePicker']);
/** Components whose non-title text is a number a reader trusts: it must come from a Query, never be typed in. */
const METRICS = new Set(['SmallCard', 'MetricIndicator', 'OverviewCardItem']);
/** Where each metric component takes its value (from the library's signatures). */
const METRIC_VALUE_ARG: Record<string, number> = { SmallCard: 1, MetricIndicator: 0, OverviewCardItem: 5, DashboardCardHeader: 0 };
/** Charts, series and table columns take their data positionally: a literal list there is typed-in data. */
const DATA_SLOTS = new Set(['LineChart', 'BarChart', 'AreaChart', 'HorizontalBarChart', 'RadarChart', 'ScatterChart', 'RadialChart', 'PieChart', 'Series', 'ScatterSeries', 'Col']);
/** ImageBlock loads a remote image; Select in a card has no binding, so it would be a filter that filters nothing. */
const NOT_IN_DASHBOARDS = new Set(['ImageBlock', 'Select']);
const SCALAR = new Set(['Str', 'Num', 'Bool', 'Null', 'Obj']);
const ACTION_STEPS = new Set(['Run', 'ToAssistant', 'OpenUrl', 'Set', 'Reset']);

export type DashboardValidation =
  | { ok: true; sources: string[]; elements: number }
  | { ok: false; error: string };

let parser: ReturnType<typeof createParser> | undefined;
const isElement = (v: unknown): v is ElementNode => !!v && typeof v === 'object' && (v as { type?: unknown }).type === 'element';

function walk(node: ASTNode | null | undefined, visit: (n: ASTNode) => void): void {
  if (!node) return;
  visit(node);
  switch (node.k) {
    case 'Comp': node.args.forEach((a) => walk(a, visit)); if (node.mappedProps) Object.values(node.mappedProps).forEach((a) => walk(a, visit)); break;
    case 'Arr': node.els.forEach((a) => walk(a, visit)); break;
    case 'Obj': node.entries.forEach(([, a]) => walk(a, visit)); break;
    case 'BinOp': walk(node.left, visit); walk(node.right, visit); break;
    case 'UnaryOp': walk(node.operand, visit); break;
    case 'Ternary': walk(node.cond, visit); walk(node.then, visit); walk(node.else, visit); break;
    case 'Member': walk(node.obj, visit); break;
    case 'Index': walk(node.obj, visit); walk(node.index, visit); break;
    case 'Assign': walk(node.value, visit); break;
    default: break;
  }
}

/** Is this the root statement `root = Dashboard(...)`, written directly (not a ternary, not another name)? */
export function isDashboardProgram(code: string): boolean {
  try {
    const root = split(tokenize(code)).find((s) => s.id === 'root');
    if (!root) return false;
    const ast = parseExpression(root.tokens);
    return ast.k === 'Comp' && ast.name === 'Dashboard';
  } catch { return false; }
}

const fail = (error: string): DashboardValidation => ({ ok: false, error });

/** Query defaults are placeholders while data loads: zeros, empty lists, empty or label text. Never business figures. */
function checkDefaults(node: ASTNode | null, id: string): string | null {
  if (!node) return `Query ${id} needs defaults in the shape of its result (zeros and empty lists).`;
  if (node.k === 'Str' && !node.v) return null;
  if (node.k === 'Num' && node.v === 0) return null;
  if (node.k !== 'Obj' && !(node.k === 'Arr' && !node.els.length)) return `Query ${id} needs defaults in the shape of its result (zeros and empty lists).`;
  let problem: string | null = null;
  walk(node, (n) => {
    if (problem) return;
    if (n.k === 'Num' && n.v !== 0) problem = `Query ${id}: defaults must be 0, not ${n.v}. Live numbers come from the tool.`;
    else if (n.k === 'Arr' && n.els.length) problem = `Query ${id}: default lists must be empty.`;
    else if (n.k === 'Str' && /\d/.test(n.v)) problem = `Query ${id}: default text cannot contain figures.`;
    else if (!['Obj', 'Num', 'Arr', 'Str', 'Bool', 'Null'].includes(n.k)) problem = `Query ${id}: defaults must be plain values.`;
  });
  return problem;
}

/** An argument is plain JSON, and any value in it can be a $filter variable. */
function argumentProblem(value: ASTNode, depth = 0): boolean {
  if (value.k === 'Str' || value.k === 'Num' || value.k === 'Bool' || value.k === 'Null' || value.k === 'StateRef') return false;
  if (depth >= 4) return true;
  if (value.k === 'Arr') return value.els.some((e) => argumentProblem(e, depth + 1));
  if (value.k === 'Obj') return value.entries.some(([, v]) => argumentProblem(v, depth + 1));
  return true;
}

export function validateDashboardProgram(code: string): DashboardValidation {
  try {
    if (typeof code !== 'string' || !code.trim()) return fail('Empty program.');
    if (new TextEncoder().encode(code).length > MAX_DASHBOARD_BYTES) return fail('The dashboard exceeds the size limit.');
    if (!isDashboardProgram(code)) return fail('A dashboard starts with root = Dashboard(...).');
    parser ??= createParser(dashboardLibrary.toJSONSchema(), 'Dashboard');
    const result = parser.parse(code);
    if (!result.root) return fail('The dashboard has no root = Dashboard(...).');
    if (result.meta.incomplete) return fail('The dashboard is incomplete.');
    if (result.meta.unresolved.length) return fail('Unresolved reference: ' + result.meta.unresolved.slice(0, 3).join(', '));
    if (result.meta.errors.length) { const e = result.meta.errors[0] as { message?: string; component?: string }; return fail(`${e.component ? e.component + ': ' : ''}${e.message ?? 'The dashboard does not match the component library.'}`); }
    if (result.mutationStatements.length) return fail('Dashboards are read-only: Mutation is not available.');
    if (!result.queryStatements.length) return fail('A dashboard reads live data: add at least one Query on a listed source.');
    if (result.queryStatements.length > LIMITS.maxQueries) return fail(`At most ${LIMITS.maxQueries} queries per dashboard.`);

    const queries: { id: string; source: string }[] = [];
    const queryIds = new Set<string>();
    const queryDeps = new Set<string>();
    for (const q of result.queryStatements) {
      if (!q.complete) return fail('The dashboard is incomplete.');
      if (q.toolAST?.k !== 'Str' || !isSourceName(q.toolAST.v)) return fail(`Query ${q.statementId}: the source must be a literal "server.tool" string.`);
      if (q.argsAST && q.argsAST.k !== 'Obj') return fail(`Query ${q.statementId}: arguments must be an object.`);
      for (const [key, value] of q.argsAST?.k === 'Obj' ? q.argsAST.entries : []) {
        if (argumentProblem(value)) return fail(`Query ${q.statementId}: ${key} must be a plain value, a list or object of them, or a $filter variable.`);
        walk(value, (n) => { if (n.k === 'StateRef') queryDeps.add(n.n); });
      }
      const defaults = checkDefaults(q.defaultsAST, q.statementId);
      if (defaults) return fail(defaults);
      if (q.refreshAST && !(q.refreshAST.k === 'Num' && Number.isFinite(q.refreshAST.v) && q.refreshAST.v >= LIMITS.refreshMinSeconds)) return fail(`Query ${q.statementId}: auto-refresh must be at least ${LIMITS.refreshMinSeconds} seconds, or left out.`);
      if (q.waitFor?.length) return fail(`Query ${q.statementId}: queries cannot read other queries here.`);
      queries.push({ id: q.statementId, source: q.toolAST.v }); queryIds.add(q.statementId);
    }

    // Statement-level checks over every assignment.
    const statements = split(tokenize(code)).map((s) => ({ id: s.id, ast: parseExpression(s.tokens) }));
    const byId = new Map(statements.map((s) => [s.id, s.ast]));
    /** Follow plain aliases (x = y) to the expression they name; queries are left as references. */
    const resolve = (node: ASTNode, depth = 0): ASTNode => (node.k === 'Ref' && !queryIds.has(node.n) && byId.has(node.n) && depth < 20 ? resolve(byId.get(node.n)!, depth + 1) : node);
    /** Does this value come from a Query result (directly or through aliases), with no typed-in figure added? */
    const fromQuery = (node: ASTNode, depth = 0): boolean => {
      let hits = false; let typed = false;
      const visit = (n: ASTNode, d: number) => {
        if ((n.k === 'Ref' || n.k === 'RuntimeRef') && queryIds.has(n.n)) { hits = true; return; }
        if (n.k === 'Ref' && byId.has(n.n) && d < 20) { visit(byId.get(n.n)!, d + 1); return; }
        if (n.k === 'Num' || (n.k === 'Str' && /\d/.test(n.v))) { typed = true; return; }
        if (n.k === 'Comp') { n.args.forEach((a) => { if (a.k !== 'Num') visit(a, d); }); return; } // @Round(x, 1): the 1 is not a figure
        if (n.k === 'BinOp') { visit(n.left, d); visit(n.right, d); return; }
        if (n.k === 'Ternary') { visit(n.cond, d); visit(n.then, d); visit(n.else, d); return; }
        if (n.k === 'Member') { visit(n.obj, d); return; }
        if (n.k === 'Index') { visit(n.obj, d); return; }
        if (n.k === 'UnaryOp') { visit(n.operand, d); return; }
        if (n.k === 'Arr') { n.els.forEach((e) => visit(e, d)); return; }
      };
      visit(node, depth);
      return hits && !typed;
    };
    const used = new Set<string>();
    let problem: string | null = null;
    for (const s of statements) {
      if (queryIds.has(s.id)) continue;
      walk(s.ast, (n) => {
        if (problem) return;
        if ((n.k === 'Ref' || n.k === 'RuntimeRef') && queryIds.has(n.n)) used.add(n.n);
        if (n.k !== 'Comp') {
          if (n.k === 'Arr' && n.els.length && n.els.every((e) => e.k === 'Num')) problem = 'Figures must come from a Query, not be typed into the dashboard.';
          return;
        }
        if (n.name === 'Query' || n.name === 'Mutation') problem = 'Query and Mutation must each be their own statement.';
        else if (NOT_IN_DASHBOARDS.has(n.name)) problem = `${n.name} is not available in dashboards.`;
        else if (n.name === 'Run') {
          const target = n.args[0];
          if (n.args.length !== 1 || !target || (target.k !== 'Ref' && target.k !== 'RuntimeRef') || !queryIds.has(target.n)) problem = '@Run can only refresh a declared Query.';
        } else if (n.name === 'Action') {
          const steps = n.args[0]?.k === 'Arr' ? n.args[0].els : n.args;
          if (steps.length > LIMITS.maxActionSteps) problem = `At most ${LIMITS.maxActionSteps} steps per action.`;
          for (const step of steps) if (step.k === 'Comp' && !ACTION_STEPS.has(step.name)) problem = `Action step @${step.name} is not available in dashboards.`;
        } else if (DATA_SLOTS.has(n.name)) {
          if (n.args.map((a) => resolve(a)).some((a) => a.k === 'Arr' && a.els.length && a.els.every((e) => SCALAR.has(e.k)))) problem = `${n.name}: rows and series must come from a Query result (for example data.rows.name), not a typed list.`;
        } else if (METRICS.has(n.name) || (n.name === 'DashboardCardHeader' && n.args[2]?.k === 'Str' && n.args[2].v === 'number')) {
          const value = n.args[METRIC_VALUE_ARG[n.name] ?? 0];
          // A metric value is either plain label text with no figure in it, or derived from a Query with nothing typed in.
          const labelOnly = value && ((value.k === 'Str' && !/\d/.test(value.v)) || (value.k === 'Arr' && value.els.every((e) => e.k === 'Comp'))); // a list of MetricIndicators is checked one by one
          const uiComponent = value?.k === 'Comp' && componentNames.has(value.name); // checked on its own; @functions are not
          if (value && value.k !== 'Null' && !labelOnly && !uiComponent && !fromQuery(value)) problem = `${n.name}: figures must come from a Query result, not be typed in.`;
        } else if (FILTERS.has(n.name)) {
          const binding = n.args.find((a) => a.k === 'StateRef');
          if (!binding || binding.k !== 'StateRef') problem = `${n.name} must be bound to a $variable that a Query reads.`;
          else if (!queryDeps.has(binding.n)) problem = `${n.name} sets ${binding.n}, but no Query passes ${binding.n} to its tool, so the filter would change nothing.`;
        }
      });
      if (problem) return fail(problem);
    }
    const unused = queries.find((q) => !used.has(q.id));
    if (unused) return fail(`Query ${unused.id} is never shown; remove it or use its result.`);

    // Element tree limits, as for other OpenUI surfaces.
    let count = 0;
    const visit = (value: unknown, depth: number) => {
      if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
      if (!value || typeof value !== 'object') return;
      if (!isElement(value)) { for (const item of Object.values(value)) visit(item, depth + 1); return; }
      if (++count > MAX_ELEMENTS || depth > MAX_DEPTH) throw Error('The dashboard is too large or deeply nested.');
      for (const item of Object.values(value.props as Record<string, unknown>)) visit(item, depth + 1);
    };
    visit(result.root, 0);
    return { ok: true, sources: [...new Set(queries.map((q) => q.source))], elements: count };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Invalid dashboard.');
  }
}
