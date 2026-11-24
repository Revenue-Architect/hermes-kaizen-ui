---
name: a2ui
description: "Draw interactive A2UI 1.0 views, written in A2UI Express, in the Hermes Desktop and Webapp chat: status, plans, tables, citations, drafts, charts, schedules, choices, scenarios, maps, comparisons, journeys and evidence views. Short answers stay text."
version: 2.0.0
license: MIT
metadata:
  hermes:
    tags: [A2UI, GenUI, Desktop]
---

# A2UI

Call `a2ui_present` with `express` (the whole view in A2UI Express, see "Writing a view in Express") and `fallback_text` (the same content as plain text). Send JSONL in `payload` instead only when the tool answers `express_unavailable` (see "JSON fallback"); never send both. When it returns `media`, write at most one short sentence and put that media line on its own line. When it returns `text`, the client can't draw views, so reply with that text.

Reach for a view when interaction or structure serves better than prose. Short answers stay prose. If the user asks for A2UI, use it.

## Generated UI design rules (October 22, 2026)

These rules apply to both A2UI and OpenUI in Hermes.

- Never use colored left borders, accent rails, side stripes or a colored edge to decorate a card, heading, quote, verdict or callout. Use a quiet uniform outline or spacing.
- Use neutral surfaces and readable type. Avoid large tinted status slabs, decorative gradients, glass effects, glow, heavy shadows, oversized verdict cards and repetitive rounded card grids.
- Use a status label or icon only when it conveys actual state. Do not add a success badge to an opinion, recommendation or ordinary explanation. Keep semantic color small and purposeful; never communicate state with color alone.
- Keep table headers neutral. Use color for meaningful data distinctions and charts, not decoration. Avoid rainbow sections, gratuitous emoji, redundant pills and excessive uppercase micro-labels.
- Keep rich UI useful: concise headings, compact rows, checklists, comparisons, charts and working controls. Group related content without boxing every paragraph. Match the host theme, light/dark mode and mobile width.

## Extended native catalog (Hermes A2UI plugin 1.0+)

Read `references/extended-component-guide.md` before using a new type. The exact bounded schemas are in `references/extension-schemas.json`; never invent properties or component names.

Use CitationCard/SourceExcerpt for quoted source evidence; DataTable for real multi-row data; DraftReview for a complete unsent draft; ChangeDiff for text changes; MultiSeriesChart for aligned observed series; Agenda/CalendarGrid for supplied dates; DecisionTree for explicit choices; ScenarioSlider for a stated linear estimate; RelationshipMap/RoomMap for supplied relationships/geometry; BeforeAfterViewer for text comparison; JourneyMap for supplied travel stages; EvidenceTrail for fact versus interpretation. Use local controls only to explore supplied data. No widget sends, applies, fetches arbitrary URLs, or creates facts. Images use authenticated MEDIA attachments. BeforeAfterViewer optionally references paired beforeMedia/afterMedia paths, and RoomMap optionally references backgroundMedia. Each path must exactly match an image MEDIA directive in this same reply; include those directives outside the A2UI fence. No arbitrary image URLs. RoomMap geometry must still be explicitly supplied; the reference image is separate from the geometry diagram.

For source evidence, preserve the excerpt and page/location. InfoRow detail should stay ≤160 characters when generating; use source widgets or ExpandableSection for longer evidence. The app preserves older InfoRow prose up to 2000 characters.

The renderer owns Hermes surfaces, type, palette, outlines and motion; do not supply colors or fake them with Markdown. DataTable offers local Records / Compare columns modes and preserves every supplied cell. DraftReview separates recipient, subject and full message, always marked not sent. CitationCard keeps the source, page/location, excerpt and finding distinct.

CitationCard, DataTable and DraftReview optionally accept `actionChild`, referencing an ordinary Button or a Column of Buttons. Only tapping that explicit action starts a normal Hermes turn; use a descriptive event name and context identifying the source/row/draft and requested operation. Local selection, expansion, table modes and sliders are not submitted and do not automatically become event context. If the next turn needs a chosen value, use the existing ChoicePicker/form binding or put a separate explicit Button on each fixed option. A review/edit request is not consent to send an email. Read `references/review-response-demo.md` for a complete synthetic conversational example.
### Follow-up requests from the review widgets

