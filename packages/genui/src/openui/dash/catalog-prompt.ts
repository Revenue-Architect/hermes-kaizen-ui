// Model-facing guidance for live dashboards, generated from the dashboard library itself. The upstream prompt teaches
// static numbers, Mutation and generic filters, so its examples and extra rules are replaced (not appended to), and
// its Mutation section is cut. What stays is the language reference and the component signatures, which are its own.
import { dashboardLibrary } from './library';
import { dashboardExamples } from './examples';
import { LIMITS } from './tools';

const SOURCE_SPEC = {
  name: 'server.tool',
  description: 'Any source this Hermes lists in dashboard_sources, written as server.tool. The system prompt names them. Learn a source\'s result shape by calling that MCP tool once in this turn, then wire the dashboard to the same field names.',
  inputSchema: { type: 'object', additionalProperties: true },
  outputSchema: { type: 'object', description: 'Whatever that tool returns as JSON: an object, a list or a single value. Plain text arrives as {text: "..."}.' },
  annotations: { readOnlyHint: true, destructiveHint: false },
};

export const DASHBOARD_RULES = [
  'A dashboard is a call to openui_present whose program starts with root = Dashboard([...]). Keep a short sentence of text in the reply. Draw one only when someone wants to see, track or compare figures that a listed source can supply. Otherwise answer in text.',
  'Every figure, row and chart value comes from Query() on a listed source. Never type numbers, names or rows into the dashboard, not even as examples: typed-in figures and literal data lists are rejected.',
  'Write the source as a literal string, for example Query("crm.get_pipeline", {stage: $stage}, defaults). Arguments are the tool\'s own fields: plain values, lists or objects of them, and $variables anywhere inside.',
  'Filters send text, or a list of text for FilterMultiSelect. Wire a filter only to a text or text-list argument, and give numbers and true/false arguments as literal values. An empty filter sends nothing, so the tool uses its own default.',
  'Query defaults are placeholders while data loads and must match the result\'s shape: 0 for numbers, [] for lists, "" for text. For a result that is a list, the default is []. They are not shown as real figures.',
  `Refresh: add a refresh IconButton or Button with Action([@Run(query)]). An automatic refresh, if any, is the 4th Query argument and must be at least ${LIMITS.refreshMinSeconds} seconds; usually leave it out.`,
  'Filters go in the Section FilterBar, bound to a $variable that a Query reads. A filter no Query reads is rejected.',
  'Mutation, writes and @Run on anything but a Query are not available: dashboards only read. To act on something, use a Button with @ToAssistant("…") so the person asks you in chat, or @OpenUrl with an https link from the result.',
  'Turn numbers into text for cards with "" + value. Tables take whole columns: Col("Deal", pipe.deals.name). Charts take plucked arrays: BarChart(pipe.byStage.stage, [Series("Value", pipe.byStage.value)]).',
  `At most ${LIMITS.maxQueries} queries and ${LIMITS.maxActionSteps} action steps per click. Use each Query result somewhere. No ImageBlock or other images in dashboards.`,
];

export const DASHBOARD_PREAMBLE = 'You build live, read-only dashboards in the Hermes chat. The dashboard you write is wiring only: Hermes reads the real figures from the listed MCP tools while it is on screen, with filters and a refresh button.';

/** Replaces one `## Title` section (up to the next `## `) or drops it; throws if the upstream heading moved. */
function section(prompt: string, title: string, body: string | null): string {
  const start = prompt.indexOf(`\n## ${title}\n`);
  if (start < 0) throw Error(`dashboard prompt: section "${title}" not found; the library prompt changed`);
  const next = prompt.indexOf('\n## ', start + 4);
  return prompt.slice(0, start) + (body ? `\n## ${title}\n\n${body.trim()}\n` : '') + (next < 0 ? '' : prompt.slice(next));
}

const ACTIONS = `An action wires a button click to steps. Pass one @-step bare, or several in Action([...]).

Available steps in a dashboard:
- @Run(query): fetch that Query again (a Refresh button). It can only name a declared Query.
- @ToAssistant(message): ask Hermes in this chat, for example Button("Plan follow-ups", @ToAssistant("Draft follow-ups for the overdue deals")).
- @OpenUrl(url): open an https link, for example from a row's url field.
- @Set($variable, value) and @Reset($variable): change a filter locally.

Refresh pattern:
\`\`\`
refresh = IconButton("Refresh", "refresh-cw", null, Action([@Run(pipe)]), "tertiary")
\`\`\`
Dashboards never write: there is no Mutation and no form submission to a tool.`;

