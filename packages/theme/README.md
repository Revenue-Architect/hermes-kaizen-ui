# Kaizen Theme

A Woday-inspired theme for Hermes Desktop and the Webapp: a dark frame and navigation rail, rounded paper/charcoal workspaces, Hanken Grotesk, and restrained Kaizen red. Light and dark modes share the same calm navigation.

## Install

```bash
hermes plugins install Revenue-Architect/hermes-kaizen-ui/packages/theme
hermes plugins enable kaizen-theme
```

Then turn on the Desktop half in Capabilities > Plugins and pick **Kaizen** in Settings > Appearance. The workspace styling runs only while Kaizen is active. Existing users keep the same theme ID and selection.

The navigation lies behind the page. Clicking the top-left sidebar button slides the page aside to uncover it, and only that button (or its Ctrl/Cmd+B shortcut) slides it home. The page stays usable while it is aside: picking a chat, typing, sending or Escape leave the nav open. Keyboard toggles move it instantly, nothing opens it on hover, and phones keep Hermes's drawer with a CHAT rail back. A theme-owned search control runs the native `nav.commandPalette` action and stays clear of native window controls. It is omitted on older clients that do not expose `ctx.runAction`. User prompts remain unpinned, tool activity stays quiet, and chat text scaling stays under the user's control.

## Compatibility and verification

Theme CSS uses Hermes's documented `data-slot` hooks plus current layout-tree attributes. The real session header is restyled rather than copied. The slide owns only the sidebar button's press; it never edits saved layout or local storage, and stands down if the panes are flipped. Layout-hook changes in a future Desktop release may require theme adjustments.

The implementation was exercised in real Chromium with the built theme bundle, source-based DOM fixtures and a native-action adapter, in light/dark at 320, 390, 640, 768, 1024 and 1440px. Those fixtures are not proof of a live client session. Deploy the same built `desktop/plugin.js` to the gateway for Webapp and to the native computer's local desktop-plugin directory; compare hashes after copying. Keep the prior files for rollback.

## Build

```bash
node build.mjs
pytest -q
```

## Credits

Hanken Grotesk is under the SIL Open Font License (`assets/OFL.txt`). The quiet chat styling was measured against DeepSeek Harness's chat (MIT, (c) 2026 DeepSeek).