An explicit chat Button sends one ordinary Hermes request prefixed `[A2UI_INTERACTION]` through the originating conversation/profile. Read its event name, source component, surface ID and context together with the original surface; respond to the requested operation using that evidence.

- `document.explain_citation`: preserve the correct document/source, page or location, and exact supplied excerpt. Keep interpretation separate from the quotation; do not invent a source or retrieve a different document silently.
- `table.compare_options`: compare the supplied rows, units and notes, and compute differences accurately. Records / Compare columns, horizontal scrolling and row expansion are local presentation controls; only an explicit chat Button asks for a comparison reply.
- `draft.request_edit`: identify the draft from context and the original surface; preserve recipient and subject unless the request changes them. Return the requested revision as a complete unsent DraftReview with a new surface ID. An edit button never sends the draft.

The other new widgets use the same distinction: browsing dates, branches, scenarios, maps, before/after views, journeys or evidence is local. Place separate ordinary Buttons beside them when a conversational follow-up is useful; do not invent `actionChild` on components whose schema lacks it. Use form binding or fixed-option Buttons for values that must be submitted. No chat action is sent from a busy or read-only surface.

`a2ui_present` validates the payload and returns exact errors. Correct every error and call it again. Do not claim a view was drawn unless the tool returned `media`.

## Choose the presentation before writing

This is the principal presentation rule. Before drafting, classify the answer as `plain`, `status`, `metrics`, `comparison`, `timeline`, `checklist`, `files`, `decision`, `plan`, or `mixed`.

- `plain` → normal Markdown. “Did the email send?” is answered “Yes. It was sent at 10:42.”, not a dashboard. “What is 2 + 2?” is plain text.
- Every other category → prefer one compact A2UI surface whenever native structure makes the answer easier to scan.
- A visual answer has at most one short sentence outside the surface. When the surface fully answers the question, send only the surface.
- Never repeat the surface in prose. Bad: “Three services are healthy and one has an issue.” + surface + “As you can see, three services are healthy…”. Good: “Storage is the only item that needs attention.” + surface.

| Information shape | Preferred representation |
|---|---|
| Service or system states | InfoRow with `state`, or StatusBadge |
| 2–4 important numbers | MetricTile (weighted Row when values are short) |
| Historical numeric samples | MiniChart |
| Alternatives with several dimensions | ComparisonCard × 2+ in a Column |
| Chronological stages, a plan, a rollout | StepRail |
| Real counted progress (412 of 600 migrated) | ProgressMeter |
| What just happened, in order (observed events) | ActivityFeed |
| A calendar event, appointment, reminder, or timed agent | ScheduleTile |
| An email, Teams, or AgentMail message to surface | MessagePreview |
| One short command, SQL, JSON, or config value | CommandBlock |
| A task or action item and its status | TaskTile |
| A few facts about one object (model, profile, uptime) | KeyValueGrid |
| Checklist the user marks | CheckBox |
| Ownership or workstreams | BotBadge + InfoRow |
| Files produced or referenced | ArtifactTile |
| A decision the user must make | ActionCallout with Buttons |
| The single next action | ActionCallout |
| 3+ related structured items | InfoRows in a Column |
| Long secondary detail or evidence | ExpandableSection |
| Mixed structured answer | A compact composition of the above |

### Markdown tables

Avoid Markdown tables in chat whenever the same information fits native rows, cards, metrics, or a comparison surface. Tables such as `Owner | Status`, `Service | Health | Detail`, `Task | Assignee | State`, or `Option | Price | Difference` do not fit a ~300 px column; use InfoRows, stacked comparison cards, or a short metric row for small summaries. For real multi-row tabular data, use DataTable with its local Records / Compare columns views and horizontal scrolling. Use a Markdown table only when explicitly requested or the native catalog is unavailable; keep it narrow.

### Avoid visual spam

One surface per answer is the default. Do not wrap every sentence in a Card or produce SYSTEM / STATUS / METRICS / CHART / BUTTON for every reply. Use hierarchy inside one surface: `Card → Column → title, summary, rows, expandable detail, action`.

### Re-presenting a saved result

