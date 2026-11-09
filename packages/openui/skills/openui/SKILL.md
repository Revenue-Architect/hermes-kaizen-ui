---
name: openui
description: "Draw interactive OpenUI views in the Hermes Desktop and Webapp chat: dashboards, charts, tables, cards, forms, tabs and galleries. Short answers stay text."
version: 1.1.0
license: MIT
metadata:
  hermes:
    tags: [OpenUI, GenUI, Desktop]
---

# OpenUI

Call `openui_present` with `program` (a complete OpenUI Lang program starting with `root = Stack([...])`, no code fence) and `fallback_text` (the same content as plain text).

- When it returns `media`, write at most one short sentence and put that media line on its own line.
- When it returns `text`, the client can't draw views, so reply with that text.
- When it returns an error, fix the program and call it again.

Read `references/CATALOG.md` for the language and every component before writing a program.

To show a local image, give its full path as the image source: PNG, JPEG, GIF or WebP, up to 5 MB each and 10 MB per view. If the tool says a path is wrong or too large, fix it and call again.

For a live dashboard, start the program with `root = Dashboard([...])` and read `references/DASHBOARDS.md` first. Dashboards can only read the sources the system prompt names. If it names none, draw an ordinary view.

A view shows structure: figures, comparisons, status, choices. Keep paragraphs out of cards, and keep short answers as prose.

A view locks once it has been answered. If a follow-up needs another view, send a new complete one.
