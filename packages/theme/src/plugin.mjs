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

/* Card navigation: the state behind the styles in theme.css.
 *
 * This keeps one attribute on <html> current and owns three small elements of
 * its own (frame, scrim, phone rail). It writes nothing to anything React
 * renders, so a re-render or a remounted pane can't lose the nav's state: the
 * stylesheet reads the attribute, and even input blocking is CSS. Motion is CSS
 * transitions, which retarget from the frame on screen, so reversing needs no
 * bookkeeping here.
 */
const TREE = '[data-contrib-shell] > div > [data-tree-split]';
/* By its icon: a page can put its own tools in this cluster. */
const TOGGLE = '[data-titlebar-cluster="left"] button:has(.codicon-layout-sidebar-left)';
const SURFACE = '[data-tree-group]:has([data-tree-tab="sessions"]), [data-narrow-overlay].left-0';
const OVERLAY = '[data-narrow-overlay].left-0';
const ZONE = '[data-tree-group]:has([data-tree-tab="sessions"])';
/* Where focus lands on opening, best first: Sessions has rows, Bots a roster. */
const FIRST_ITEMS = ['[data-sidebar="menu-button"]:not([aria-disabled="true"])', '[data-roster-key]', '[role="tab"]'];
const PHONE = '(max-width: 639.98px)';
const REVEAL_EVENT = 'hermes:pane-toggle-reveal';
const SIDEBAR_PANE = 'chat-sidebar';
const FRAME_INSET = { top: 46, right: 14, bottom: 14 };
/* Where the calm card rests when the nav is closed (theme.css pads the shell 14px). */
const FRAME_REST_LEFT = 14;
const PAGE = '[data-contrib-shell] > div > [data-tree-split] > div:not(:has([data-tree-tab="sessions"]))';
const PAGE_GROUP = `${PAGE} [data-tree-group]`;
const STAGE = '#101111';
const STAGE_INK = '#e9eae5';

