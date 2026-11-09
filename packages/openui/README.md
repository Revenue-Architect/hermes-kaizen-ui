# Hermes OpenUI

Interactive [OpenUI](https://github.com/thesysdev/openui) views and live dashboards in the Hermes Desktop and Webapp chat. No change to Hermes itself.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/openui
hermes plugins enable hermes-openui
```

Then turn on the Desktop half in Capabilities > Plugins. If Desktop connects to Hermes on another machine, also install the Desktop half there with Capabilities > Plugins > Install from Git.

## How it works

The model calls `openui_present` with a program and a plain-text copy. The tool runs a preliminary check, and the browser parses the program. If it can't be drawn, the card shows the source and the reason. Clicking a button sends a normal message in that chat, and the view locks once it's answered.

## Live dashboards

A dashboard is a view whose program starts with `root = Dashboard(...)`. Its numbers are read from your MCP tools while it is on screen, so they never pass through the model. It has filters, a refresh button and an optional slow auto-refresh. Dashboards only read.

They are off until you list what they may read, in `config.yaml`:

```yaml
plugins:
  entries:
    hermes-openui:
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

- Images can be https links or local PNG, JPEG, GIF or WebP files, up to 5 MB each and 10 MB per view. Local files are read where Hermes runs and a copy is stored in the view's file. Dashboards don't show images.
- Code blocks inside a view have no syntax colours, to keep the bundle reviewable.
- A view shows when the tool finishes, not while the reply streams.

## Build and test

```bash
npm ci
npm run build
npx vitest run
pytest -q
```
