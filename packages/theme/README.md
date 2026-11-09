# Kaizen Theme

A theme for Hermes Desktop and the Webapp: neutral surfaces, Hanken Grotesk, signal red, light and dark. It includes a card navigation where the page steps aside as a rounded card.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/theme
hermes plugins enable kaizen-theme
```

Then turn on the Desktop half in Capabilities > Plugins and pick **Kaizen** in Settings > Appearance. The card navigation runs only while Kaizen is the active theme.

## What can break

The card navigation reads Desktop's page structure and presses its sidebar control. No official Hermes interface covers this, so a Desktop update can break it, and it can't be listed in the Hermes plugin catalog. Tested on Hermes v0.23.0.

## Build

```bash
node build.mjs
pytest -q
```

## Credits

Hanken Grotesk is under the SIL Open Font License (`assets/OFL.txt`). The quiet chat styling was measured against DeepSeek Harness's chat (MIT, (c) 2026 DeepSeek).
