# Hermes A2UI

Interactive [A2UI](https://a2ui.org) views in the Hermes Desktop and Webapp chat. The model writes a view in A2UI Express (or v0.9 JSON), and the plugin draws it. No change to Hermes itself.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/a2ui
hermes plugins enable hermes-a2ui
```

Then turn on the Desktop half in Capabilities > Plugins. If Desktop connects to Hermes on another machine, also install the Desktop half there with Capabilities > Plugins > Install from Git.

## How it works

The model calls `a2ui_present` with the view and a plain-text copy. The view is A2UI Express in `express` (short, Python-like; compiled by the official `a2ui-agent-sdk`, pinned in `pyproject.toml`) or v0.9 JSONL in `payload`. Either way it becomes the same v0.9 messages, and the tool checks them and returns exact errors the model can fix. If the SDK cannot load, the tool says so and the model sends `payload` instead. On Desktop and the Webapp, the plugin draws it in the chat. Clicking a button sends a normal message in that chat, and the view locks once it's answered.

| Client | Result |
|---|---|
| Desktop, Webapp | Interactive view |
| Android, CLI, messaging apps | Text |
| Desktop with the plugin off | Readable file |

If a chat that can draw reaches Hermes under another platform name, add it in `config.yaml`: `plugins.entries.hermes-a2ui.settings.drawing_platforms: [tui]`.

## Limits

- Images can be https links or local PNG, JPEG, GIF or WebP files, up to 5 MB each and 10 MB per view. Local files are read where Hermes runs and a copy is stored in the view's file.
- A view shows when the tool finishes, not while the reply streams.

## Build and test

```bash
npm ci
npm run build
npx vitest run --pool=forks --maxWorkers=1
pip install -e .[dev]
pytest -q
```

`tests/test_parity.py` requires the Python and browser validators to agree. `tests/test_express.py` round-trips every fixture through Express.

`a2ui_core/catalogs/hermes-v0_9.json` and `skills/a2ui/references/express-signatures.md` are generated: run `python scripts/generate_express.py` after changing `src/contracts/v0_9` or the SDK pin, and `--check` to see whether they are current.