const FILTERS_TEXT = `Filters live in the Section's FilterBar and must change what a Query reads:
1. Declare the variable: \`$stage = "all"\`
2. Bind a FilterSelect to it: \`FilterSelect("stage", "Stage", [{value: "all", label: "All"}, {value: "won", label: "Won"}], $stage)\`
3. Pass it to the Query: \`pipe = Query("crm.get_pipeline", {stage: $stage}, {...defaults})\`
Changing the filter reads again. Only offer values the tool accepts. A filter no Query reads is rejected.`;

const WORKFLOW = `1. Pick the listed source that answers the question. Call that MCP tool once yourself to learn its result shape. Do not copy its numbers in: the dashboard reads live.
2. Write one Query per source you need, with placeholder defaults in the same shape: 0, [] and "".
3. Derive everything shown from the Query results: "" + pipe.totals.open, Col("Deal", pipe.deals.name), BarChart(pipe.byStage.stage, [Series("Value", pipe.byStage.value)]), @Count(@Filter(work.tasks, "overdue", "==", true)).
4. Add FilterSelect filters wired to Query arguments, and a refresh IconButton with @Run.
5. Never type figures, names or rows into the program, and never invent mock data. If no listed source covers the request, say so in text instead of drawing a dashboard.`;

const TOOLS_INTRO = 'A dashboard can only read the sources this Hermes lists, which the system prompt names. They are read-only. Use each with Query() only, with its name as a literal string.';

function dashboardOnly(prompt: string): string {
  let out = section(prompt, 'Mutation — Write Operations', null);
  out = out.replace('- Fourth arg (optional): refresh interval in seconds (e.g. 30 for auto-refresh every 30s)', `- Fourth arg (optional): refresh interval in seconds, at least ${LIMITS.refreshMinSeconds}; usually leave it out and add a refresh button`);
  out = section(out, 'Action — Button Behavior', ACTIONS);
  out = section(out, 'Interactive Filters', FILTERS_TEXT);
  out = section(out, 'Forms', null);
  out = section(out, 'Data Workflow', WORKFLOW);
  const tools = out.indexOf('\n## Available Tools\n');
  const firstLine = out.indexOf('\n', tools + 22);
  out = out.slice(0, tools) + `\n## Available Tools\n\n${TOOLS_INTRO}\n` + out.slice(out.indexOf('\n', firstLine + 1));
  out = out.replace(/^CRITICAL: Use ONLY the tools listed above in Query\(\) and Mutation\(\) calls\..*$/m,
    'CRITICAL: Use ONLY listed sources, in Query() calls. Do NOT invent source names, and never fall back to mock data.');
  out = out.replace(/\n### Default values for Query results\n[\s\S]*?(?=\nCRITICAL:)/, '\n### Default values for Query results\n\nUse placeholders in the shape of the result: zeros, empty lists and empty text, never real figures.\n');
  const leftover = /.*(?:Mutation\(|use realistic mock data|Mutations\b|condensed Query defaults|FormControl\().*/i.exec(out.replace(/Dashboards never write: there is no Mutation[^\n]*/g, '').replace(/^\d*\.? ?- ?Mutation, writes[^\n]*$/m, '').replace(/^.*Mutation, writes and @Run[^\n]*$/m, ''));
  if (leftover) throw Error('dashboard prompt: upstream still teaches writes or mock data: ' + leftover[0].slice(0, 160));
  return out;
}

export const dashboardPrompt = dashboardOnly(dashboardLibrary.prompt({
  preamble: DASHBOARD_PREAMBLE,
  additionalRules: DASHBOARD_RULES,
  examples: [],
  toolExamples: Object.values(dashboardExamples),
  tools: [SOURCE_SPEC] as never,
  toolCalls: true,
  bindings: true,
}));

export const dashboardComponents = Object.keys(dashboardLibrary.components).sort();
export { dashboardExamples };
