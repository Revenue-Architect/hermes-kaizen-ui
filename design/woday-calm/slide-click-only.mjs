// Click-only slide, round 2 (Kamran 2026-11-17):
//  - only the top-left sidebar button (or Cmd/Ctrl+B, the same command) opens or closes;
//    no page press, pick, route change, Escape or typing closes it, and the page stays usable;
//  - closing lands exactly on the calm resting card, so there is no snap at the end.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '../../packages/theme');
function swap(text, from, to, label) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1 match, found ${n}`);
  return text.replace(from, () => to);
}

const jsPath = path.join(pkg, 'src/plugin.mjs');
let js = await readFile(jsPath, 'utf8');
if (js.includes('FRAME_REST_LEFT')) throw new Error('already applied');

js = swap(js, "/* A press on one of these goes somewhere, so the page comes home. */\nconst PICK = '[data-sidebar=\"menu-button\"], [data-roster-key], .row-hover';\nconst NOT_A_PICK = '[role=\"tab\"], [aria-haspopup], [data-row-actions], [data-reorder-handle], [data-session-actions], input, textarea';\n/* Escape belongs to these first. */\nconst OPEN_LAYER = '[role=\"dialog\"], [role=\"alertdialog\"], [role=\"menu\"], [role=\"listbox\"], [data-radix-popper-content-wrapper]';\n", '', 'drop pick/escape selectors');
js = swap(js, "const FRAME_INSET = { top: 46, right: 14, bottom: 14 };", "const FRAME_INSET = { top: 46, right: 14, bottom: 14 };\n/* Where the calm card rests when the nav is closed (theme.css pads the shell 14px). */\nconst FRAME_REST_LEFT = 14;", 'rest left');

js = swap(js, `    const sx = width / Math.max(1, width - left - FRAME_INSET.right);
    const sy = height / Math.max(1, height - FRAME_INSET.top - FRAME_INSET.bottom);
    const x0 = (left * sx) / (sx - 1);
    const y0 = (FRAME_INSET.top * sy) / (sy - 1);
    frame.style.setProperty('--kz-frame-sx', sx.toFixed(5));
    frame.style.setProperty('--kz-frame-sy', sy.toFixed(5));
    frame.style.setProperty('--kz-frame-ox', \`\${(x0 - left).toFixed(2)}px\`);
    frame.style.setProperty('--kz-frame-oy', \`\${(y0 - FRAME_INSET.top).toFixed(2)}px\`);`,
`    /* Closed, the ring's hole is the calm card at rest, not the whole window, so
       the slide home ends exactly where the resting layout takes over. Only the
       left edge moves: top, right and bottom are the same open and closed. */
    const open = Math.max(1, width - left - FRAME_INSET.right);
    const rest = Math.max(1, width - FRAME_REST_LEFT - FRAME_INSET.right);
    const sx = Math.max(1.0001, rest / open);
    frame.style.setProperty('--kz-frame-sx', sx.toFixed(5));
    frame.style.setProperty('--kz-frame-sy', '1');
    frame.style.setProperty('--kz-frame-ox', \`\${((left - FRAME_REST_LEFT) / (sx - 1)).toFixed(2)}px\`);
    frame.style.setProperty('--kz-frame-oy', '0px');`, 'placeFrame');
js = swap(js, "    const height = window.innerHeight;\n    const left = Number.parseFloat(getComputedStyle(frame).left)", "    const left = Number.parseFloat(getComputedStyle(frame).left)", 'drop height');

// Close: give focus back only if the press left it on the toggle or nowhere;
// re-measure only if a chat opened while the page was aside.
js = swap(js, `      /* Hermes measures the page's left edge when a chat opens, and that can
         happen while the page is set aside. Its measurements refresh on resize. */
      window.dispatchEvent(new Event('resize'));

      if (focus) {
        const back = returnFocus?.isConnected ? returnFocus : toggleButton();
        back?.focus({ preventScroll: true });`,
`      /* Hermes measures the page's left edge when a chat opens, and that can
         happen while the page is set aside. Its measurements refresh on resize.
         Only then: a resize with nothing to fix makes the chat re-measure and jump. */
      if (location.hash !== openHash) {
        window.dispatchEvent(new Event('resize'));
      }

      const current = document.activeElement;
      const idle = !current || current === document.body || current === toggleButton() || current.closest?.(SURFACE);

      if (focus && idle && returnFocus?.isConnected) {
        returnFocus.focus({ preventScroll: true });`, 'settle focus');