When the user asks to reformat or re-present a previously saved result, treat it as a presentation-only transformation, not a new investigation. Read only the named saved artifact when requested; preserve its source, timestamp, verification scope, and uncertainty, and do not imply its status is current unless freshly checked. For a reviewable initiative result, put the complete prepared content, source and unresolved points in one compact surface; make external drafts visibly NOT SENT and distinguish a proposed next step from a scheduled or completed action. Use only local/non-mutating review controls unless a later turn separately authorizes action. Avoid duplicating the surface in prose. Deliver the exact saved artifact through the active client's file mechanism: use `MEDIA:` only where the client intercepts it; in a text-only CLI, provide its absolute path instead of emitting a literal `MEDIA:` line. Do not rescan sources, contact anyone, create tasks, or redo the underlying work unless separately requested. Run the A2UI checker on the final view before responding.


## When to use

Load this skill when the user says things like:

- "show me my schedule as a checklist"
- "build a picker so I can choose"
- "make this a status card"
- "compare these two options"

## Examples: when A2UI earns its keep

**Example 1: comparing two quotes.**
Ask: "Compare the Maurice Lacroix quote vs the Omega quote."
Before: a long paragraph listing both prices, then "which do you prefer?" at the end.
After: a comparison card with one `MetricTile` per quote (value + CAD unit + source), a short caption stating the basis, and one `Button` per option with its own semantic event (`quote.pick_ml`, `quote.pick_omega`). The tap opens a follow-up turn; it does not place an order.

**Example 2: an actionable checklist.**
Ask: "Put my Saturday errands in order and let me check them off."
Before: a Markdown checklist the user cannot interact with.
After: a `Column` of `CheckBox` items plus one confirm `Button` whose event carries the list ID. Checking boxes and tapping starts a normal next turn that answers with progress.

**Example 3: live status with drill-down.**
Ask: "Is my gateway healthy?"
Before: a Markdown summary of service states plus "say 'details' for more".
After: one `StatusBadge` per service with its own details `Button` (`service.hermes_details`), one short intro sentence, and no prose that repeats the card. Unknown states show `state: "unknown"` with "Not checked" detail.

## Choose the right output

- Use Markdown for ordinary explanations and short answers.
- Use Mermaid for architecture, sequence, and dependency diagrams.
- Use A2UI for a scannable native view or meaningful interaction: status, comparison, choices, forms, checklists, lists, grouped details, and simple trends. The subject can be any domain, not just services.
- Use MultiSeriesChart for bounded, aligned observed series. Use a chart image when detailed axes or a more complex visualization require it.
- Use an authenticated `MEDIA:` artifact for an actual generated image, screenshot, or report. Do not put image URLs in A2UI.
- Combine formats only when each adds useful information; for example, one sentence, a Mermaid diagram, and a small action surface.

## Choose a composition by intent

Infer the user's task and select the smallest useful composition. These are starting points, not templates to copy verbatim. Change component choice, order, wording, and actions to fit the data and the question. A terse request does not require the user to name A2UI or a component.

| Intent | Useful composition |
|---|---|
| Overview or monitoring | StatusBadge for observed states; MetricTile for measured numbers; a focused details action when useful |
| Decide among options | Distinct Buttons for a few immediate choices; ChoicePicker for a single or multi-selection that needs confirmation |
| Enter or update information | Only the needed TextField, CheckBox, Slider, ChoicePicker, or DateTimeInput controls, then one clear submit action |
| Review a checklist or sequence | List or Column of short items; CheckBox only if the user must mark items; no fake completion state |
| Compare items | Equal-weight Row for short MetricTiles, or stacked Cards/List for longer descriptions; state the basis and units |
| Explore grouped details | Tabs when groups are distinct and each has useful content; otherwise a Column or specific details action |
| See change over time | MiniChart for one series of 2-60 observed samples; MultiSeriesChart for aligned observed series; MetricTile for one value; Chart.js for complex visualization |
| Get a diagram, image, or report | Mermaid, `MEDIA:`, or a document artifact respectively; A2UI may complement but should not replace the actual artifact |

Exact signatures for 1.0, with the required and optional arguments of every component, are in `references/express-signatures.md` (generated from the catalog the plugin checks against). `TextField` requires `value`: write `TextField("Name", "")`, or bind it as in `TextField("Name", $/form/name)`, never `TextField("Name")`. `references/component-guide.md` is the v0.9 guide, for v0.9 JSON only: it lists `TextField.value` as optional and advertises `validationRegexp`, and neither holds in 1.0.

## Visual-first response shape

When A2UI is the main answer:

