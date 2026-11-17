"""Exercise exact compiled Kaizen plugin in Chromium against native slot fixtures."""
import asyncio,base64,json,subprocess,urllib.request,hashlib
from pathlib import Path
import websockets
ROOT=Path(__file__).resolve().parent
PROFILE=ROOT/'implementation-test-profile'
async def main():
 (PROFILE/'DevToolsActivePort').unlink(missing_ok=True)
 proc=subprocess.Popen(['/usr/bin/chromium','--headless=new','--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',f'--user-data-dir={PROFILE}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  p=PROFILE/'DevToolsActivePort'
  for _ in range(100):
   if p.exists():break
   await asyncio.sleep(.1)
  else:raise RuntimeError('Chromium failed to start')
  port=int(p.read_text().splitlines()[0]);pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'));page=next(x for x in pages if x['type']=='page')
  async with websockets.connect(page['webSocketDebuggerUrl'],max_size=None,proxy=None) as ws:
   mid=0
   async def cdp(m,params=None):
    nonlocal mid
    mid+=1;i=mid;await ws.send(json.dumps({'id':i,'method':m,'params':params or {}}))
    while True:
     r=json.loads(await ws.recv())
     if r.get('id')==i:
      if 'error'in r:raise RuntimeError(r['error'])
      return r.get('result',{})
   async def js(e):
    r=await cdp('Runtime.evaluate',{'expression':e,'returnByValue':True,'awaitPromise':True})
    if r.get('exceptionDetails'):raise RuntimeError(r['exceptionDetails'])
    return r.get('result',{}).get('value')
   await cdp('Page.enable');await cdp('Runtime.enable')
   await cdp('Page.addScriptToEvaluateOnNewDocument',{'source':"window.fixtureErrors=[];window.addEventListener('error',e=>fixtureErrors.push(e.message));window.addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)))"})
   results=[]
   for width,height in [(320,844),(390,844),(640,900),(768,900),(1024,920),(1440,960)]:
    await cdp('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
    for mode in ['light','dark']:
     await cdp('Page.navigate',{'url':(ROOT/f'implemented-{mode}.html').as_uri()});await asyncio.sleep(.35)
     await js('document.fonts.ready.then(()=>true)')
     info=await js('''(()=>{const $=s=>document.querySelector(s),b=s=>{const r=$(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};return {calm:document.documentElement.hasAttribute('data-kz-calm'),legacy:document.documentElement.hasAttribute('data-kz-nav'),nav:document.documentElement.getAttribute('data-kz-nav'),errors:fixtureErrors,rail:getComputedStyle($('.rail')).backgroundColor,selectedBg:getComputedStyle($('.navrow[data-active=true]')).backgroundColor,replyFont:getComputedStyle($('[data-slot="aui_assistant-message-content"]')).fontSize,canvas:getComputedStyle($('.workspace')).backgroundColor,composerRadius:getComputedStyle($('[data-slot="composer-surface"]')).borderRadius,userPosition:getComputedStyle($('[data-slot="aui_user-message-root"]')).position,mainTransform:getComputedStyle($('.workspace')).transform,bodyOverflow:document.documentElement.scrollWidth>innerWidth,workspace:b('.workspace'),composer:b('.composer-wrap'),search:b('.kz-calm-search'),searchHidden:$('.kz-calm-search').hidden}})()''')
     # The card slide is back by request: present, and at rest (closed).
     assert info['calm'] and info['legacy'] and info['nav']=='closed',info
     assert not info['errors'] and not info['bodyOverflow'],info
     assert info['rail']=='rgb(16, 17, 17)',info
     assert info['selectedBg']=='rgb(40, 43, 39)',info
     assert info['replyFont']==('14px' if width<640 else '15px'),info
     assert info['canvas']==('rgb(251, 251, 249)' if mode=='light' else 'rgb(27, 29, 27)'),info
     assert info['userPosition']=='relative' and info['mainTransform']=='none',info
     assert info['composer']['y']+info['composer']['h']<=height+1,info
     assert info['workspace']['x']>=0 and info['workspace']['x']+info['workspace']['w']<=width+1,info
     if width in [390,1440]:
      s=await cdp('Page.captureScreenshot',{'format':'png'});(ROOT/f'implemented-{mode}-{width}.png').write_bytes(base64.b64decode(s['data']))
     checks=['native_shell_geometry','dark_sidebar_both_modes','page_palette','unpinned_user_messages','slide_at_rest','no_runtime_errors']
     if not info['searchHidden']:
      await js("document.querySelector('.kz-calm-search').click()")
      assert await js("testActions.filter(x=>x==='nav.commandPalette').length") == 1
      assert await js("document.querySelector('#command').open")
      await js("document.querySelector('#command').close()")
      checks.append('search_dispatches_real_action_id_once')
     # The slide owns the top-left toggle now; its click/keyboard/landing contract
     # is exercised in verify_slide.py. Here: the stand-in for pages without it.
     if width<640 and not info['searchHidden']:
      assert info['search']['h']==44
     await js("window.savedToggle=document.querySelector('#native-toggle');savedToggle.remove();window.dispatchEvent(new Event('hermes:titlebar-chrome-changed'))")
     await asyncio.sleep(.07)
     if width>=640:
      assert await js("!!document.querySelector('.kz-nav-toggle')")
     await js("document.querySelector('[data-titlebar-cluster=left]').append(savedToggle);window.dispatchEvent(new Event('hermes:titlebar-chrome-changed'))")
     await asyncio.sleep(.07)
     assert await js("document.documentElement.getAttribute('data-kz-nav')")=='closed'
     checks.append('fallback_native_toggle_and_deduplication')
     await js("document.documentElement.setAttribute('data-hermes-theme','default')");await asyncio.sleep(.07)
     assert not await js("document.documentElement.hasAttribute('data-kz-calm')||!!document.querySelector('.kz-calm-search')")
     await js("document.documentElement.setAttribute('data-hermes-theme','kaizen')");await asyncio.sleep(.07)
     assert await js("document.querySelectorAll('.kz-calm-search').length") == 1
     checks.append('theme_switch_cleanup_and_reactivation')
     await js("disposePlugin();testPlugin.register(ctx)");await asyncio.sleep(.07)
     assert await js("document.querySelectorAll('.kz-calm-search').length") == 1
     checks.append('hot_reload_single_control')
     assert not await js('fixtureErrors'),await js('fixtureErrors')
     results.append({'width':width,'mode':mode,'measurements':info,'checks':checks})
   # Real controller startup while the app shell is still rendering.
   await js("disposePlugin();window.savedShell=document.querySelector('[data-contrib-shell]');savedShell.remove();testPlugin.register(ctx)")
   assert not await js("!!document.querySelector('.kz-calm-search')")
   await js("document.body.prepend(savedShell)");await asyncio.sleep(.5)
   assert await js("document.querySelectorAll('.kz-calm-search').length") == 1
   await js("disposePlugin();ctx.listActions=()=>[];testPlugin.register(ctx)");await asyncio.sleep(.1)
   assert not await js("!!document.querySelector('.kz-calm-search')")
   assert await js("document.documentElement.hasAttribute('data-kz-calm')")
   receipt={'scope':'Exact theme bundle executed in Chromium with source-based DOM and native-action adapter. Not a live client screenshot.','cases':results,'startup_shell_late':True,'old_client_without_actions':True,'bundle_sha256':hashlib.sha256((ROOT.parents[1]/'packages/theme/desktop/plugin.js').read_bytes()).hexdigest()}
   (ROOT/'implementation-qa.json').write_text(json.dumps(receipt,indent=2))
   print(json.dumps({'cases':len(results),'check_groups':sum(len(x['checks']) for x in results),'startup_shell_late':'PASS','older_client_fallback':'PASS','bundle_sha256':receipt['bundle_sha256']},indent=2))
 finally:
  proc.terminate()
  try:proc.wait(timeout=8)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
if __name__=='__main__':asyncio.run(main())