js = swap(js, `  function go(target, { instant = false, focus = true, touch = false } = {}) {`, `  function go(target, { instant = false, focus = true, touch = false } = {}) {
    const keyboard = instant;`, 'go keyboard');
js = swap(js, `        if (id === run && isOpening()) {
          const surface`, `        /* Only a keyboard open takes focus into the nav. A click leaves it where it
           was, so typing keeps going to the chat. */
        if (keyboard && id === run && isOpening()) {
          const surface`, 'focus on keyboard only');

js = swap(js, `  /* The bubble phase runs after the app's own handler, so the route has moved. */
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
`, `  /* The nav opens and closes from the sidebar button alone. Picking a chat,
     pressing the page, Escape and typing all leave it where it is, and the page
     stays usable beside it. The one keyboard route is the app's own sidebar
     shortcut, which is the same command as the button. Only a modified key can
     be that shortcut, so plain typing (Enter to send included) never counts. */
  ctx.addEventListener(window, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      lastKey = performance.now();
    }
  }, true);
`, 'drop closers');

await writeFile(jsPath, js);

const cssPath = path.join(pkg, 'src/theme.css');
let css = await readFile(cssPath, 'utf8');
css = swap(css, `/* Set aside, nothing on the page takes input or focus. This is the CSS form of
   inert, so it adds nothing to elements React owns. */
:root:is([data-kz-nav="opening"], [data-kz-nav="open"]) :is([data-contrib-shell] > div > [data-tree-split] > div:not(:has([data-tree-tab="sessions"])), [data-pane-host], [data-titlebar-cluster="right"]) {
  interactivity: inert;
}
`, `/* Set aside, the page stays live: Kamran chats with the nav open, and only the
   sidebar button sends the page home. */
`, 'drop inert');
css = swap(css, `  border-radius: 20px;
  box-shadow: 0 0 0 400px var(--kz-nav-stage);
  clip-path: inset(-400px -400px -400px 0);
  pointer-events: none;
  transform: scale(var(--kz-frame-sx, 1.6), var(--kz-frame-sy, 1.1));
  transform-origin: var(--kz-frame-ox, 0px) var(--kz-frame-oy, 0px);
  transition: transform var(--kz-nav-close) var(--kz-ease-drawer);
}
:root:is([data-kz-nav="opening"], [data-kz-nav="open"]) .kz-nav-frame {
  transform: none;
  transition-duration: var(--kz-nav-open);
}`, `  /* Closed, the ring is stretched sideways onto the resting card; dividing the
     horizontal radius by the stretch keeps the corners a true 20px there, so the
     hand-over to the resting layout is pixel-identical. */
  border-radius: calc(20px / var(--kz-frame-sx, 1.2)) / 20px;
  box-shadow: 0 0 0 400px var(--kz-nav-stage);
  clip-path: inset(-400px -400px -400px 0);
  pointer-events: none;
  transform: scale(var(--kz-frame-sx, 1.2), var(--kz-frame-sy, 1));
  transform-origin: var(--kz-frame-ox, 0px) var(--kz-frame-oy, 0px);
  transition-property: transform, border-radius;
  transition-duration: var(--kz-nav-close);
  transition-timing-function: var(--kz-ease-drawer);
}
:root:is([data-kz-nav="opening"], [data-kz-nav="open"]) .kz-nav-frame {
  transform: none;
  border-radius: 20px;
  transition-duration: var(--kz-nav-open);
}`, 'frame ring');
css = swap(css, `/* Catches the press that sends the page home, and keeps a click from landing
   on a control while the page is still moving. */
.kz-nav-scrim {
  position: fixed;
  inset: 0 0 0 var(--kz-nav-page-x);
  z-index: 5;
  -webkit-app-region: no-drag;
}`, `/* Takes no presses while the page is aside (the page stays usable). It only
   keeps a click from landing on a control while the page is travelling home. */
.kz-nav-scrim {
  position: fixed;
  inset: 0 0 0 var(--kz-nav-page-x);
  z-index: 5;
  pointer-events: none;
  -webkit-app-region: no-drag;
}`, 'scrim passive');
css = swap(css, `:root[data-kz-nav="closing"] .kz-nav-scrim {
  display: block !important;
  inset: 0;
}`, `:root[data-kz-nav="closing"] .kz-nav-scrim {
  display: block !important;
  inset: 0;
  pointer-events: auto;
}`, 'scrim closing');
await writeFile(cssPath, css);
console.log('Applied click-only close and seamless landing.');
