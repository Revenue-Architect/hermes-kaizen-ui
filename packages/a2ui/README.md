# Hermes A2UI

Interactive [A2UI](https://a2ui.org) v0.9 views in the Hermes Desktop and Webapp chat. No change to Hermes itself.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/a2ui
hermes plugins enable hermes-a2ui
```

Then turn on the Desktop half in Capabilities > Plugins. If Desktop connects to Hermes on another machine, also install the Desktop half there with Capabilities > Plugins > Install from Git.

## How it works

The model calls `a2ui_present` with the view and a plain-text copy. The tool checks the view and returns exact errors the model can fix. On Desktop and the Webapp, the plugin draws it in the chat. Clicking a button sends a normal message in that chat, and the view locks once it's answered.

| Client | Result |
|---|---|
| Desktop, Webapp | Interactive view |
| Android | Readable file |
| CLI, messaging apps | Text |
| Desktop with the plugin off | Readable file |

## Limits

- Local images inside a view aren't supported yet. Send them as their own `MEDIA:` line.
- A view shows when the tool finishes, not while the reply streams.

## Build and test

```bash
npm ci
npm run build
npx vitest run
pytest -q
```

`tests/test_parity.py` requires the Python and browser validators to agree.
