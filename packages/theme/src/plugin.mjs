import { THEMES_AREA } from '@hermes/plugin-sdk';

// KaizenOS's console palette, adapted to Desktop's existing theme roles.
// CSS and an OFL-licensed variable font are embedded by build.mjs.
const themeCSS = /* EMBED_CSS */ '';

export const kaizenTheme = {
  name: 'kaizen',
  label: 'Kaizen',
  description: 'KaizenOS console: neutral surfaces, Hanken Grotesk and signal red. Light and dark.',
  colors: {
    background: '#ffffff', foreground: '#18181b',
    card: '#ffffff', cardForeground: '#18181b',
    muted: '#eeeef1', mutedForeground: '#666670',
    popover: '#ffffff', popoverForeground: '#18181b',
    // User preference: signal red also marks primary actions and selection.
    primary: '#cc3027', primaryForeground: '#ffffff',
    secondary: '#eeeef1', secondaryForeground: '#18181b',
    accent: '#fcebe9', accentForeground: '#b4231b',
    border: '#e3e3e7', input: '#e3e3e7', ring: '#b4231b',
    midground: '#18181b', midgroundForeground: '#ffffff',
    composerRing: '#b4231b',
    destructive: '#b4231b', destructiveForeground: '#ffffff',
    sidebarBackground: '#ffffff', sidebarBorder: '#e3e3e7',
    userBubble: '#ffffff', userBubbleBorder: '#e3e3e7'
  },
  darkColors: {
    background: '#09090b', foreground: '#f4f4f5',
    card: '#141416', cardForeground: '#f4f4f5',
    muted: '#202023', mutedForeground: '#a1a1aa',
    popover: '#141416', popoverForeground: '#f4f4f5',
    primary: '#cc3027', primaryForeground: '#ffffff',
    secondary: '#202023', secondaryForeground: '#f4f4f5',
    accent: '#34201f', accentForeground: '#ff968c',
    border: '#303033', input: '#303033', ring: '#ff968c',
    midground: '#f4f4f5', midgroundForeground: '#09090b',
    composerRing: '#ff968c',
    destructive: '#f19588', destructiveForeground: '#09090b',
    sidebarBackground: '#09090b', sidebarBorder: '#303033',
    userBubble: '#141416', userBubbleBorder: '#303033'
  },
  typography: {
    fontSans: '"Kaizen Hanken", "Hanken Grotesk", "Segoe UI", sans-serif',
    fontMono: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    baseSize: '16px', lineHeight: '1.5', letterSpacing: '-0.01em'
  },
  customCSS: themeCSS + "\n/* Kaizen chat, quiet: a calmer chat for the Kaizen theme.\n   Measured against DeepSeek Harness's chat (MIT, (c) 2026 DeepSeek): no user\n   bubble, tool calls as plain grey lines, a borderless composer card with a\n   soft shadow. Everything outside the chat stays the Kaizen theme.\n\n   Hooks are Hermes's documented data-slot attributes. The three class hooks\n   (.composer-human-message, .uppercase, the diff colours) are not a contract;\n   if an upgrade renames them, that one rule stops applying and nothing else\n   breaks. */\n\n:root[data-hermes-theme=\"kaizen\"] {\n  --kq-rule: var(--kaizen-line);\n  --kq-elev: 0 0 0 1px rgb(0 0 0 / 0.06), 0 4px 16px rgb(0 0 0 / 0.04), 0 0 24px rgb(0 0 0 / 0.03);\n  --kq-elev-focus: 0 0 0 1px rgb(0 0 0 / 0.14), 0 4px 16px rgb(0 0 0 / 0.05), 0 0 24px rgb(0 0 0 / 0.03);\n  --ui-chat-bubble-background: transparent;\n}\n\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] {\n  --kq-elev: 0 0 0 1px rgb(255 255 255 / 0.07);\n  --kq-elev-focus: 0 0 0 1px rgb(255 255 255 / 0.16);\n}\n\n/* ---- Your messages: no bubble -------------------------------------------\n   Plain text on the page, set apart by weight and a quiet rule on the left\n   instead of a box. The sticky prompt already clips the transcript behind\n   it, so it stays readable without a fill. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message {\n  background: transparent !important;\n  border-color: transparent !important;\n  border-radius: 0 !important;\n  box-shadow: inset 2px 0 0 var(--kq-rule) !important;\n  -webkit-backdrop-filter: none !important;\n  backdrop-filter: none !important;\n  padding: 0.125rem 2.25rem 0.125rem 0.875rem !important;\n  color: var(--ui-text-primary) !important;\n  font-weight: 500;\n  transition: box-shadow 150ms ease;\n}\n\n/* The message is a button (click to edit). Without a bubble, the rule carries\n   its states: it darkens on hover, darker still the instant it is pressed. */\n@media (hover: hover) and (pointer: fine) {\n  :root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message:hover {\n    box-shadow: inset 2px 0 0 color-mix(in srgb, var(--ui-text-primary) 35%, transparent) !important;\n  }\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message:active {\n  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--ui-text-primary) 60%, transparent) !important;\n  transition: none;\n}\n\n/* Hermes has no focus style here and the bubble border was the only frame. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"aui_user-message-root\"] .composer-human-message:focus-visible {\n  outline: 2px solid var(--dt-ring);\n  outline-offset: 4px;\n}\n\n/* ---- Tool calls: one grey line --------------------------------------------\n   Closed rows were already plain. An open row loses its box and header rule;\n   its detail hangs off a hairline under the row instead. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"][data-tool-open] {\n  border-color: transparent !important;\n  border-radius: 0 !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"][data-tool-open] > :first-child {\n  border-bottom: 0 !important;\n  padding-inline: 0 !important;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"][data-tool-open] > :first-child + * {\n  margin-left: 0.4375rem;\n  padding: 0.25rem 0 0.375rem 0.875rem !important;\n  border-left: 1px solid var(--kq-rule);\n}\n\n/* Section labels (Search, Output…) in sentence case, not tracked capitals.\n   A hair of positive tracking keeps them legible at this small size. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"] .uppercase {\n  text-transform: none;\n  letter-spacing: 0.01em;\n}\n\n/* +/− line counts in muted greens and reds rather than neon. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"] .text-emerald-600 { color: #4d7c5f; }\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"tool-block\"] .text-rose-600 { color: #a8473f; }\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] [data-slot=\"tool-block\"] .text-emerald-600 { color: #8fb89c; }\n:root[data-hermes-theme=\"kaizen\"][data-hermes-mode=\"dark\"] [data-slot=\"tool-block\"] .text-rose-600 { color: #d99a92; }\n\n/* ---- Composer: a borderless card --------------------------------------\n   No outline, a soft two-layer shadow that firms up on focus. No red ring;\n   red stays on the send button. The fill is left to Hermes's own ladder, so\n   the card still turns translucent while you are scrolled up. */\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-root\"] {\n  border-radius: 20px;\n  --composer-surface-pad-x: 0.75rem;\n  --composer-surface-pad-y: 0.5rem;\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"] {\n  border-color: transparent !important;\n  box-shadow: var(--kq-elev);\n  transition: box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1);\n}\n\n:root[data-hermes-theme=\"kaizen\"] [data-slot=\"composer-surface\"]:focus-within {\n  box-shadow: var(--kq-elev-focus);\n}\n\n/* More contrast asked for: give the card a real edge and the rule more ink. */\n@media (prefers-contrast: more) {\n  :root[data-hermes-theme=\"kaizen\"] {\n    --kq-rule: color-mix(in srgb, var(--ui-text-primary) 45%, transparent);\n    --kq-elev: 0 0 0 1px color-mix(in srgb, var(--ui-text-primary) 45%, transparent);\n    --kq-elev-focus: 0 0 0 1px var(--ui-text-primary);\n  }\n}\n"
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
/* A press on one of these goes somewhere, so the page comes home. */
const PICK = '[data-sidebar="menu-button"], [data-roster-key], .row-hover';
const NOT_A_PICK = '[role="tab"], [aria-haspopup], [data-row-actions], [data-reorder-handle], [data-session-actions], input, textarea';
/* Escape belongs to these first. */
const OPEN_LAYER = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';
const PHONE = '(max-width: 639.98px)';
const REVEAL_EVENT = 'hermes:pane-toggle-reveal';
const SIDEBAR_PANE = 'chat-sidebar';
const FRAME_INSET = { top: 24, right: 22, bottom: 24 };

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

  /* The label carries an unread count after the separator; only what's before it
     says whether the sidebar is open. */
  const sidebarState = button => (button?.getAttribute('aria-label') ?? '').split(' · ')[0];
  const live = () => active && !yielded;
  const isOpening = () => state === 'open' || state === 'opening';
  const tree = () => document.querySelector(TREE);
  const toggleButton = () => document.querySelector(TOGGLE) ?? (standIn.isConnected ? standIn : null);
  /* The Windows caption buttons are native and don't see the theme: they stay dark
     on the ink stage unless told. Their colour flips with the surface behind them. */
  const paintCaptions = onStage => {
    const c = root.getAttribute('data-hermes-mode') === 'dark' ? kaizenTheme.darkColors : kaizenTheme.colors;
    window.hermesDesktop?.setTitleBarTheme?.({ background: c.background, foreground: onStage ? c.background : c.foreground });
  };
  const cssMs = name => Number.parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  const reveal = mode => window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: { id: SIDEBAR_PANE, mode } }));

  /* The ring's closed scale, chosen so its hole is the whole window and its left
     edge travels with the page. Scale about x0 and the left edge sits at
     x0 + (L - x0) * s, which is 0 when x0 = L * s / (s - 1). Same for the top. */
  function placeFrame() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const left = Number.parseFloat(getComputedStyle(frame).left) || 322;
    const sx = width / Math.max(1, width - left - FRAME_INSET.right);
    const sy = height / Math.max(1, height - FRAME_INSET.top - FRAME_INSET.bottom);
    const x0 = (left * sx) / (sx - 1);
    const y0 = (FRAME_INSET.top * sy) / (sy - 1);
    frame.style.setProperty('--kz-frame-sx', sx.toFixed(5));
    frame.style.setProperty('--kz-frame-sy', sy.toFixed(5));
    frame.style.setProperty('--kz-frame-ox', `${(x0 - left).toFixed(2)}px`);
    frame.style.setProperty('--kz-frame-oy', `${(y0 - FRAME_INSET.top).toFixed(2)}px`);
  }

  /* The titlebar cluster stays put on every page and knows the platform's offsets. */
  function placeStandIn() {
    const box = document.querySelector('[data-titlebar-cluster="left"]')?.getBoundingClientRect();

    if (box) {
      standIn.style.left = `${box.left}px`;
      standIn.style.top = `${box.top}px`;
    }
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
         happen while the page is set aside. Its measurements refresh on resize. */
      window.dispatchEvent(new Event('resize'));

      if (focus) {
        const back = returnFocus?.isConnected ? returnFocus : toggleButton();
        back?.focus({ preventScroll: true });
      }

      returnFocus = null;
    }
  }

  function go(target, { instant = false, focus = true, touch = false } = {}) {
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
      paintCaptions(true);
      /* Two frames: the phone overlay has to commit before it can take focus. */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (id === run && isOpening()) {
          const surface = document.querySelector(SURFACE);
          FIRST_ITEMS.map(item => surface?.querySelector(item)).find(Boolean)?.focus({ preventScroll: true });
        }
      }));
    } else {
      setState('closing');
      paintCaptions(false);
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
    paintCaptions(false);
    setState('closed');
    root.removeAttribute('data-kz-nav-instant');
  }

  function activate() {
    if (active) {
      return;
    }

    active = true;
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
    yielded = false;
    closeNow();
    cancelRetry?.();
    cancelRetry = null;
    root.removeAttribute('data-kz-nav');
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

  /* The bubble phase runs after the app's own handler, so the route has moved. */
  ctx.addEventListener(document, 'click', event => {
    const target = element(event);

    if (!live() || !isOpening() || !target?.closest(SURFACE)) {
      return;
    }

    if (location.hash !== openHash || (target.closest(PICK) && !target.closest(NOT_A_PICK))) {
      go('closed', { focus: false });
    }
  });

  ctx.addEventListener(window, 'keydown', () => {
    lastKey = performance.now();
  }, true);

  ctx.addEventListener(window, 'keydown', event => {
    if (!live() || event.key !== 'Escape' || !isOpening() || event.defaultPrevented) {
      return;
    }

    if (document.querySelector(OPEN_LAYER)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    go('closed', { instant: true });
  }, true);

  ctx.addEventListener(scrim, 'pointerdown', event => {
    event.preventDefault();

    if (isOpening()) {
      go('closed');
    }
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
    }
  });

  ctx.addEventListener(window, 'resize', () => {
    if (active) {
      placeFrame();
      placeStandIn();
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
