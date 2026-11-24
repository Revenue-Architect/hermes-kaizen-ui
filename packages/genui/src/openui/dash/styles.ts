// Dashboard surface CSS. Every selector is under [data-openui-dashboard] or a dashboard portal
// (react-components names them openui-theme-portal-<id>); nothing matches the rest of Desktop.
// Un-layered on purpose: it must beat the component rules, which the build puts in the hermes-openui layer.
// Cards follow the active Desktop theme: no stripes, no hairline row dividers.
export const DASH_STYLE_ID = 'hermes-openui-dashboard-css';
const PORTAL = '[class*="openui-theme-portal-"]';

export const dashboardCss = `
:is([data-openui-dashboard], ${PORTAL}) {
  --hoi-brand: var(--kaizen-brand, var(--dt-primary-solid, var(--primary, #cc3027)));
  --hoi-brand-ink: var(--kaizen-brand-ink, var(--ui-accent-secondary, var(--hoi-brand)));
  --hoi-brand-soft: var(--kaizen-brand-soft, color-mix(in srgb, var(--hoi-brand) 12%, transparent));
  --hoi-on-brand: var(--dt-primary-solid-foreground, var(--primary-foreground, #fff));
  --hoi-ink: var(--kaizen-ink, var(--foreground, #18181b));
  --hoi-muted: var(--kaizen-muted, var(--muted-foreground, #666670));
  --hoi-surface: var(--kaizen-surface, var(--card, #fff));
  --hoi-ground: var(--kaizen-ground, var(--background, #f6f6f8));
  --hoi-soft: var(--kaizen-soft, var(--muted, #eeeef1));
  --hoi-line: var(--kaizen-line, var(--border, #e3e3e7));
  --hoi-field-line: color-mix(in srgb, var(--hoi-ink) 42%, var(--hoi-surface));
  --hoi-font: var(--dt-font-sans, "Segoe UI", system-ui, sans-serif);
  --hoi-mono: var(--dt-font-mono, "JetBrains Mono", "Cascadia Code", Consolas, monospace);
  --openui-dashboard-font-body: var(--hoi-font);
  --openui-dashboard-font-heading: var(--hoi-font);
  --openui-dashboard-font-label: var(--hoi-font);
  --openui-dashboard-font-numbers: var(--hoi-font);
  --openui-dashboard-font-code: var(--hoi-mono);
}
[data-openui-dashboard] {
  display: block; position: relative; min-width: 0; container-type: inline-size;
  color: var(--hoi-ink); font-family: var(--hoi-font); letter-spacing: -0.005em;
  background: var(--hoi-surface); border: 1px solid var(--hoi-line); border-radius: 16px; padding: 14px;
}
[data-openui-dashboard] *, [data-openui-dashboard] *::before, [data-openui-dashboard] *::after { box-sizing: border-box; }
[data-openui-dashboard] :focus-visible, ${PORTAL} :focus-visible { outline: 2px solid var(--hoi-brand-ink); outline-offset: 2px; }

/* A dashboard sits inside a chat message: undo what the message's markdown styling passes down. Its inherited
   overflow-wrap: anywhere lets a table squeeze a column to one letter per line, and its tables have margins. */
[data-openui-dashboard] { overflow-wrap: normal; }
[data-openui-dashboard] table { margin: 0 !important; }
[data-openui-dashboard] table th { white-space: nowrap; }
[data-openui-dashboard] table td, [data-openui-dashboard] table td * { white-space: normal; overflow-wrap: break-word; }
[data-openui-dashboard] table td { max-width: 340px; vertical-align: top; }
/* Tables: no zebra stripes, no hairline row dividers; rows separate by spacing and a soft hover. */
[data-openui-dashboard] table tr, [data-openui-dashboard] table tr:nth-child(even) { background: transparent; }
[data-openui-dashboard] table, [data-openui-dashboard] table thead, [data-openui-dashboard] table tbody, [data-openui-dashboard] table tr, [data-openui-dashboard] table td, [data-openui-dashboard] table th { border-color: transparent; box-shadow: none; }
[data-openui-dashboard] table tbody tr:hover { background: var(--hoi-soft); }
[data-openui-dashboard] table th { color: var(--hoi-muted); font-weight: 600; }

/* Status strip: loading, failed with a reason and Retry, or when the numbers are from. */
[data-openui-dashboard] .hod-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 10px; font-size: var(--kaizen-text-small, 12px); color: var(--hoi-muted); min-height: 20px; }
[data-openui-dashboard] .hod-status[data-state="failed"] { color: var(--hoi-brand-ink); }
[data-openui-dashboard] .hod-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: var(--hoi-soft); }
[data-openui-dashboard] .hod-status[data-state="failed"] .hod-pill { background: var(--hoi-brand-soft); }
[data-openui-dashboard] .hod-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
[data-openui-dashboard] .hod-status[data-state="loading"] .hod-dot { animation: hod-pulse 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { [data-openui-dashboard] .hod-status[data-state="loading"] .hod-dot { animation: none; } }
@keyframes hod-pulse { 50% { opacity: 0.25; } }
[data-openui-dashboard] .hod-retry { border: 0; border-radius: 999px; padding: 3px 12px; font: inherit; font-weight: 600; cursor: pointer; background: var(--hoi-brand); color: var(--hoi-on-brand); }
[data-openui-dashboard] .hod-retry:disabled { opacity: 0.5; cursor: default; }
[data-openui-dashboard][data-dim="true"] .hod-body { opacity: 0.55; transition: opacity 160ms ease; }

/* Guarded actions and notes (same look as other OpenUI surfaces). */
[data-openui-dashboard] .hermes-openui-guarded { display: inline-flex; max-width: 100%; opacity: 0.5; cursor: not-allowed; filter: grayscale(0.4); }
[data-openui-dashboard] .hermes-openui-guarded[data-openui-guard="unsupported"] { outline: 1px dashed color-mix(in srgb, var(--hoi-ink) 35%, transparent); outline-offset: 2px; border-radius: 999px; }
[data-openui-dashboard] .hermes-openui-guarded > * { pointer-events: none; }
[data-openui-dashboard] .hermes-openui-note { margin: 8px 0 0; padding: 8px 12px; border-radius: 10px; font-size: var(--kaizen-text-small, 13px); color: var(--hoi-muted); background: var(--hoi-soft); }
[data-openui-dashboard] .hermes-openui-note[data-kind="error"] { color: var(--hoi-brand-ink); background: var(--hoi-brand-soft); }
[data-openui-dashboard] .hermes-openui-image-fallback { display: inline-flex; padding: 2px 8px; border-radius: 8px; background: var(--hoi-soft); color: var(--hoi-muted); font-size: 12px; }
[data-openui-dashboard] [data-openui-link-disabled] { text-decoration: underline dotted; cursor: default; }
`;

// Per bundle evaluation: Desktop loads a new build before disposing the old one, and the old build's cleanup must
// only ever remove its own sheet.
const sheetId = DASH_STYLE_ID + '-' + Math.random().toString(36).slice(2, 10);
/** One shared <style> for every dashboard surface of this plugin build. */
export function acquireDashboardStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(sheetId)) return;
  const el = document.createElement('style');
  el.id = sheetId;
  el.setAttribute('data-hermes-plugin', 'hermes-openui');
  el.textContent = dashboardCss;
  document.head.appendChild(el);
}

/** Plugin dispose: remove this build's dashboard sheet. */
export function removeDashboardStyles(): void {
  if (typeof document !== 'undefined') document.getElementById(sheetId)?.remove();
}
