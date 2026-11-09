# Hermes OpenUI

Interactive [OpenUI](https://github.com/thesysdev/openui) views in the Hermes Desktop and Webapp chat. No change to Hermes itself.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/openui
hermes plugins enable hermes-openui
```

Then turn on the Desktop half in Capabilities > Plugins. If Desktop connects to Hermes on another machine, also install the Desktop half there with Capabilities > Plugins > Install from Git.

## How it works

The model calls `openui_present` with a program and a plain-text copy. The tool runs a preliminary check, and the browser parses the program. If it can't be drawn, the card shows the source and the reason. Clicking a button sends a normal message in that chat, and the view locks once it's answered.

## Limits

- Local images inside a view aren't supported yet. Send them as their own `MEDIA:` line.
- Code blocks inside a view have no syntax colours, to keep the bundle reviewable.
- A view shows when the tool finishes, not while the reply streams.

## Build and test

```bash
npm ci
npm run build
npx vitest run
pytest -q
```
