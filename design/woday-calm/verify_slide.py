"""Exercise the restored click-only card slide in real Chromium.
Runs the exact built bundle against source-based Hermes markup.
"""
import asyncio,base64,json,subprocess,urllib.request,hashlib
from pathlib import Path
import websockets
ROOT=Path(__file__).resolve().parent
PROFILE=ROOT/'slide-test-profile'
STATE="document.documentElement.getAttribute('data-kz-nav')"
MAINX="document.querySelector('.track-main').getBoundingClientRect().x"
async def main():
 (PROFILE/'DevToolsActivePort').unlink(missing_ok=True)
 proc=subprocess.Popen(['/usr/bin/chromium','--headless=new','--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',f'--user-data-dir={PROFILE}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  p=PROFILE/'DevToolsActivePort'
  for _ in range(100):
   if p.exists():break
   await asyncio.sleep(.1)
  port=int(p.read_text().splitlines()[0]);pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'));page=next(x for x in pages if x['type']=='page')
  async with websockets.connect(page['webSocketDebuggerUrl'],max_size=None,proxy=None) as ws:
   mid=0
   async def cdp(m,params=None):
    nonlocal mid
    mid+=1;i=mid;await ws.send(json.dumps({'id':i,'method':m,'params':params or {}}))
    while True:
     r=json.loads(await ws.recv())
     if r.get('id')==i:
      if 'error' in r:raise RuntimeError(r['error'])
      return r.get('result',{})
   async def js(e):
    r=await cdp('Runtime.evaluate',{'expression':e,'returnByValue':True,'awaitPromise':True})
    if r.get('exceptionDetails'):raise RuntimeError(r['exceptionDetails'])
    return r.get('result',{}).get('value')
   async def click(sel,touch=False):
    b=await js(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
    if touch:
     await cdp('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':b[0],'y':b[1]}]})
     await cdp('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:
     for t in ('mousePressed','mouseReleased'):
      await cdp('Input.dispatchMouseEvent',{'type':t,'x':b[0],'y':b[1],'button':'left','clickCount':1})
   async def key(k,code,vk):
    text={'Enter':'\r'}.get(k)
    await cdp('Input.dispatchKeyEvent',{'type':'keyDown' if text else 'rawKeyDown','key':k,'code':code,'windowsVirtualKeyCode':vk,**({'text':text} if text else {})})
    await cdp('Input.dispatchKeyEvent',{'type':'keyUp','key':k,'code':code,'windowsVirtualKeyCode':vk})
   async def shot(name):
    s=await cdp('Page.captureScreenshot',{'format':'png'});(ROOT/name).write_bytes(base64.b64decode(s['data']))
   await cdp('Page.enable');await cdp('Runtime.enable')
   await cdp('Page.addScriptToEvaluateOnNewDocument',{'source':"window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)))"})
   results=[]
   for width,height in [(1024,860),(1440,960)]:
    await cdp('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
    await cdp('Emulation.setTouchEmulationEnabled',{'enabled':False})
    for mode in ('light','dark'):
     await cdp('Page.navigate',{'url':(ROOT/f'implemented-{mode}.html').as_uri()});await asyncio.sleep(.5)
     await js('document.fonts.ready.then(()=>true)')
     c={}
     assert await js(STATE)=='closed'
     rest=await js(MAINX); assert abs(rest-14)<2,rest; c['rest_page_inset_14px']=True
     assert await js("getComputedStyle(document.querySelector('.rail')).visibility")=='hidden'
     # 1. Mouse click on the top-left toggle animates the page aside.
     await click('#native-toggle'); await asyncio.sleep(.1)
     mid_state=await js(STATE); mid_x=await js(MAINX)
     assert mid_state=='opening' and rest+20<mid_x<rest+322-20,(mid_state,mid_x); c['click_animates_midflight']=True
     await asyncio.sleep(.7)
     assert await js(STATE)=='open'; ox=await js(MAINX); assert abs(ox-(rest+322))<2,ox
     assert await js("getComputedStyle(document.querySelector('.rail')).visibility")=='visible'
     assert await js("testActions.includes('native.sidebar')") is False; c['native_toggle_not_also_run']=True
     assert await js("getComputedStyle(document.querySelector('.kz-calm-search')).opacity")=='0'; c['search_steps_aside']=True
     if width==1440: await shot(f'slide-open-{mode}-1440.png')
     # 2. Second click on the same button slides it home.
     await click('#native-toggle'); await asyncio.sleep(.65)
     assert await js(STATE)=='closed' and abs(await js(MAINX)-rest)<2; c['click_closes']=True
     # 3. Nothing but the button closes it: page press, composer typing (Enter
     #    included), Escape and a nav pick all leave it open, and the page stays usable.
     await click('#native-toggle'); await asyncio.sleep(.7)
     assert await js(STATE)=='open'
     focus_after_click=await js("document.activeElement && (document.activeElement.className||document.activeElement.id)")
     assert 'navrow' not in str(focus_after_click),focus_after_click; c['click_open_keeps_focus_out_of_nav']=True
     await cdp('Input.dispatchMouseEvent',{'type':'mousePressed','x':width-200,'y':height//2,'button':'left','clickCount':1})
     await cdp('Input.dispatchMouseEvent',{'type':'mouseReleased','x':width-200,'y':height//2,'button':'left','clickCount':1})
     await asyncio.sleep(.4); assert await js(STATE)=='open'; c['page_press_stays_open']=True
     await click('#message'); await asyncio.sleep(.05)
     assert await js("document.activeElement.id")=='message'; c['composer_usable_while_open']=True
     await cdp('Input.insertText',{'text':'hello there'})
     await key('Enter','Enter',13)
     await js("(()=>{const b=document.querySelector('#native-toggle');const l=b.getAttribute('aria-label')||'Hide sidebar';b.setAttribute('aria-label',l.split(' · ')[0]+' · 3 unread sessions')})()")
     await asyncio.sleep(.4); assert await js(STATE)=='open'; c['typing_and_send_stay_open']=True
     assert 'hello there' in await js("document.querySelector('#message').value"); c['typing_reaches_composer']=True
     await key('Escape','Escape',27); await asyncio.sleep(.3)
     assert await js(STATE)=='open'; c['escape_stays_open']=True
     await click('.navrow'); await asyncio.sleep(.4)
     assert await js(STATE)=='open'; c['nav_pick_stays_open']=True
     # Seamless landing: freeze the closing motion 1ms before its end, then let it
     # land, and compare the two frames.
     await click('#native-toggle'); await asyncio.sleep(.03)
     assert await js(STATE)=='closing'
     await js("document.getAnimations().forEach(a=>{a.pause();a.currentTime=a.effect.getComputedTiming().endTime-1})")
     await asyncio.sleep(.1)
     a=await cdp('Page.captureScreenshot',{'format':'png'})
     hole=await js("(()=>{const r=document.querySelector('.kz-nav-frame').getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})()")
     await js("document.getAnimations().forEach(a=>a.finish())"); await asyncio.sleep(.5)
     assert await js(STATE)=='closed'
     b=await cdp('Page.captureScreenshot',{'format':'png'})
     from PIL import Image, ImageChops; import io
     ia=Image.open(io.BytesIO(base64.b64decode(a['data']))).convert('RGB'); ib=Image.open(io.BytesIO(base64.b64decode(b['data']))).convert('RGB')
     diff=ImageChops.difference(ia,ib).convert('L').point(lambda v:255 if v>24 else 0)
     changed=sum(1 for v in diff.getdata() if v)
     card=await js("document.querySelector('[data-contrib-shell] > div > [data-tree-split] > div:not(:has([data-tree-tab=sessions])) [data-tree-group]').getBoundingClientRect().left")
     assert abs(hole[0]-card)<1 and abs(hole[1]-46)<1 and abs(hole[2]-(width-14))<1 and abs(hole[3]-(height-14))<1,hole
     if changed >= width*height*0.002:
      ia.save(ROOT/'land-a.png');ib.save(ROOT/'land-b.png');diff.save(ROOT/'land-diff.png')
     assert changed < width*height*0.002,(changed,diff.getbbox())
     c['landing_matches_rest']=True; c['landing_changed_px']=changed
     # 4. Keyboard on the button: no animation, instant move.
     await js("document.querySelector('#native-toggle').focus();window.sawInstant=false;window.instantWatch=new MutationObserver(()=>{if(document.documentElement.hasAttribute('data-kz-nav-instant'))window.sawInstant=true});instantWatch.observe(document.documentElement,{attributes:true,attributeFilter:['data-kz-nav-instant']})")
     await key('Enter','Enter',13); await asyncio.sleep(.25)
     assert await js("window.sawInstant"),('keyboard move was not instant',await js(STATE),await js("document.activeElement&&document.activeElement.id"))
     assert await js(STATE)=='open'; c['keyboard_is_instant']=True
     await js("instantWatch.disconnect()")
     await key('Escape','Escape',27); await asyncio.sleep(.2)
     assert await js(STATE)=='open'
     await js("document.querySelector('#native-toggle').focus()")
     await key('Enter','Enter',13); await asyncio.sleep(.3)
     assert await js(STATE)=='closed'; c['keyboard_button_closes']=True
     # 5. Hovering the edge or the toggle never opens it.
     for x,y in ((2,height//2),(26,17),(160,height//2)):
      await cdp('Input.dispatchMouseEvent',{'type':'mouseMoved','x':x,'y':y})
     await asyncio.sleep(.5); assert await js(STATE)=='closed'; c['hover_does_not_open']=True
     # 6. Search pill still runs the native palette at rest.
     await click('.kz-calm-search'); await asyncio.sleep(.05)
     assert await js("document.querySelector('#command').open"); await js("document.querySelector('#command').close()"); c['search_runs_palette']=True
     if width==1440: await shot(f'slide-closed-{mode}-1440.png')
     assert not await js('fixtureErrors'),await js('fixtureErrors')
     results.append({'width':width,'mode':mode,'checks':c})
   # Phone: the native drawer still answers, the page slides fully off.
   await cdp('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':2,'mobile':True})
   await cdp('Emulation.setTouchEmulationEnabled',{'enabled':True,'maxTouchPoints':5})
   for mode in ('light','dark'):
    await cdp('Page.navigate',{'url':(ROOT/f'implemented-{mode}.html').as_uri()});await asyncio.sleep(.5)
    c={}
    await click('#native-toggle',touch=True); await asyncio.sleep(.8)
    assert await js(STATE)=='open' and await js("!!document.querySelector('[data-narrow-overlay].left-0')"); c['tap_opens_drawer']=True
    assert await js(MAINX)>=380; c['page_slides_off']=True
    if mode=='light': await shot('slide-open-light-390.png')
    await click('.kz-nav-rail',touch=True); await asyncio.sleep(.7)
    assert await js(STATE)=='closed' and await js(MAINX)<20; c['chat_rail_returns']=True
    assert not await js('fixtureErrors')
    results.append({'width':390,'mode':mode,'checks':c})
   receipt={'scope':'Exact built bundle in Chromium with source-based Hermes markup. Not a live client.','bundle_sha256':hashlib.sha256((ROOT.parents[1]/'packages/theme/desktop/plugin.js').read_bytes()).hexdigest(),'cases':results}
   (ROOT/'slide-qa.json').write_text(json.dumps(receipt,indent=2))
   print(json.dumps({'cases':len(results),'checks':sum(len(r['checks']) for r in results),'all':'PASS','bundle':receipt['bundle_sha256'][:16]},indent=2))
 finally:
  proc.terminate()
  try:proc.wait(timeout=8)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
if __name__=='__main__':asyncio.run(main())