function startCardNav(ctx) {
  const root = document.documentElement;
  const phone = window.matchMedia(PHONE);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let active = false;
  let state = 'closed';
  let run = 0;
  let cancelSettle = null;
  let cancelRetry = null;
  let wrapper = null;
  let wrapperWatch = null;
  let toggleEl = null;
  let toggleWatch = null;
  let sidebarLabel = '';
  let undoing = false;
  let nativeClick = false;
  let overlaySeen = false;
  let treeNode = null;
  let yielded = false;
  let lastKey = 0;
  let settledLayoutAt = -1000;
  let openHash = '';
  let returnFocus = null;

  const frame = document.createElement('div');
  frame.className = 'kz-nav-frame';
  frame.setAttribute('aria-hidden', 'true');
  const scrim = document.createElement('div');
  scrim.className = 'kz-nav-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  const rail = document.createElement('button');
  rail.className = 'kz-nav-rail';
  rail.type = 'button';
  rail.textContent = 'CHAT';
  rail.setAttribute('aria-label', 'Return to chat');
  /* Some pages, Today among them, leave the app's toggle out of the titlebar, and
     without it there is no way into the nav. This stands in; the stylesheet shows
     it only while the app's own is missing. */
  const standIn = document.createElement('button');
  standIn.className = 'kz-nav-toggle';
  standIn.type = 'button';
  standIn.setAttribute('aria-label', 'Show sidebar');
  standIn.append(Object.assign(document.createElement('span'), { className: 'codicon codicon-layout-sidebar-left' }));
  /* Woday-style search in the top bar. It runs the app's own palette action,
     so it exists only where the host exposes ctx.runAction. */
  const actions = typeof ctx.listActions === 'function' ? new Set(ctx.listActions().map(action => action.id)) : new Set();
  const canSearch = typeof ctx.runAction === 'function' && actions.has('nav.commandPalette');
  const search = document.createElement('button');
  search.type = 'button';
  search.className = 'kz-calm-search';
  search.setAttribute('aria-label', 'Search or run a command');
  search.title = 'Search or run a command';
  search.append(
    Object.assign(document.createElement('span'), { className: 'codicon codicon-search' }),
    Object.assign(document.createElement('span'), { className: 'kz-calm-search-label', textContent: 'Search or run a command' })
  );
  search.firstChild.setAttribute('aria-hidden', 'true');

  /* The label carries an unread count after the separator; only what's before it
     says whether the sidebar is open. */
  const sidebarState = button => (button?.getAttribute('aria-label') ?? '').split(' · ')[0];
  const live = () => active && !yielded;
  const isOpening = () => state === 'open' || state === 'opening';
  const tree = () => document.querySelector(TREE);
  const toggleButton = () => document.querySelector(TOGGLE) ?? (standIn.isConnected ? standIn : null);
  /* The Windows caption buttons are native and don't see the theme: they stay dark
     on the ink stage unless told. Their colour flips with the surface behind them. */
  /* The window captions sit on the dark stage in every state and mode. */
  const paintCaptions = () => {
    window.hermesDesktop?.setTitleBarTheme?.({ background: STAGE, foreground: STAGE_INK });
  };
  const restoreCaptions = () => {
    const style = getComputedStyle(root);
    const background = style.getPropertyValue('--dt-background').trim();
    const foreground = style.getPropertyValue('--dt-foreground').trim();
    if (background && foreground) window.hermesDesktop?.setTitleBarTheme?.({ background, foreground });
  };
  const cssMs = name => Number.parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  const reveal = mode => window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: { id: SIDEBAR_PANE, mode } }));

  /* The ring's closed scale, chosen so its hole is the whole window and its left
     edge travels with the page. Scale about x0 and the left edge sits at
     x0 + (L - x0) * s, which is 0 when x0 = L * s / (s - 1). Same for the top. */
  /* Where the calm card rests: the page's first pane, measured without the slide's
     own offset, so the ring lands on the real card whatever the shell pads it by. */
  function restLeft() {
    const group = document.querySelector(PAGE_GROUP);
    const page = group?.closest(PAGE);

    if (!group || !page) {
      return FRAME_REST_LEFT;
    }

    const transform = getComputedStyle(page).transform;
    const shift = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m41 : 0;
    const left = group.getBoundingClientRect().left - shift;
    /* The page layer is painted while it moves; start that paint at the card,
       not at the layer's own edge, so no square sliver shows beside the corners. */
    const gutter = group.getBoundingClientRect().left - page.getBoundingClientRect().left;
    root.style.setProperty('--kz-page-gutter', `${Math.max(0, Number.isFinite(gutter) ? gutter : 0).toFixed(2)}px`);
    return Number.isFinite(left) && left >= 0 && left < 120 ? left : FRAME_REST_LEFT;
  }

  function placeFrame() {
    const width = window.innerWidth;
    const restAt = restLeft();
    frame.style.setProperty('--kz-frame-rest', `${restAt.toFixed(2)}px`);
    const left = Number.parseFloat(getComputedStyle(frame).left) || 322 + restAt;
    /* Closed, the ring's hole is the calm card at rest, not the whole window, so
       the slide home ends exactly where the resting layout takes over. Only the
       left edge moves: top, right and bottom are the same open and closed. */
    const open = Math.max(1, width - left - FRAME_INSET.right);
    const rest = Math.max(1, width - restAt - FRAME_INSET.right);
    const sx = Math.max(1.0001, rest / open);
    frame.style.setProperty('--kz-frame-sx', sx.toFixed(5));
    frame.style.setProperty('--kz-frame-sy', '1');
    frame.style.setProperty('--kz-frame-ox', `${((left - restAt) / (sx - 1)).toFixed(2)}px`);
    frame.style.setProperty('--kz-frame-oy', '0px');
  }

  /* The titlebar cluster stays put on every page and knows the platform's offsets. */
  function placeStandIn() {
    const box = document.querySelector('[data-titlebar-cluster="left"]')?.getBoundingClientRect();

    if (box) {
      standIn.style.left = `${box.left}px`;
      standIn.style.top = `${box.top}px`;
    }
  }

  function placeSearch() {
    if (!canSearch || !active) {
      search.remove();
      return;
    }
    if (!search.isConnected) document.body.append(search);
    const left = document.querySelector('[data-titlebar-cluster="left"]')?.getBoundingClientRect();
    const right = document.querySelector('[data-titlebar-cluster="right"]')?.getBoundingClientRect();
    const touch = matchMedia('(max-width: 639.98px), (pointer: coarse)').matches;
    const low = Math.max(left?.right ?? 56, standIn.isConnected ? 44 : 0) + 12;
    const high = (right?.left ?? (window.innerWidth - 160)) - 12;
    const available = high - low;
    const compact = touch || available < 230;
    const width = compact ? 44 : Math.min(360, available);
    search.hidden = available < (compact ? 44 : 180);
    search.classList.toggle('kz-calm-search-compact', compact);
    search.style.width = `${width}px`;
    search.style.left = `${low + (available - width) / 2}px`;
    search.style.top = touch ? '0px' : '3px';
  }

  /* Attach to the live shell. Cheap, so it runs before every command: the tree
     can remount, and the parts must sit in its stacking context to fall between
     the page and the toggle. */
  function mount() {
    const node = tree();
    const parent = node?.parentElement;

    if (!parent) {
      return false;
    }

    if (parent !== wrapper || node !== treeNode) {
      wrapper = parent;
      treeNode = node;
      wrapperWatch?.disconnect();
      wrapperWatch = new MutationObserver(onShapeChange);
      wrapperWatch.observe(parent, { childList: true });
      wrapperWatch.observe(node, { childList: true });
    }

    for (const part of [frame, scrim, rail]) {
      if (part.parentElement !== parent) {
        parent.append(part);
      }
    }

    if (!standIn.isConnected) {
      document.body.append(standIn);
    }

    placeStandIn();
    placeSearch();
    watchToggle();
    syncLayout();
    unfold();
    placeFrame();

    return true;
  }

  function onShapeChange() {
    mount();
    syncOverlay();
  }

  /* This nav is built around Sessions on the left. With the panes flipped, stand
     down: the attribute goes, the styles with it, and the app's own layout returns. */
  function standDown() {
    closeNow();
    yielded = true;
    root.removeAttribute('data-kz-nav');
  }

  function syncLayout() {
    const zone = document.querySelector(ZONE);

    if (!active || phone.matches || !zone || !treeNode) {
      return;
    }

    const onLeft = Boolean(treeNode.firstElementChild?.contains(zone));

    if (!onLeft && !yielded) {
      standDown();
    } else if (onLeft && yielded) {
      yielded = false;
      /* Flipping back also changes the toggle's label. That isn't a command. */
      settledLayoutAt = performance.now();
      setState('closed');
    }
  }

  function watchToggle() {
    const button = toggleButton();

    if (button === toggleEl) {
      return;
    }

    toggleEl = button;
    sidebarLabel = sidebarState(button);
    toggleWatch?.disconnect();
    toggleWatch = null;

    if (button) {
      toggleWatch = new MutationObserver(onSidebarState);
      toggleWatch.observe(button, { attributes: true, attributeFilter: ['aria-label'] });
    }
  }

  /* ⌘B runs the app's own sidebar toggle, which folds the zone the nav lives in,
     and no plugin can get in first. So when the sidebar's state really changes,
     put it back through the app's own button and treat that as the toggle. It's a
     keyboard action, so it doesn't animate. At phone width the overlay follows
     the app instead. */
  function onSidebarState() {
    const label = sidebarState(toggleEl);

    if (label === sidebarLabel) {
      return;
    }

    sidebarLabel = label;

    if (undoing) {
      undoing = false;

      return;
    }

    /* Decide after the key event has finished, so lastKey has caught up. A label
       that changes with no key behind it is a language change, not a command. */
    ctx.setTimeout(() => {
      const now = performance.now();

      if (!live() || phone.matches || !document.querySelector(ZONE) || now - lastKey > 600 || now - settledLayoutAt < 400) {
        return;
      }

      undoing = true;
      ctx.setTimeout(() => {
        undoing = false;
      }, 250);
      nativeClick = true;
      toggleEl?.click();
      nativeClick = false;
      flip({ instant: true });
    }, 0);
  }

  /* A folded zone renders as a thin vertical rail with no nav in it. The fold can
     be left in saved layout, and its tab is the app's own way to restore it. */
  function unfold() {
    const zone = document.querySelector(ZONE);

    if (zone && !zone.querySelector('[data-zone-tabstrip]')) {
      zone.querySelector('[data-tree-tab="sessions"]')?.click();
    }
  }

  function setState(next) {
    state = next;
    root.setAttribute('data-kz-nav', next);
    toggleButton()?.setAttribute('aria-expanded', String(isOpening()));
  }

  function settle(target, focus) {
    cancelSettle = null;
    setState(target === 'open' ? 'open' : 'closed');
    root.removeAttribute('data-kz-nav-instant');

    if (target === 'open' && phone.matches && !overlaySeen && !document.querySelector(OVERLAY)) {
      /* It didn't appear on our side, so the panes are flipped. The app's overlay is
         open on the right; leave it, and don't leave the page away with nothing behind it. */
      standDown();

      return;
    }

    if (target !== 'open') {
      if (phone.matches) {
        reveal('close');
      }

      watchToggle();

      /* Hermes measures the page's left edge when a chat opens, and that can
         happen while the page is set aside. Its measurements refresh on resize.
         Only then: a resize with nothing to fix makes the chat re-measure and jump. */
      if (location.hash !== openHash) {
        window.dispatchEvent(new Event('resize'));
      }

      const current = document.activeElement;
      const idle = !current || current === document.body || current === toggleButton() || current.closest?.(SURFACE);

      if (focus && idle && returnFocus?.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }

      returnFocus = null;
    }
  }

  function go(target, { instant = false, focus = true, touch = false } = {}) {
    const keyboard = instant;
    const opening = target === 'open';

    if (!live() || opening === isOpening() || !mount() || !live()) {
      return;
    }

    const id = ++run;
    cancelSettle?.();
    cancelSettle = null;

    const still = instant || reduced.matches;
    root.toggleAttribute('data-kz-nav-instant', still);

    if (opening) {
      if (state === 'closed') {
        placeFrame();
        openHash = location.hash;
        const current = document.activeElement;
        /* Opened by touch, going back to a text field would raise the keyboard. */
        const typing = current?.isContentEditable || current?.matches('input, textarea');
        returnFocus = current && current !== document.body && !(touch && typing) ? current : null;
      }

      if (phone.matches) {
        reveal('open');
      }

      setState('opening');
      paintCaptions();
      /* Two frames: the phone overlay has to commit before it can take focus. */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        /* Only a keyboard open takes focus into the nav. A click leaves it where it
           was, so typing keeps going to the chat. */
        if (keyboard && id === run && isOpening()) {
          const surface = document.querySelector(SURFACE);
          FIRST_ITEMS.map(item => surface?.querySelector(item)).find(Boolean)?.focus({ preventScroll: true });
        }
      }));
    } else {
      setState('closing');
      paintCaptions();
    }

    let finished = false;
    const finish = () => {
      if (!finished && id === run) {
        finished = true;
        cancelSettle?.();
        settle(target, focus);
      }
    };

    /* Land when the motion really ends, not after a fixed time: opening a heavy
       chat can hold up the first frame. The timer is only a backstop, for a hidden
       window whose animations don't tick. An instant move still waits a few frames:
       the attribute that turns transitions off has to outlive the next style pass. */
    const motion = still ? [] : (phone.matches ? rail : frame).getAnimations();
    const budget = cssMs(opening ? '--kz-nav-open' : '--kz-nav-close') + 600;
    cancelSettle = ctx.setTimeout(finish, still || !motion.length ? 64 : budget);

    if (motion.length) {
      Promise.allSettled(motion.map(animation => animation.finished)).then(finish);
    }
  }

  const flip = options => go(isOpening() ? 'closed' : 'open', options);

  /* At phone width the app owns the overlay. Follow it when something other
     than this code opens or closes it, such as ⌘B. */
  function syncOverlay() {
    if (!live() || !phone.matches) {
      return;
    }

    if (document.querySelector(OVERLAY)) {
      overlaySeen = true;

      if (state === 'closed') {
        go('open', { instant: true });
      }
    } else if (overlaySeen) {
      overlaySeen = false;

      if (isOpening()) {
        go('closed', { instant: true, focus: false });
      }
    }
  }

  function closeNow() {
    run += 1;
    cancelSettle?.();
    cancelSettle = null;
    paintCaptions();
    setState('closed');
    root.removeAttribute('data-kz-nav-instant');
  }

  function activate() {
    if (active) {
      return;
    }

    active = true;
    root.setAttribute('data-kz-calm', '');
    paintCaptions();
    setState('closed');

    if (!mount()) {
      /* The plugin can load before the shell has rendered. */
      cancelRetry = ctx.setInterval(() => {
        if (mount()) {
          cancelRetry?.();
          cancelRetry = null;
        }
      }, 300);
    }
  }

  function deactivate() {
    if (!active) {
      return;
    }

    active = false;
    root.removeAttribute('data-kz-calm');
    root.style.removeProperty('--kz-page-gutter');
    search.remove();
    yielded = false;
    closeNow();
    cancelRetry?.();
    cancelRetry = null;
    root.removeAttribute('data-kz-nav');
    restoreCaptions();
    [frame, scrim, rail, standIn].forEach(part => part.remove());
    wrapperWatch?.disconnect();
    toggleWatch?.disconnect();
    wrapper = null;
    treeNode = null;
    toggleEl = null;
  }

  const element = event => (event.target instanceof Element ? event.target : null);

  /* Motion starts on the press, not the release. */
  ctx.addEventListener(document, 'pointerdown', event => {
    if (live() && event.button === 0 && toggleButton()?.contains(element(event))) {
      flip({ touch: event.pointerType === 'touch' });
    }
  }, true);

  /* The press already acted. A click with no pointer behind it is Enter or Space. */
  ctx.addEventListener(document, 'click', event => {
    if (!live() || nativeClick || !toggleButton()?.contains(element(event))) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.detail === 0) {
      flip({ instant: true });
    }
  }, true);

  /* The nav opens and closes from the sidebar button alone. Picking a chat,
     pressing the page, Escape and typing all leave it where it is, and the page
     stays usable beside it. The one keyboard route is the app's own sidebar
     shortcut, which is the same command as the button. Only a modified key can
     be that shortcut, so plain typing (Enter to send included) never counts. */
  ctx.addEventListener(window, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      lastKey = performance.now();
    }
  }, true);

  ctx.addEventListener(search, 'click', () => {
    const result = ctx.runAction?.('nav.commandPalette');
    if (result && !result.ok) console.warn(`[kaizen-theme] nav.commandPalette: ${result.error}`);
  });

  ctx.addEventListener(rail, 'pointerdown', event => {
    event.preventDefault();
    flip();
  });

  ctx.addEventListener(rail, 'click', event => {
    if (event.detail === 0) {
      flip({ instant: true });
    }
  });

  /* Some views swap the titlebar's buttons, so a new toggle needs watching. */
  ctx.addEventListener(window, 'hermes:titlebar-chrome-changed', () => {
    if (active) {
      watchToggle();
      placeSearch();
    }
  });

  ctx.addEventListener(window, 'resize', () => {
    if (active) {
      placeFrame();
      placeStandIn();
      placeSearch();
    }
  });

  ctx.addEventListener(phone, 'change', () => {
    if (!active) {
      return;
    }

    if (state !== 'closed') {
      closeNow();
      reveal('close');
    }

    if (yielded) {
      yielded = false;
      setState('closed');
    }

    syncLayout();
  });

  const follow = () => (root.getAttribute('data-hermes-theme') === 'kaizen' ? activate() : deactivate());
  const themeWatch = new MutationObserver(follow);
  themeWatch.observe(root, { attributes: true, attributeFilter: ['data-hermes-theme'] });
  follow();

  ctx.onDispose(() => {
    themeWatch.disconnect();
    deactivate();
  });
}

export default {
  id: 'kaizen-theme',
  name: 'Kaizen Theme',
  register(ctx) {
    ctx.register({ id: 'kaizen', area: THEMES_AREA, data: kaizenTheme });
    startCardNav(ctx);
  }
};
