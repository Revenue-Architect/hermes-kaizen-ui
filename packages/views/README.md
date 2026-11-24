# Kaizen Views

Interactive views in the Hermes Desktop and Webapp chat, in two specs: [A2UI](https://a2ui.org) and [OpenUI](https://github.com/thesysdev/openui), including live OpenUI dashboards. No change to Hermes itself.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/views
hermes plugins enable kaizen-views
```

Nothing else is needed: views work with the data the model already has in the chat. Only the optional live dashboards need an MCP server of your own (see below).

Then turn on the Desktop half in Capabilities > Plugins, and reload the Webapp tab. If Desktop connects to Hermes on another machine, also install the Desktop half there with Capabilities > Plugins > Install from Git.

Each spec is its own toolset, `a2ui` (`a2ui_present`) and `openui` (`openui_present`). Both are on after install; turn either off in `hermes tools` (or Desktop's toolset settings) and the model no longer sees that tool. Its skill stays listed, since Hermes can't yet hide a plugin skill by toolset; to remove both, disable the plugin. Both share one delivery runtime and one pair of hooks.

### Moving from hermes-a2ui or hermes-openui

This plugin replaces both. Uninstall them (`hermes plugins uninstall hermes-a2ui`, `hermes plugins uninstall hermes-openui`), install this one, and move any settings from `plugins.entries.hermes-a2ui` or `plugins.entries.hermes-openui` to `plugins.entries.kaizen-views`. Views saved by the old plugins still open. Live dashboards drawn before the move belong to the old plugin's backend and show a notice to switch profile: ask Hermes to draw them again instead.

| Client | Result |
|---|---|
| Desktop, Webapp | Interactive view |
| Android, CLI, messaging apps | Text |
| Desktop with the plugin off | Readable file |

If a chat that can draw reaches Hermes under another platform name, add it in `config.yaml`: `plugins.entries.kaizen-views.settings.drawing_platforms: [tui]`.

## A2UI

The model calls `a2ui_present` with the view and a plain-text copy. The view is A2UI Express in `express` (short, Python-like; compiled by the official `a2ui-agent-sdk`, pinned in `pyproject.toml`) or JSONL in `payload`. Express is compiled to A2UI 1.0; `payload` may be 1.0 or v0.9, and the version is read from the first message. The tool checks the view against that version's rules and returns exact errors the model can fix. Views saved as v0.9 in older chats keep drawing. If the SDK cannot load, the tool says so and the model sends `payload` instead. Clicking a button sends a normal message in that chat, and the view locks once it's answered.

## OpenUI

The model calls `openui_present` with a program and a plain-text copy. The tool runs a preliminary check, and the browser parses the program. If it can't be drawn, the card shows the source and the reason. Clicking a button sends a normal message in that chat, and the view locks once it's answered.

### Live dashboards

A dashboard is an OpenUI view whose program starts with `root = Dashboard(...)`. Its numbers are read from your MCP tools while it is on screen, so they never pass through the model. It has filters, a refresh button and an optional slow auto-refresh. Dashboards only read.

They are off until you list what they may read, in `config.yaml`:

```yaml
plugins:
  entries:
    kaizen-views:
      mcp_allowlist: [crm]                       # the MCP server
      settings:
        dashboard_sources: [crm.get_pipeline]    # server.tool, for each tool a dashboard may read
```

Only list tools that read. `mcp_allowlist` is Hermes' own grant for the whole server, and `dashboard_sources` narrows it to the tools a dashboard can call. Changes apply without a restart.

- The model learns a tool's shape by calling it once, then writes the wiring.
- A read is cached for 60 seconds.
- A server that fails is left alone for at least 20 seconds, longer if it keeps failing. Hermes shares its failure count with the model's own calls to that server.
- A card only reads from the profile and connection it was made in. Otherwise it asks you to switch back.
- Filters send text, or a list of text for a multi-select. Numbers and true/false arguments are written into the program.

## Limits

- Images can be http or https links, LAN hosts included, or local PNG, JPEG, GIF or WebP files, up to 5 MB each and 10 MB per view. Local files are read where Hermes runs and a copy is stored in the view's file. Dashboards don't show images.
- OpenUI source cards show a plain globe icon: the library's favicon lookup through Google is patched out at build time.
- Code blocks inside an OpenUI view have no syntax colours, to keep the bundle reviewable.
- A view shows when the tool finishes, not while the reply streams.

## Build and test

From the repository root (the npm manifest lives there, so installing the plugin never offers to install build tools):

```bash
npm ci
npm run build
npm test
```

Then in `packages/views`:

```bash
pip install -e .[dev]
pytest -q
```

`src/` holds one Desktop entry (`src/plugin.tsx`) over the two renderers in `src/a2ui` and `src/openui`, which share `src/shared`. Each renderer's tests run as their own vitest project.

`tests/a2ui/test_parity.py` requires the Python and browser A2UI validators to agree. `tests/a2ui/test_express.py` round-trips every fixture through Express (v0.9), and `tests/a2ui/test_v1_0.py` checks every fixture in both versions and asks the SDK's own `validate_payload` to judge each 1.0 view the plugin emits.

`src/a2ui/contracts/v1_0`, `a2ui_core/catalogs/hermes-v0_9.json`, `a2ui_core/catalogs/hermes-v1_0.json`, `skills/a2ui/references/express-signatures.md`, `fixtures/v1_0` and `fixtures/bound/*.jsonl` are generated: run `python scripts/generate_express.py` after changing `src/a2ui/contracts/v0_9` or the SDK pin (it needs the SDK), and `--check` to see whether they are current. `--differences` lists how the 1.0 basic components differ from v0.9. `npm run build` regenerates the OpenUI catalog and skill references.
