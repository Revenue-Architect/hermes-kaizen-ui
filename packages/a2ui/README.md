# Hermes A2UI

Interactive [A2UI](https://a2ui.org) views in the Hermes Desktop and Webapp chat. The model writes a view in A2UI Express (or A2UI 1.0 or v0.9 JSON), and the plugin draws it. No change to Hermes itself.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/a2ui
hermes plugins enable hermes-a2ui
```

Then turn on the Desktop half in Capabilities > Plugins. If Desktop connects to Hermes on another machine, also install the Desktop half there with Capabilities > Plugins > Install from Git.

## How it works

The model calls `a2ui_present` with the view and a plain-text copy. The view is A2UI Express in `express` (short, Python-like; compiled by the official `a2ui-agent-sdk`, pinned in `pyproject.toml`) or JSONL in `payload`. Express is compiled to A2UI 1.0; `payload` may be 1.0 or v0.9, and the version is read from the first message. The tool checks the view against that version's rules and returns exact errors the model can fix. Views saved as v0.9 in older chats keep drawing: both versions are normalised to one internal shape before the widgets see them. If the SDK cannot load, the tool says so and the model sends `payload` instead. On Desktop and the Webapp, the plugin draws it in the chat. Clicking a button sends a normal message in that chat, and the view locks once it's answered.

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

`tests/test_parity.py` requires the Python and browser validators to agree. `tests/test_express.py` round-trips every fixture through Express (v0.9), and `tests/test_v1_0.py` checks every fixture in both versions and asks the SDK's own `validate_payload` to judge each 1.0 view the plugin emits.

`src/contracts/v1_0`, `a2ui_core/catalogs/hermes-v0_9.json`, `a2ui_core/catalogs/hermes-v1_0.json`, `skills/a2ui/references/express-signatures.md`, `fixtures/v1_0` and `fixtures/bound/*.jsonl` are generated: run `python scripts/generate_express.py` after changing `src/contracts/v0_9` or the SDK pin (it needs the SDK), and `--check` to see whether they are current. `--differences` lists how the 1.0 basic components differ from v0.9.
