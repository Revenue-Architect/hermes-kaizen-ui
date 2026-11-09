// Builds src/generated/openui-library.css from @openuidev/react-ui's *layered* stylesheet.
//
// Containment rules (see README "CSS containment"):
//  * Every rule is rewritten to start with the surface root `[data-openui-library]`
//    (or the portal root class that the library puts on its own portals), so no rule can
//    match anything outside an OpenUI surface.
//  * The stock `:root` token blocks are re-pointed at the surface; dark mode follows Desktop
//    (`:root[data-hermes-mode="dark"]`), never `prefers-color-scheme` or `:root`.
//  * Global @keyframes are renamed so they cannot collide with Desktop animations.
//  * Everything stays inside one named cascade layer so un-layered Desktop/theme CSS wins.
//  * Agent-chat chrome (sidebar, tool-call, model switcher, sources) is dropped: it is not part
//    of openuiLibrary.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import postcss from 'postcss';

export const SURFACE = '[data-openui-library]';
export const PORTAL = '.hermes-openui-portal';
const DARK = ':where(:root[data-hermes-mode="dark"])';
const LAYER = 'hermes-openui';
const KF = 'houi-';

const dir = 'node_modules/@openuidev/react-ui/dist/layered/styles/';
const read = (f) => readFileSync(dir + f, 'utf8');
const unusedFiles = ['agentInterface.css', 'toolCall.css', 'toolResult.css', 'modelSwitcher.css', 'sources.css', 'citation.css'];
const classesOf = (css) => { const out = new Set(); for (const m of css.matchAll(/\.(openui-[A-Za-z0-9_-]+)/g)) out.add(m[1]); return out; };
const used = classesOf(read('index.css'));
const exclusive = new Set();
for (const f of unusedFiles) for (const c of classesOf(read(f))) exclusive.add(c);
// A class is removable only if no library component stylesheet uses it.
const keep = new Set();
for (const f of ['accordion','button','buttons','calendar','callout','card','cardHeader','carousel','charts','checkBoxGroup','checkBoxItem','chips','codeBlock','compositeCardBlock','contextCardBlock','datePicker','editableTable','entityList','formControl','iconButton','iconTag','iconText','image','imageBlock','imageGallery','imageText','imageTextLarge','inlineHeader','inlineMarkdownRenderer','input','label','listBlock','listItem','markDownRenderer','metricIndicator','optionCards','overviewCardBlock','radioGroup','radioItem','sectionBlock','select','separator','shared','skeleton','slider','snippetCardBlock','sourceFaviconImage','steps','switchGroup','switchItem','table','tabs','tag','tagBlock','textArea','textBlock','textCallout','textContent','textContentWrapper','toggleGroup','toggleItem','tooltipWrapper','visualCardBlock'])
  for (const c of classesOf(read(f + '.css'))) keep.add(c);
const dropClasses = new Set([...exclusive].filter((c) => !keep.has(c)));
void used;

// Portal roots: the class sits on the portal's own root element.
const portalRoots = ['openui-select-content', 'openui-modal-root', 'openui-tooltip-content', 'openui-date-picker-renderer-floating-content', 'openui-gallery__modal', 'openui-citation-tooltip', 'openui-portal-tooltip'];

const css = read('index.css');
const root = postcss.parse(css);
const out = postcss.root();
const keyframeNames = new Set();
root.walkAtRules('keyframes', (r) => keyframeNames.add(r.params));

const tokenLight = [], tokenDark = [];
const layer = root.nodes.find((n) => n.type === 'atrule' && n.name === 'layer');
const rules = layer ? layer.nodes : root.nodes;

function rewriteSelector(sel) {
  sel = sel.trim();
  const forms = [`:is(${SURFACE}, ${PORTAL}) ${sel}`];
  // A portal root carries the scope class on the element itself: `.openui-modal-root.hermes-openui-portal`.
  const firstCompound = sel.split(/[\s>+~]/)[0];
  for (const c of portalRoots) {
    const m = new RegExp('\\.' + c.replace(/[-_]/g, (x) => '\\' + x) + '(?![\\w-])').exec(firstCompound);
    if (m) { forms.push(sel.slice(0, m.index + m[0].length) + PORTAL + sel.slice(m.index + m[0].length)); break; }
  }
  return forms;
}
function rename(decl) {
  if (!/^(-webkit-)?animation(-name)?$/.test(decl.prop)) return;
  decl.value = decl.value.replace(/[A-Za-z_][\w-]*/g, (w) => (keyframeNames.has(w) ? KF + w : w));
}
function processNode(node, into) {
  if (node.type === 'comment') return;
  if (node.type === 'atrule') {
    if (node.name === 'keyframes') {
      const k = node.clone({ params: KF + node.params });
      into.append(k);
      return;
    }
    if (node.name === 'media' && /prefers-color-scheme:\s*dark/.test(node.params)) {
      // stock dark token block: re-pointed below at Desktop's mode
      node.walkRules((r) => { if (r.selector.includes(':root')) tokenDark.push(...r.nodes.map((d) => d.clone())); });
      return;
    }
    const clone = node.clone({ nodes: [] });
    node.each((c) => processNode(c, clone));
    if (clone.nodes.length) into.append(clone);
    return;
  }
  if (node.type !== 'rule') return;
  const sels = node.selectors;
  if (sels.every((s) => s.trim().startsWith(':root'))) {
    for (const s of sels) {
      if (/data-openui-theme=(")?dark/.test(s)) tokenDark.push(...node.nodes.map((d) => d.clone()));
      else if (/:not\(\[data-openui-theme=(")?light/.test(s)) tokenDark.push(...node.nodes.map((d) => d.clone()));
      else tokenLight.push(...node.nodes.map((d) => d.clone()));
    }
    return;
  }
  const kept = sels.filter((s) => ![...s.matchAll(/\.(openui-[A-Za-z0-9_-]+)/g)].some((m) => dropClasses.has(m[1])));
  if (!kept.length) return;
  const clone = node.clone({ selectors: kept.flatMap(rewriteSelector) });
  clone.walkDecls(rename);
  into.append(clone);
}
const body = postcss.root();
for (const n of rules) processNode(n, body);

const retheme = (d) => { d.value = d.value.replace(/"Inter", sans-serif/g, 'var(--hoi-font)').replace(/"SFMono-Regular", Menlo, monospace/g, 'var(--hoi-mono)'); return d; };
const tokenRule = (selector, decls) => { const r = postcss.rule({ selector }); const seen = new Map(); for (const d of decls) seen.set(d.prop, d); for (const d of seen.values()) r.append(retheme(d)); return r; };
const layerNode = postcss.atRule({ name: 'layer', params: LAYER });
layerNode.append(tokenRule(`:is(${SURFACE}, ${PORTAL})`, tokenLight));
layerNode.append(tokenRule(`${DARK} :is(${SURFACE}, ${PORTAL})`, tokenDark));
body.each((n) => layerNode.append(n.clone()));
out.append(layerNode);
mkdirSync('src/generated', { recursive: true });
const kaizen = readFileSync('src/v2/kaizen.css', 'utf8');
const result = out.toString() + '\n' + kaizen;
writeFileSync('src/generated/openui-library.css', result);
writeFileSync('src/generated/library-css.ts', '// Generated by scripts/scope-css.mjs. Do not edit.\nexport const libraryCss = ' + JSON.stringify(result) + ';\n');
console.log('openui-library.css', result.length, 'bytes; dropped classes', dropClasses.size, 'keyframes', keyframeNames.size, 'light tokens', tokenLight.length, 'dark tokens', tokenDark.length);
