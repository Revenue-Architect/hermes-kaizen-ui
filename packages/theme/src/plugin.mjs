import { THEMES_AREA } from '@hermes/plugin-sdk';

// KaizenOS's console palette, adapted to Desktop's existing theme roles.
// CSS and an OFL-licensed variable font are embedded by build.mjs.
const themeCSS = /* EMBED_CSS */ '';

export const kaizenTheme = {
  name: 'kaizen',
  label: 'Kaizen',
  description: 'Woday-inspired calm workspace: dark navigation, paper and charcoal canvases, native Hermes workflows.',
  colors: {
    "background": "#fbfbf9",
    "foreground": "#252622",
    "card": "#fbfbf9",
    "cardForeground": "#252622",
    "muted": "#f1f1ee",
    "mutedForeground": "#66695f",
    "popover": "#fbfbf9",
    "popoverForeground": "#252622",
    "primary": "#ce4436",
    "primaryForeground": "#ffffff",
    "secondary": "#f1f1ee",
    "secondaryForeground": "#252622",
    "accent": "#f8e9e5",
    "accentForeground": "#b1372b",
    "border": "#e7e7e2",
    "input": "#e7e7e2",
    "ring": "#b1372b",
    "midground": "#252622",
    "midgroundForeground": "#fbfbf9",
    "composerRing": "#b1372b",
    "destructive": "#b4231b",
    "destructiveForeground": "#ffffff",
    "sidebarBackground": "#101111",
    "sidebarBorder": "#2c2e2b",
    "userBubble": "#efefec",
    "userBubbleBorder": "#efefec"
  },
  darkColors: {
    "background": "#1b1d1b",
    "foreground": "#e7eae1",
    "card": "#1b1d1b",
    "cardForeground": "#e7eae1",
    "muted": "#272a26",
    "mutedForeground": "#a1a698",
    "popover": "#1b1d1b",
    "popoverForeground": "#e7eae1",
    "primary": "#d75143",
    "primaryForeground": "#ffffff",
    "secondary": "#272a26",
    "secondaryForeground": "#e7eae1",
    "accent": "#3b2925",
    "accentForeground": "#f08677",
    "border": "#343830",
    "input": "#343830",
    "ring": "#f08677",
    "midground": "#e7eae1",
    "midgroundForeground": "#1b1d1b",
    "composerRing": "#f08677",
    "destructive": "#f19588",
    "destructiveForeground": "#1b1d1b",
    "sidebarBackground": "#101111",
    "sidebarBorder": "#2c2e2b",
    "userBubble": "#2a2d28",
    "userBubbleBorder": "#2a2d28"
  },
  typography: {
    fontSans: '"Kaizen Hanken", "Hanken Grotesk", "Segoe UI", sans-serif',
    fontMono: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    baseSize: '16px', lineHeight: '1.5', letterSpacing: '-0.01em'
  },
  customCSS: themeCSS + "\n/* Kaizen chat, quiet: a calmer chat for the Kaizen theme.\n   Measured against DeepSeek Harness's chat (MIT, (c) 2026 DeepSeek): a slight user\n   bubble, tool calls as plain grey lines, a borderless composer card with a\n   soft shadow. Everything outside the chat stays the Kaizen theme.\n\n   Hooks are Hermes's documented data-slot attributes. The three class hooks\n   (.composer-human-message, .uppercase, the diff colours) are not a contract;\n   if an upgrade renames them, that one rule stops applying and nothing else\n   breaks. */\n\n:root[data-hermes-theme=\"kaizen\"] {\n  --kq-rule: var(--kaizen-line);\n  --kq-elev: 0 0 0 1px rgb(0 0 0 / 0.06), 0 4px 16px rgb(0 0 0 / 0.04), 0 0 24px rgb(0 0 0 / 0.03);\n  --kq-elev-focus: 0 0 0 1px rgb(0 0 0 / 0.14), 0 4px 16px rgb(0 0 0 / 0.05), 0 0 24px rgb(0 0 0 / 0.03);\n  --ui-chat-bubble-background: transparent;\n}\n\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] {\n  --kq-elev: 0 0 0 1px rgb(255 255 255 / 0.07);\n  --kq-elev-focus: 0 0 0 1px rgb(255 255 255 / 0.16);\n}\n\n/* ---- Reading column ----------------------------------------------------\n   Hermes sets the chat column (transcript, composer, intro) to 100% of the\n   window, so lines ran ~200 characters. 46rem keeps prose centred at a\n   readable length; narrow windows still fill. */\n:root[data-hermes-theme=\"kaizen\"]:not([data-onboarding-demo]) {\n  --composer-width: 46rem;\n}\n\n/* ---- Your messages: a slight bubble ------------------------------------\n   Kamran asked for the bubble back (2026-11-12), kept quiet: a faint opaque\n   fill and a soft radius, no border, no shadow, no left rule. Opaque so the\n   sticky prompt stays readable over the transcript scrolling behind it. */\n:root[data-hermes-theme=\"kaizen\"] {\n  --kq-bubble: #f4f4f6;\n  --kq-bubble-hover: #eeeef1;\n  --kq-bubble-active: #e8e8ec;\n}\n\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] {\n  --kq-bubble: #18181b;\n  --kq-bubble-hover: #1e1e21;\n  --kq-bubble-active: #242428;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message {\n  background: var(--kq-bubble) !important;\n  border-color: transparent !important;\n  border-radius: 14px !important;\n  box-shadow: none !important;\n  -webkit-backdrop-filter: none !important;\n  backdrop-filter: none !important;\n  color: var(--ui-text-primary) !important;\n  transition: background-color 150ms ease;\n}\n\n/* The message is a button (click to edit): the fill carries its states. */\n@media (hover: hover) and (pointer: fine) {\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message:hover {\n    background: var(--kq-bubble-hover) !important;\n  }\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message:active {\n  background: var(--kq-bubble-active) !important;\n  transition: none;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message:focus-visible {\n  outline: 2px solid var(--dt-ring);\n  outline-offset: 4px;\n}\n\n/* ---- Your messages scroll with the conversation ---------------------\n   Kamran asked for this (2026-11-12): Hermes pins each prompt to the top while\n   its reply scrolls, then clamps it to ~2 lines with a fade. Here a message\n   scrolls away like any chat bubble and shows in full. Theme CSS only, no\n   core change: the sticky position, the clip that hid content behind the\n   pinned bubble, and the clamp are each undone. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] {\n  position: relative !important;\n  top: auto !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-sticky-prompt-clip] {\n  clip-path: none !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] .sticky-human-clamp {\n  max-height: none !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] .sticky-human-clamp[data-clamped=\"true\"] {\n  -webkit-mask-image: none !important;\n  mask-image: none !important;\n}\n\n/* ---- Tool calls: one grey line --------------------------------------------\n   Closed rows were already plain. An open row loses its box and header rule;\n   its detail hangs off a hairline under the row instead. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"][data-tool-open] {\n  border-color: transparent !important;\n  border-radius: 0 !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"][data-tool-open] > :first-child {\n  border-bottom: 0 !important;\n  padding-inline: 0 !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"][data-tool-open] > :first-child + * {\n  margin-left: 0.4375rem;\n  padding: 0.25rem 0 0.375rem 0.875rem !important;\n  border-left: 1px solid var(--kq-rule);\n}\n\n/* Section labels (Search, Output…) in sentence case, not tracked capitals.\n   A hair of positive tracking keeps them legible at this small size. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"] .uppercase {\n  text-transform: none;\n  letter-spacing: 0.01em;\n}\n\n/* +/− line counts in muted greens and reds rather than neon. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"] .text-emerald-600 { color: #4d7c5f; }\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"] .text-rose-600 { color: #a8473f; }\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] [data-slot=\"tool-block\"] .text-emerald-600 { color: #8fb89c; }\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] [data-slot=\"tool-block\"] .text-rose-600 { color: #d99a92; }\n\n/* ---- Composer: a borderless card --------------------------------------\n   No outline, a soft two-layer shadow that firms up on focus. No red ring;\n   red stays on the send button. The fill is left to Hermes's own ladder, so\n   the card still turns translucent while you are scrolled up. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] {\n  border-radius: 20px;\n  --composer-surface-pad-x: 0.75rem;\n  --composer-surface-pad-y: 0.5rem;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] {\n  border-color: transparent !important;\n  box-shadow: var(--kq-elev);\n  transition: box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1);\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"]:focus-within {\n  box-shadow: var(--kq-elev-focus);\n}\n\n/* More contrast asked for: give the card a real edge and the rule more ink. */\n@media (prefers-contrast: more) {\n  :root[data-hermes-theme=\"kaizen\"] {\n    --kq-rule: color-mix(in srgb, var(--ui-text-primary) 45%, transparent);\n    --kq-elev: 0 0 0 1px color-mix(in srgb, var(--ui-text-primary) 45%, transparent);\n    --kq-elev-focus: 0 0 0 1px var(--ui-text-primary);\n  }\n}\n\n/* ---- Grok Bot-style polish (2026-11-12) ---------------------------------\n   Kamran approved five changes after a look at xAI's Grok Bot: show less,\n   let the conversation carry the page. Theme CSS only.\n   1. your messages sit on the right as a sent bubble\n   2. the tool-run summary is a quiet status row with a dot (green while live)\n   3. more air between exchanges, roomier reply text, quieter headings\n   4. timestamps and durations appear on hover\n   5. a rounder composer with the Kaizen red send button */\n\n/* 1. Sent bubble, right-aligned. The box that holds the bubble shrinks to\n   the text and moves right, so the hover actions stay pinned to it. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-bubble-actions\"] [data-context-menu-skip] {\n  width: fit-content !important;\n  max-width: min(82%, 36rem) !important;\n  margin-left: auto !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message {\n  border-radius: 18px 18px 6px 18px !important;\n  padding-left: 0.875rem !important;\n}\n\n/* With a mouse, the time and restore icon float just left of the bubble on\n   hover instead of covering its last words, so the bubble drops the gutter\n   it kept for them. Touch keeps Hermes's layout. */\n@media (hover: hover) and (pointer: fine) {\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message {\n    padding-right: 0.875rem !important;\n  }\n\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-bubble-actions\"] [data-context-menu-skip] > div.absolute.right-2.bottom-2 {\n    right: calc(100% + 0.25rem) !important;\n    bottom: 0.25rem !important;\n    background: transparent !important;\n    padding-left: 0 !important;\n    white-space: nowrap;\n  }\n}\n\n/* 2. Tool runs: one status row led by a small dot. Grey when settled, Kaizen\n   green and softly pulsing while the run is live. Opened, the steps hang off\n   a hairline under the dot. */\n:root[data-hermes-theme=\"kaizen\"] {\n  --kq-live: #2f9e6a;\n  --kq-dot-rest: color-mix(in srgb, var(--ui-text-primary) 28%, transparent);\n}\n\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] {\n  --kq-live: #5cc28f;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-tool-summary] {\n  display: flex;\n  align-items: flex-start;\n  gap: 0.5rem;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-tool-summary]::before {\n  content: \"\";\n  flex: none;\n  width: 6px;\n  height: 6px;\n  border-radius: 50%;\n  margin-top: calc((var(--conversation-line-height, 1.25rem) - 6px) / 2);\n  margin-left: 1px;\n  background: var(--kq-dot-rest);\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-tool-summary] > * {\n  flex: 1 1 auto;\n  min-width: 0;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-tool-summary]:has(.shimmer)::before {\n  background: var(--kq-live);\n  animation: kq-live-dot 1.6s ease-in-out infinite;\n}\n\n/* The pulse stays inside the dot's own box: the tool block clips overflow,\n   so a glow ring around it got cut off at the left edge. */\n@keyframes kq-live-dot {\n  50% { opacity: 0.35; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :root[data-hermes-theme=\"kaizen\"] [data-tool-summary]:has(.shimmer)::before { animation: none; }\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"][data-tool-group] > [data-tool-summary] ~ div {\n  margin-left: 3.5px;\n  padding-left: 0.875rem;\n  border-left: 1px solid var(--kq-rule);\n}\n\n/* 3. Rhythm: a clear gap between exchanges, a tight one inside an exchange,\n   roomier reply text, and headings that mark a section without shouting. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_message-group\"] {\n  padding-bottom: 1.75rem !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] {\n  padding-bottom: 0.75rem !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_assistant-message-content\"] {\n  --dt-line-height: 1.62;\n  --paragraph-gap: 0.8rem;\n  line-height: 1.62;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_assistant-message-content\"] .aui-md :is(h1, h2, h3, h4) {\n  color: inherit;\n  font-weight: 650;\n  letter-spacing: -0.006em;\n  line-height: 1.35;\n  margin-block: 1.4rem 0.3rem;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_assistant-message-content\"] .aui-md h1 { font-size: 1.125em; }\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_assistant-message-content\"] .aui-md h2 { font-size: 1.06em; }\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_assistant-message-content\"] .aui-md :is(h3, h4) { font-size: 1em; }\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_assistant-message-content\"] .aui-md > :first-child,\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_assistant-message-content\"] .aui-md > :first-child > :first-child {\n  margin-top: 0;\n}\n\n/* 4. Meta on demand: timestamps and turn durations wait for the pointer.\n   Space stays reserved, so nothing shifts when they appear. Touch keeps\n   them visible. */\n@media (hover: hover) and (pointer: fine) {\n  :root[data-hermes-theme=\"kaizen\"] :is([data-slot=\"aui_assistant-message-root\"], [data-slot=\"aui_user-message-root\"]) :is([data-slot=\"timeline-timestamp\"], [data-slot=\"aui_turn-duration\"]) {\n    opacity: 0;\n    transition: opacity 140ms ease-out;\n  }\n\n  :root[data-hermes-theme=\"kaizen\"] :is([data-slot=\"aui_assistant-message-root\"], [data-slot=\"aui_user-message-root\"]):is(:hover, :focus-within) :is([data-slot=\"timeline-timestamp\"], [data-slot=\"aui_turn-duration\"]) {\n    opacity: 1;\n  }\n}\n\n/* 5. Composer: a rounder card and the Kaizen red send button. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] {\n  border-radius: 24px !important;\n  --composer-surface-pad-x: 0.875rem;\n  --composer-surface-pad-y: 0.625rem;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] {\n  border-radius: 24px !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] button[type=\"submit\"] {\n  background: var(--kaizen-brand) !important;\n  color: #ffffff !important;\n  transition: background-color 140ms ease, transform 120ms ease;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] button[type=\"submit\"]:hover:not(:disabled) {\n  background: color-mix(in srgb, var(--kaizen-brand) 88%, #000) !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] button[type=\"submit\"]:active:not(:disabled) {\n  transform: scale(0.94);\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] button[type=\"submit\"]:disabled {\n  background: color-mix(in srgb, var(--kaizen-brand) 30%, transparent) !important;\n}\n\n/* Woday-inspired chat finishing layer. Unpinned prompts and tool details\n   deliberately retain all previously approved quiet-chat behavior. */\n:root[data-hermes-theme=\"kaizen\"]:not([data-onboarding-demo]) { --composer-width: 44rem; }\n:root[data-hermes-theme=\"kaizen\"] {\n  --kq-bubble: #efefec;\n  --kq-bubble-hover: #e9eae5;\n  --kq-bubble-active: #e3e4de;\n  --kq-rule: var(--kaizen-line);\n  --kq-elev: none;\n  --kq-elev-focus: 0 0 0 1px var(--kaizen-brand-ink);\n}\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] {\n  --kq-bubble: #2a2d28;\n  --kq-bubble-hover: #31352e;\n  --kq-bubble-active: #383c34;\n  --kq-elev: none;\n  --kq-elev-focus: 0 0 0 1px var(--kaizen-brand-ink);\n}\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"],\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] { border-radius: 18px !important; }\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] {\n  background-color: var(--kaizen-soft) !important;\n  border-color: transparent !important;\n  box-shadow: none;\n}\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"]:focus-within { box-shadow: var(--kq-elev-focus); }\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] :is(textarea, [data-slot=\"composer-rich-input\"])::placeholder { color: var(--kaizen-muted); opacity: 1; }\n@media (max-width: 639.98px), (pointer: coarse) {\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"],\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] { border-radius: 16px !important; }\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] button[type=\"submit\"] { min-width: 44px; min-height: 44px; }\n  :root[data-hermes-theme=\"kaizen\"] [data-tool-summary] { min-height: 44px; align-items: center; }\n  :root[data-hermes-theme=\"kaizen\"] [data-tool-summary]::before { margin-top: 0; }\n}\n@media (prefers-contrast: more) {\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] { box-shadow: 0 0 0 1px var(--kaizen-muted); }\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"]:focus-within { box-shadow: 0 0 0 2px var(--kaizen-ink); }\n}\n@media (forced-colors: active) {\n  :root[data-kz-calm] [data-contrib-shell] { background: Canvas !important; }\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] { background: Canvas !important; border: 1px solid CanvasText !important; }\n}\n"
};