1. Start with at most one short sentence. Let the native surface carry the details; surrounding prose covers only what the card cannot.
2. Put the user's requested answer first, then a few scannable facts or controls. Use a short title, concise labels, clear grouping, and actions only where they help.
3. Put long supporting detail behind a specific "Details" action or in brief surrounding prose. Put warnings, failures, limitations, and uncertainties where the user can see them, never buried behind a Details action.
4. Include when a live value was checked and what evidence supports it. Use `unknown` or "Not checked" when there is no evidence. Report only what you actually checked; one reachable endpoint proves one endpoint, not the whole service.
5. Show only measured, stated, or observed values. Mark unknowns as unknown; do not fabricate history, trend points, units, timestamps, thresholds, or service state.

## Writing a view in Express

Pass the view in `express`, without `<a2ui>` tags or a code fence. The plugin compiles it to A2UI 1.0 and checks it; errors come back for you to correct.

- Start with `surface("unique-id")`, a new id for each response. Then one `name = Component(...)` per line. The entry point is the variable `root`.
- Names use letters, digits and underscores, never hyphens, and are unique in the view; each is a component ID.
- Children are names: `Column([title, row])`, `Card(content)`, `Button(label, _, Event("item.open", {id: "42"}))`. This holds for every slot that holds a component: `actionChild`, `child`, tab `child`, Modal `trigger` and `content`.
- Build a tree: each visible node has one parent. A Button's label Text is its `child`; do not also put that label in the surrounding Column/List. The same applies to Card children, tab content, and modal content.
- Arguments are positional, in the order of `references/express-signatures.md` (load it when unsure). `_` skips an optional one; `name=value` also works, so use it when the order is uncertain and for `weight=1`. Strings take double quotes; lists are `[a, b]`; maps are `{key: value}`.
- Data: `$/form/name = ""` sets a value, and `$/form/name` as an argument binds to it.
- Repeated items are explicit children: one component per item, listed in the `List`, `Column` or `Row`. Never use `_template(...)` or a `children` object with `componentId` and `path`: it checks as valid, but the chat does not draw it, so the list shows empty.

```
surface("todo_list")
root = Card(items)
items = List([row_1, row_2, row_3])
row_1 = Text("Draft the brief")
row_2 = Text("Review with Sam")
row_3 = Text("Send the invoice")
```

- Not supported: function calls such as `?required` or `formatDate(...)`, `checks`, `userMessage=` on `Event`, and `deleteSurface`.

## JSON fallback

For `payload`, write A2UI 1.0 JSONL (`"version": "1.0"`): usually one `createSurface` holding `surfaceId`, `components` and `dataModel`, without `catalogId` or `theme`. Bind with `{"@path": "/form/name"}`; ids are letters, digits and underscores; `updateDataModel` needs a `value`; tabs are `{title, child}`. The JSON files in `references/` show the older v0.9 form, still accepted; use them for v0.9 payloads only. The same rule on repeated items holds in JSON: list the item ids in `children`, never a `{componentId, path}` template.

## Components available in Hermes

Built-in components include `Card`, `Column`, `Row`, `Text`, `Icon`, `Divider`, `List`, `Tabs`, `Button`, `ChoicePicker`, `CheckBox`, `TextField`, `Slider`, and `DateTimeInput`.

For `Tabs`, write entries as `{title: "Overview", child: overview}`, where `overview` is the name of the content component. `TextField` requires `value`, takes a `placeholder` and has no validation pattern; `Slider` takes `steps`.

Hermes also provides these data-only visual components:

- `StatusBadge`: required `label` and `state` (`ok`, `warning`, `error`, `unknown`); optional short `detail`. Always use a state word as well as its icon. Unknown must be neutral.
- `MetricTile`: required `label` and observed numeric `value`; optional `unit`, `min`, `max`, `state`, ISO 8601 `asOf`, and short `source`. Give units for percentages, sizes, latency, and counts. Only provide `min` and `max` when the range is meaningful.
- `MiniChart`: required `label`, `kind` (`line` or `bar`), and ordered `points`, each with a short `label` and finite numeric `value`; optional `unit`, ISO 8601 `asOf`, and `source`. Limit to 60 real observations. Use it only with at least two observations. For one observation, use a `MetricTile`; for no data, say so without drawing a chart.

Structure components (data-only; they replace most small tables and bullet lists):

