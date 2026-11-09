# Hermes Kaizen UI

Three plugins for Hermes Desktop and the Webapp. None of them changes Hermes itself.

| Plugin | What it does | Install |
|---|---|---|
| [`packages/theme`](packages/theme) | The Kaizen theme and its card navigation | `hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/theme` |
| [`packages/a2ui`](packages/a2ui) | Interactive A2UI v0.9 views in chat | `hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/a2ui` |
| [`packages/openui`](packages/openui) | Interactive OpenUI views in chat | `hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/openui` |

Each needs Hermes v0.23.0 or later. After installing, run `hermes plugins enable <name>` and turn on its Desktop half in Capabilities > Plugins.

`packages/shared` holds code compiled into A2UI and OpenUI. Edit it there and run `node scripts/sync-shared.mjs`.
