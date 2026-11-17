"""Build fixture from real theme bundle and documented Hermes slot markup.
Only the surrounding app/action adapter is a labelled test fixture.
"""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parent
bundle=(ROOT.parents[1]/'packages/theme/desktop/plugin.js').read_text()
script=bundle.replace("import { THEMES_AREA } from '@hermes/plugin-sdk';","const THEMES_AREA='themes';",1).replace('export const kaizenTheme','const kaizenTheme',1).replace('export default {','window.testPlugin = {',1)
# The rest of the compiled plugin is executed unchanged in real Chromium.
adapter='''
window.testActions=[];window.testCaptions=[];window.disposers=[];
window.hermesDesktop={setTitleBarTheme:x=>window.testCaptions.push(x)};
window.fixtureToggle=()=>{window.testActions.push('native.sidebar');const r=document.querySelector('.track-nav');r.hidden=!r.hidden};
window.ctx={register:c=>{window.testTheme=c.data;const s=document.createElement('style');s.id='actual-plugin-css';s.textContent=c.data.customCSS;document.head.append(s);document.documentElement.style.setProperty('--dt-font-sans',c.data.typography.fontSans);},listActions:()=>[{id:'nav.commandPalette'},{id:'view.toggleSidebar'}],runAction:id=>{window.testActions.push(id);if(id==='nav.commandPalette')document.querySelector('#command').showModal();else if(id==='view.toggleSidebar')window.fixtureToggle();return {ok:true}},addEventListener:(t,n,f,o)=>{t.addEventListener(n,f,o);window.disposers.push(()=>t.removeEventListener(n,f,o))},onDispose:f=>window.disposers.push(f),setTimeout:(f,ms)=>{const t=setTimeout(f,ms);return ()=>clearTimeout(t)},setInterval:(f,ms)=>{const t=setInterval(f,ms);window.disposers.push(()=>clearInterval(t));return ()=>clearInterval(t)}};
window.testPlugin.register(window.ctx);
document.querySelector('#native-toggle').onclick=window.fixtureToggle;
// Stand-in for Hermes's narrow overlay: the app answers reveal events with a
// left drawer at phone width. Only the attribute contract is emulated.
window.addEventListener('hermes:pane-toggle-reveal',e=>{const m=e.detail&&e.detail.mode;let o=document.querySelector('[data-narrow-overlay].left-0');if(m==='open'&&!o){o=document.createElement('div');o.setAttribute('data-narrow-overlay','');o.className='left-0';o.style.cssText='position:fixed;top:0;bottom:0;left:0;width:270px';o.innerHTML=document.querySelector('.rail').innerHTML;document.body.append(o)}else if(m==='close'&&o){o.remove()}});
window.disposePlugin=()=>{window.disposers.splice(0).reverse().forEach(f=>f())};
'''
css='''
html,body{height:100%;overflow:hidden} .shell{height:100%;display:flex;flex-direction:column}.live-layout{position:relative;display:flex;flex:1;min-height:0;min-width:0}.layout{height:100%;flex:1;min-height:0}.track-nav{display:flex;flex:0 1 252px;min-width:0}.track-nav[hidden]{display:none}.rail{width:100%;height:100%;padding-top:6px}.track-main{position:relative;display:flex;flex:1;min-width:0;min-height:0;padding-left:10px}.workspace{height:100%;min-height:0}.workspace>[data-chat-surface]{height:100%;width:100%;display:flex;flex-direction:column;min-height:0}.native-tool{width:24px;height:24px;display:grid;place-items:center;color:inherit}.native-caption{position:fixed;top:4px;right:10px;z-index:70;color:#92958d;font-size:11px}.fixture-label{position:fixed;bottom:2px;left:6px;color:#92958d;font-size:9px;z-index:80;pointer-events:none}.track-main header button>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.track-main header>div{min-width:0;overflow:hidden}.native-cluster{position:fixed;z-index:70;top:5px;height:24px;display:flex}.thread{min-height:0}
@media(max-width:639.98px){.track-nav{display:none}.track-main{padding:0}.native-tool{width:44px;height:44px}.native-cluster{top:0;height:44px}.native-caption{display:none}.thread{padding-top:24px}.rail{width:252px}} 
'''
for mode in ['light','dark']:
 html=(ROOT/f'current-{mode}.html').read_text()
 html=html.replace('<link rel="stylesheet" href="baseline.css">','')
 a=html.index('<div class="evidence">');b=html.index('<div class="shell"',a)
 html=html[:a]+html[b:]
 a=html.index('<div class="chrome">');b=html.index('<div class="layout"',a)
 html=html[:a]+html[b:]
 html=html.replace('<div class="layout" data-tree-split="horizontal">','<div class="live-layout"><div class="layout" data-tree-split="horizontal">',1)
 html=html.replace('<aside class="rail"','<div class="track-nav"><aside class="rail"',1).replace('</aside>','</aside></div>',1)
 html=html.replace('<div class="conversation">','<div class="conversation" data-slot="aui_thread-content">',1)
 html=html.replace('<main class="workspace" data-tree-group="main">','<div class="track-main"><main class="workspace" data-tree-group="main"><div data-chat-surface>',1)
 a=html.index('<header class="page-head">');b=html.index('</header>',a)+len('</header>')
 header='<header class="relative flex h-(--titlebar-height) w-full min-w-0 shrink-0 items-center border-b bg-(--ui-chat-surface-background)"><div class="min-w-0 flex-1 overflow-hidden"><button data-slot="button" class="pointer-events-auto" aria-label="Session menu"><span>A clearer way to work</span><span class="codicon codicon-chevron-down"></span></button></div></header>'
 html=html[:a]+header+html[b:]
 html=html.replace('</main></div></div>','</div></main></div></div></div></div>',1)
 # Remove preview JS and use only minimal native app adapter + actual plugin.
 a=html.index('<script>');b=html.index('</script>',a)+len('</script>')
 html=html[:a]+html[b:]
 html=html.replace('</head>',f'<style>{css}</style></head>')
 tools='<div class="native-cluster" data-titlebar-cluster="left" style="left:14px"><button id="native-toggle" class="native-tool" aria-label="Hide sidebar"><span class="codicon codicon-layout-sidebar-left">☰</span></button></div><div class="native-cluster" data-titlebar-cluster="right" style="right:150px"><button class="native-tool" aria-label="Settings">⚙</button></div><div class="native-caption">—　□　×</div><div class="fixture-label">IMPLEMENTED BUNDLE · REAL CSS + CONTROLLER · SAMPLE APP ADAPTER</div>'
 html=html.replace('</body>',tools+'<script>'+script+'\n'+adapter+'</script></body>')
 (ROOT/f'implemented-{mode}.html').write_text(html)
print('Built implementation fixtures from exact staged bundle')