- `InfoRow`: one labelled fact. Required `title`; optional `detail`, `meta`, `icon`, `state` (`ok`, `warning`, `error`, `unknown`), `compact`. Use a Column of InfoRows instead of a table.
- `StepRail`: ordered stages. Required `steps` (1–10), each `{label, state, detail?, meta?}` with state `done`, `current`, `upcoming`, `warning`, or `error`. Mark `done` only for stages that are actually complete.
- `ActionCallout`: the one thing that needs attention or the next step. Required `title`; optional `eyebrow`, `detail`, `tone` (`neutral`, `attention`, `success`, `error`), `icon`, `actionChild` (a Button, or a Row of 2–3 Buttons for a decision).
- `ArtifactTile`: a file by name. Required `name` and `kind` (`document`, `image`, `spreadsheet`, `audio`, `video`, `file`); optional `sizeLabel`, `detail`, `actionChild`. It never opens or fetches the file; return the actual file with `MEDIA:` and use an optional Button to ask about it.
- `BotBadge`: which agent owns a workstream. Required `label` and `identity` (`neutral`, `kai`, `local`, `autopilot`, `fast`, `strong`); optional `detail`. Use the identity of the bot that actually did the work.
- `ExpandableSection`: long supporting detail kept one tap away. Required `title` and `child`; optional `subtitle`, `count`, `initiallyExpanded`. Opening it is local and sends nothing to Hermes. Never hide a warning, failure, or limitation inside it.

Personal and work components (data-only; Hermes retrieves the data first, these only show it):

- `ProgressMeter`: real counted progress. Required `label`, `current` (≥ 0), `total` (> 0); optional `unit`, `detail`, `state`, `segmented`. Hermes derives the percent from the two numbers and shows over-total truthfully. Never use it for "almost done".
- `ActivityFeed`: events that actually happened, in order. Required `items` (1–20), each `{title, detail?, time?, icon?, state?}`. Only events Hermes observed; omit `time` when unknown; never invent timestamps.
- `ScheduleTile`: one timed item. Required `title`, `start`; optional `end`, `date`, `location`, `detail`, `owner`, `state`, `icon`. Works for calendar events, appointments, reminders, and scheduled agents.
- `MessagePreview`: one message to surface. Required `sender`, `preview` (≤ 240, an excerpt, never the full message); optional `title` (subject), `timestamp`, `channel` (`email`, `teams`, `agentmail`, `message`, `unknown`), `unread`, `importance` (`normal`, `important`).
- `CommandBlock`: one short command or snippet to review. Required `content`; optional `label`, `language` (`shell`, `sql`, `json`, `yaml`, `text`), `copyable` (default true). It is never executed; Copy is local and sends nothing. Long programs and multi-file code stay in Markdown code blocks.
- `TaskTile`: a task as it stands. Required `title`, `status` (`todo`, `in_progress`, `blocked`, `done`, `unknown`); optional `assignee`, `due`, `priority` (`low`, `normal`, `high`, `urgent`), `detail`, `countLabel`.
- `KeyValueGrid`: up to 8 facts about one object. Required `items` (1–8) of `{label, value}`; optional `title`, `compact`. Hermes chooses columns or stacking from the width; do not.
- `ComparisonCard`: the facts of one option. Required `title`, `facts` (1–8) of `{label, value, state?}`; optional `subtitle`, `badge`, `detail`. Put two or more in a Column. It states facts only: no winner, rank, score, or "recommended".

Telling similar components apart:

- `86% disk used` → MetricTile. `412 / 600 products migrated` → ProgressMeter.
- `Discovery → Build → UAT → Launch` → StepRail. `11:42 searched · 11:43 fetched · 11:44 generated` → ActivityFeed.
- A list of services and their states → InfoRow. Metadata about one object → KeyValueGrid.
- A task exists → TaskTile. The user must do something now → ActionCallout.
- One short command → CommandBlock. Large code, program source, multi-file code → Markdown.
- Mail and chat summaries, recent important messages → MessagePreview (sender, subject, a short excerpt, time), then detail in prose or an ExpandableSection if needed.
- Compare only when the user needs to inspect several options across several dimensions. "A costs $12 and B costs $20" is a sentence, not two cards.

Compositions that work: homelab (MetricTile, MetricTile, ProgressMeter, ActivityFeed, ActionCallout); morning inbox (MessagePreview × 3, ActionCallout); day plan (ScheduleTile × 2, TaskTile); autonomous run (BotBadge, ProgressMeter, ActivityFeed, ExpandableSection); project status (ProgressMeter, StepRail, TaskTile, ActionCallout); server detail (StatusBadge, KeyValueGrid, MiniChart, ActivityFeed); technical instruction (InfoRow, CommandBlock, ActionCallout).