/* Calm navigation uses Hermes's own persistent sidebar and touch drawer.
 * No click interception, animation state machine, forced pane widths, route
 * replacement, or saved-layout rewrites. Plugin owns only its two controls.
 * Historical function name retained for bundle/loader compatibility.
 */
function startCardNav(ctx) {
  const root = document.documentElement;
  const nativeToggle = '[data-titlebar-cluster="left"] button:has(.codicon-layout-sidebar-left)';
  const stage = '#101111';
  const ink = '#e9eae5';
  const search = document.createElement('button');
  search.type = 'button';
  search.className = 'kz-calm-search';
  search.setAttribute('aria-label', 'Search or run a command');
  search.title = 'Search or run a command';
  const glyph = document.createElement('span');
  glyph.className = 'codicon codicon-search';
  glyph.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'kz-calm-search-label';
  label.textContent = 'Search or run a command';
  search.append(glyph, label);
  const fallback = document.createElement('button');
  fallback.type = 'button';
  fallback.className = 'kz-calm-sidebar-toggle';
  fallback.setAttribute('aria-label', 'Toggle sidebar');
  fallback.title = 'Toggle sidebar';
  const sidebarGlyph = document.createElement('span');
  sidebarGlyph.className = 'codicon codicon-layout-sidebar-left';
  sidebarGlyph.setAttribute('aria-hidden', 'true');
  fallback.append(sidebarGlyph);
  let enabled = false;
  let disposed = false;
  let readyWatch = null;
  let scheduled = false;
  const actions = typeof ctx.listActions === 'function'
    ? new Set(ctx.listActions().map(action => action.id)) : new Set();
  const canRun = action => typeof ctx.runAction === 'function' && actions.has(action);
  const run = action => {
    const result = ctx.runAction?.(action);
    if (result && !result.ok) console.warn(`[kaizen-theme] ${action}: ${result.error}`);
  };
  ctx.addEventListener(search, 'click', () => run('nav.commandPalette'));
  ctx.addEventListener(fallback, 'click', () => run('view.toggleSidebar'));

  function restoreCaptions() {
    const style = getComputedStyle(root);
    const background = style.getPropertyValue('--dt-background').trim();
    const foreground = style.getPropertyValue('--dt-foreground').trim();
    if (background && foreground) window.hermesDesktop?.setTitleBarTheme?.({ background, foreground });
  }

  function remove() {
    enabled = false;
    root.removeAttribute('data-kz-calm');
    search.remove();
    fallback.remove();
    readyWatch?.disconnect();
    readyWatch = null;
    restoreCaptions();
  }

  function positionControls() {
    if (!enabled || disposed) return;
    const shell = document.querySelector('[data-contrib-shell]');
    if (!shell) return;
    if (canRun('view.toggleSidebar') && !document.querySelector(nativeToggle)) {
      if (!fallback.isConnected) document.body.append(fallback);
    } else {
      fallback.remove();
    }
    if (!canRun('nav.commandPalette')) return;
    if (!search.isConnected) document.body.append(search);
    const left = document.querySelector('[data-titlebar-cluster="left"]')?.getBoundingClientRect();
    const right = document.querySelector('[data-titlebar-cluster="right"]')?.getBoundingClientRect();
    const touch = matchMedia('(max-width: 639.98px), (pointer: coarse)').matches;
    const low = Math.max(left?.right ?? 56, fallback.isConnected ? 58 : 0) + 12;
    const high = (right?.left ?? (innerWidth - 160)) - 12;
    const available = high - low;
    const compact = touch || available < 230;
    const target = compact ? 44 : Math.min(360, available);
    // Never cover native close/minimize, pane toggles, or contributed tools.
    search.hidden = available < (compact ? 44 : 180);
    search.classList.toggle('kz-calm-search-compact', compact);
    search.style.width = `${target}px`;
    search.style.left = `${Math.max(low, low + (available - target) / 2)}px`;
    search.style.top = touch ? '0px' : '3px';
  }

  function queuePosition() {
    if (scheduled || disposed) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; positionControls(); });
  }

  function follow() {
    if (disposed) return;
    if (root.getAttribute('data-hermes-theme') !== 'kaizen') {
      if (enabled) remove();
      return;
    }
    enabled = true;
    root.setAttribute('data-kz-calm', '');
    // Old card-nav state is plugin-owned; the previous instance normally
    // cleans it on hot reload. Remove residual attributes, never user prefs.
    root.removeAttribute('data-kz-nav');
    root.removeAttribute('data-kz-nav-instant');
    window.hermesDesktop?.setTitleBarTheme?.({ background: stage, foreground: ink });
    if (document.querySelector('[data-contrib-shell]')) {
      readyWatch?.disconnect();
      readyWatch = null;
      queuePosition();
    } else if (!readyWatch) {
      readyWatch = new MutationObserver(() => {
        if (document.querySelector('[data-contrib-shell]')) {
          readyWatch?.disconnect(); readyWatch = null; queuePosition();
        }
      });
      readyWatch.observe(document.body, { childList: true, subtree: true });
    }
  }
  const themeWatch = new MutationObserver(follow);
  themeWatch.observe(root, { attributes: true, attributeFilter: ['data-hermes-theme', 'data-hermes-mode'] });
  ctx.addEventListener(window, 'resize', queuePosition);
  ctx.addEventListener(window, 'hermes:titlebar-chrome-changed', queuePosition);
  follow();
  ctx.onDispose(() => { disposed = true; themeWatch.disconnect(); remove(); });
}

export default {
  id: 'kaizen-theme',
  name: 'Kaizen Theme',
  register(ctx) {
    ctx.register({ id: 'kaizen', area: THEMES_AREA, data: kaizenTheme });
    startCardNav(ctx);
  }
};
