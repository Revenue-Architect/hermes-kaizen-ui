// Restore the card-slide navigation on top of the calm workspace.
// Trigger contract: the top-left sidebar button (or the stand-in on pages that
// drop it) is the only thing that animates the nav open. Keyboard paths stay
// instant, and the native drawer still owns phone widths.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '../../packages/theme');
const backup = '/opt/data/backups/kaizen-woday-20261117T034825Z';

function swap(text, from, to, label) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1 match, found ${n}`);
  return text.replace(from, () => to);
}
function cut(text, start, end, label) {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`${label}: bounds not found`);
  return text.slice(0, a) + text.slice(b);
}

// ---- Controller --------------------------------------------------------
const oldSrc = await readFile(path.join(backup, 'source-plugin.mjs'), 'utf8');
let nav = oldSrc.slice(oldSrc.indexOf('/* Card navigation:'));
const pluginPath = path.join(pkg, 'src/plugin.mjs');
let plugin = await readFile(pluginPath, 'utf8');
if (plugin.includes('/* Card navigation:')) throw new Error('Card nav already restored');
const calmAt = plugin.indexOf('/* Calm navigation uses');
if (calmAt < 0) throw new Error('Calm controller not found');

nav = swap(nav, 'const FRAME_INSET = { top: 24, right: 22, bottom: 24 };',
  "const FRAME_INSET = { top: 46, right: 14, bottom: 14 };\nconst STAGE = '#101111';\nconst STAGE_INK = '#e9eae5';", 'frame inset');
nav = nav.replace(/  const paintCaptions = onStage => \{[\s\S]*?\n  \};\n/, m => {
  if (!m) throw new Error('paintCaptions');
  return "  /* The window captions sit on the dark stage in every state and mode. */\n  const paintCaptions = () => {\n    window.hermesDesktop?.setTitleBarTheme?.({ background: STAGE, foreground: STAGE_INK });\n  };\n  const restoreCaptions = () => {\n    const style = getComputedStyle(root);\n    const background = style.getPropertyValue('--dt-background').trim();\n    const foreground = style.getPropertyValue('--dt-foreground').trim();\n    if (background && foreground) window.hermesDesktop?.setTitleBarTheme?.({ background, foreground });\n  };\n";
});
if (!nav.includes('const restoreCaptions')) throw new Error('paintCaptions not replaced');

// Search pill: runs the native command palette, never covers native controls.
nav = swap(nav,
  "  standIn.append(Object.assign(document.createElement('span'), { className: 'codicon codicon-layout-sidebar-left' }));\n",
  `  standIn.append(Object.assign(document.createElement('span'), { className: 'codicon codicon-layout-sidebar-left' }));
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
`, 'search create');

nav = swap(nav, '  /* Attach to the live shell.', `  function placeSearch() {
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
    search.style.width = \`\${width}px\`;
    search.style.left = \`\${low + (available - width) / 2}px\`;
    search.style.top = touch ? '0px' : '3px';
  }

  /* Attach to the live shell.`, 'placeSearch');
nav = swap(nav, '    placeStandIn();\n    watchToggle();', '    placeStandIn();\n    placeSearch();\n    watchToggle();', 'mount search');
nav = swap(nav, '    active = true;\n', "    active = true;\n    root.setAttribute('data-kz-calm', '');\n    paintCaptions();\n", 'activate calm');
nav = swap(nav, '    active = false;\n', "    active = false;\n    root.removeAttribute('data-kz-calm');\n    search.remove();\n", 'deactivate calm');
nav = swap(nav, "    root.removeAttribute('data-kz-nav');\n    [frame, scrim, rail, standIn]", "    root.removeAttribute('data-kz-nav');\n    restoreCaptions();\n    [frame, scrim, rail, standIn]", 'deactivate captions');
nav = swap(nav, "    if (active) {\n      watchToggle();\n    }", "    if (active) {\n      watchToggle();\n      placeSearch();\n    }", 'chrome change search');
nav = swap(nav, '      placeFrame();\n      placeStandIn();\n', '      placeFrame();\n      placeStandIn();\n      placeSearch();\n', 'resize search');
nav = swap(nav, "  ctx.addEventListener(rail, 'pointerdown'", "  ctx.addEventListener(search, 'click', () => {\n    const result = ctx.runAction?.('nav.commandPalette');\n    if (result && !result.ok) console.warn(`[kaizen-theme] nav.commandPalette: ${result.error}`);\n  });\n\n  ctx.addEventListener(rail, 'pointerdown'", 'search click');
for (const leftover of ['paintCaptions(true)', 'paintCaptions(false)']) nav = nav.split(leftover).join('paintCaptions()');

