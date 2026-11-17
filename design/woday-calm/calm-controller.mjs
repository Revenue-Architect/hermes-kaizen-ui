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
    if (result && !result.ok) ctx.host?.notify?.({ kind: 'warning', message: result.error });
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