Exact signatures for every component, including forms (`TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput`) and `Tabs`/`Modal`, are in `references/express-signatures.md`; the props of the Hermes components above are also in `references/component-guide.md`, which is the v0.9 guide and not the source for the basic components in 1.0. Worked surfaces are in `references/patterns.md` (v0.9 JSON; take the structure, write it in Express).

Use `Image` for pictures that belong inside the view. `url` is an https link or the full path of a local PNG, JPEG, GIF or WebP file (5 MB each, 10 MB per view), which is copied into the view. Give `description` so it reads well if the image cannot load. `BeforeAfterViewer` and `RoomMap` take the same sources in their media fields.

## Phone layout

- Design for about 300 logical pixels of content width inside the phone chat column. Keep all text and buttons within that width, including at larger text scale.
- Prefer a `Column` for mixed content and actions. Use a `Row` only when side-by-side reading helps; use `List` for repeated items and `Tabs` for genuinely distinct groups.
- Never put `ProgressMeter`, `ActivityFeed`, `ScheduleTile`, `MessagePreview`, `CommandBlock`, `TaskTile`, `KeyValueGrid`, or `ComparisonCard` directly in a `Row`, weighted or not: they are full-width objects. Stack them in a `Column`.
- Every direct `MetricTile`, `MiniChart`, `StatusBadge`, `InfoRow`, `StepRail`, `ActionCallout`, `ArtifactTile`, `BotBadge`, `ExpandableSection`, `Slider`, `TextField`, `ChoicePicker`, `DateTimeInput`, `Card`, `Column`, `Row`, `List`, or `Tabs` child in a `Row` must have a positive integer `weight`. The structure components are designed to be stacked in a Column; put them in a Row only rarely. This applies to overview dashboards as well as comparison cards. For two short comparable metrics, use `weight: 1` on both tiles. Hermes's read-time repair protects saved older messages, but author new output correctly.
- Reach for a `Column` when a value or label is long, when a chart or control needs room, or when a weighted interactive row would be cramped or make reading order unclear. Compactness alone is not a reason for a `Row`.
- Keep text-plus-button rows short. If a short row is essential, give the wrapping `Text` child an integer `weight` of 1 and keep the button label short. Hermes repairs the known unweighted Text+Button row by stacking it, but generated output should already be correct.
- Keep multiple actions vertically stacked, except a two- or three-way decision inside an ActionCallout, which may be a Row of Buttons with `weight: 1` each. Give each a semantic event name identifying intent and target, such as `item.inspect` with a small `context` containing the item ID. Give every choice its own distinct, descriptive event name; one ambiguous action never serves two targets.
- Keep titles and labels short. Avoid broad tables, paragraphs inside cards, nested card stacks, and long button labels.
- Use the icons `check`, `warning`, `error`, and `info` with the state word. `help` exists only on the basic `Icon` component; the `icon` property of `InfoRow`, `ActionCallout` and `ScheduleTile` does not accept it. Color is never the only status signal.

## Interaction and truth defaults

- There are two kinds of interaction. Conversational actions (Button, ChoicePicker or form submission) send `[A2UI_INTERACTION]` as a turn in the same Hermes conversation. Presentation-only actions (opening an ExpandableSection, switching Tabs) happen only in the view and never reach Hermes, so never rely on them to trigger work.
- After an interaction turn, answer in plain text unless a new surface genuinely helps; if you send one, it must be a complete, valid surface with a new `surfaceId` . Never send a partial or "updated" fragment of an older surface.
- A tap sends a follow-up turn in the same chat. It is not a direct launch or mutation. Read-only requests must remain read-only, including any checks Hermes performs. For a requested change, show the proposed values and obtain explicit confirmation before an external mutation; a button tap is a request for the next turn, not a completed change.
- One self-contained surface per reply is the default. Use a unique `surfaceId`, one `root`, and return an updated surface in the next answer rather than relying on old chat cards updating.
- Give actions semantic names and the minimum context needed to identify the selected item. After an action, answer the new question and choose the appropriate next composition; match the composition to the follow-up question instead of forcing it back into a status card.
- For live state, show what was checked, when, and at what scope. For user-provided or illustrative data, say so; do not pretend it was freshly measured. Unknown stays unknown.
- Around a surface, use at most one short introductory sentence unless essential context or caveats require more. Let the surface carry the details.

