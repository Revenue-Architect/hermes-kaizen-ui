---
name: openui
description: "Draw interactive OpenUI views in the Hermes Desktop and Webapp chat: dashboards, charts, tables, cards, forms, tabs and galleries. Short answers stay text."
version: 1.0.0
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

A view shows structure: figures, comparisons, status, choices. Keep paragraphs out of cards, and keep short answers as prose.

A view locks once it has been answered. If a follow-up needs another view, send a new complete one.