plugin = plugin.slice(0, calmAt) + nav;
await writeFile(pluginPath, plugin);

// ---- Stylesheet ---------------------------------------------------------
const oldCss = await readFile(path.join(backup, 'source-theme.css'), 'utf8');
const grab = (start, end) => oldCss.slice(oldCss.indexOf(start), oldCss.indexOf(end, oldCss.indexOf(start)));
let desk = grab('/* ---- Card navigation ---------------------------------------------------', '/* Everything inside sits on the rail');
let phone = grab('/* ---- Card navigation at phone width', '/* The page you are on stays red');

desk = swap(desk, '  --kz-nav-page-y: 20px;', '  --kz-nav-page-y: 0px;', 'page y');
desk = swap(desk, '  --kz-nav-stage: #0a0a0b;\n  --kz-nav-on-stage: #fafafa;', '  --kz-nav-stage: #101111;\n  --kz-nav-on-stage: #e9eae5;', 'stage');
desk = swap(desk, ':root[data-hermes-theme="kaizen"][data-hermes-mode="dark"] {\n  --kz-nav-stage: #fafafa;\n  --kz-nav-on-stage: #18181b;\n}\n', '', 'dark stage');
desk = cut(desk, '/* The inverse palette, on the nav surface at every width. */', '/* The nav takes no room in the layout.', 'inverse palette');
desk = swap(desk, '  padding-top: 36px;', '  padding-top: 46px;', 'nav top');
desk = swap(desk, '  inset: 24px 22px 24px var(--kz-nav-page-x);', '  inset: 46px 14px 14px calc(var(--kz-nav-page-x) + 14px);', 'frame inset');
desk = swap(desk, '  border-radius: 22px;\n  box-shadow: 0 0 0 400px', '  border-radius: 20px;\n  box-shadow: 0 0 0 400px', 'frame radius');

const extra = `
/* ---- Card slide on the calm workspace (2026-11-17) ----------------------
   Kamran asked for the page-slides-aside navigation back, opened only by the
   top-left sidebar button. At rest the page fills the frame with a 14px stage
   margin; the button slides it aside to uncover the dark nav lying behind it. */
@media (min-width: 640px) {
  :root[data-kz-calm][data-kz-nav] [data-contrib-shell] > div:has(> [data-tree-split], > [data-tree-group]) {
    padding-left: 14px;
  }
}
.kz-calm-search {
  transition: opacity 120ms ease;
}
:root:is([data-kz-nav="opening"], [data-kz-nav="open"]) .kz-calm-search {
  opacity: 0;
  pointer-events: none;
}
`;
const cssPath = path.join(pkg, 'src/theme.css');
let css = await readFile(cssPath, 'utf8');
if (css.includes('/* ---- Card navigation ---')) throw new Error('Card nav CSS already restored');
const calmCss = css.indexOf('/* ---- Woday-inspired calm workspace');
if (calmCss < 0) throw new Error('Calm CSS not found');
// Card-nav rules sit before the calm section so the calm palette wins ties.
css = css.slice(0, calmCss) + desk + phone + css.slice(calmCss) + extra;
await writeFile(cssPath, css);
console.log('Restored click-triggered card slide on the calm workspace.');