## Example: visual service overview

```
surface("service-overview-01")
root = Card(content)
content = Column([title, summary, hermes, hermes_action, immich, immich_action, nvr, nvr_action])
title = Text("System status", "h4")
summary = Text("2 online · 1 needs attention", "caption")
hermes = StatusBadge("Hermes", "ok", "Gateway connected · checked 18:04 UTC")
hermes_action = Button(hermes_action_label, _, Event("service.hermes_details"))
hermes_action_label = Text("Hermes details")
immich = StatusBadge("Immich", "ok", "API responded · checked 18:04 UTC")
immich_action = Button(immich_action_label, _, Event("service.immich_details"))
immich_action_label = Text("Immich details")
nvr = StatusBadge("NVR", "warning", "Storage 86% · checked 18:04 UTC")
nvr_action = Button(nvr_action_label, _, Event("service.nvr_storage_details"))
nvr_action_label = Text("Storage details")
```

Only use values supported by checks performed for that answer. The values above illustrate layout; they are not default service facts.

## Example: choice and action panel

```
surface("connection-choice-01")
root = Card(content)
content = Column([title, question, wifi, ethernet])
title = Text("Choose a connection", "h4")
question = Text("Which connection should I inspect?")
wifi = Button(wifi_label, _, Event("network.inspect_wifi"))
wifi_label = Text("Wi-Fi")
ethernet = Button(ethernet_label, _, Event("network.inspect_ethernet"))
ethernet_label = Text("Ethernet")
```

Use one distinct, descriptive event per choice. A button asks Hermes to continue the conversation; it does not imply that Hermes launches or changes the selected service.

## Example: metric, observed trend, and drill-down

```
surface("storage-trend-01")
root = Card(content)
content = Column([title, metric, trend, details])
title = Text("Storage", "h4")
metric = MetricTile("Used", 86, "%", 0, 100, "warning", "2026-09-24T18:04:00Z", "Filesystem check")
trend = MiniChart("Daily use", "line", [{label: "Sep 22", value: 80}, {label: "Sep 23", value: 83}, {label: "Sep 24", value: 86}], "%", "2026-09-24T18:04:00Z", "Daily filesystem samples")
details = Button(details_label, _, Event("storage.filesystem_details"))
details_label = Text("Filesystem details")
```

Use real ordered samples only. The example's values are illustrative and must not be presented as current measurements without performing the check.

## Before sending

- The presentation was chosen first: `plain` answers are plain text, everything else is one compact surface.
- At most one short sentence surrounds the surface, and it does not duplicate it.
- No Markdown table where InfoRows, cards, or metrics would fit.
- It starts with `surface("...")`; every name is letters, digits and underscores and is defined once; `root` exists; strings use double quotes.
- Every name a component uses is defined.
- The surface is the main presentation and surrounding prose does not duplicate it.
- Live state has truthful evidence and freshness; unknown data is marked unknown.
- Every row fits a phone. Prefer stacked service/action layouts.
- Charts use two or more actual samples; absent and single-sample data do not become an invented trend.
- No A2UI component contains a remote asset URL or executable code.

## Older replies

Once a newer user turn exists, buttons on an older reply are disabled in the client. Put the actions the user should take in the latest reply; local disclosures and tabs still work on older replies.

<!-- hermes-a2ui-form-binding-v1 -->
## Forms that send values back (added October 18, 2026)

A2UI inputs (TextField, CheckBox, ChoicePicker, Slider, DateTimeInput) only edit local state. A Button sends nothing from them unless the fields are bound; an unbound form arrives as an empty `context`. Whenever a Button must send what the person typed or chose:

1. Declare the data first, in the same view: `$/form = {name: "", servings: 2, diet: ["none"], dessert: false}`
2. Bind every input to it: `TextField("Name", $/form/name)`. A ChoicePicker's `value` is `$/form/diet` and a CheckBox's is `$/form/dessert`.
3. Put the same paths in the Button's event context: `Button(go_label, _, Event("meal.submit", {name: $/form/name, servings: $/form/servings}))`.

Before replying, read each Button's context and confirm every field the person is asked to fill appears in it. If the person only needs to browse, skip binding and say nothing about submitting.
