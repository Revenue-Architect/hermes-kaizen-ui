"""Local Chromium render and mock-only QA. No gateway calls or live writes."""
import asyncio, base64, hashlib, json, subprocess, time, urllib.request
from pathlib import Path
import websockets
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
PROFILE=ROOT/'chromium-profile'
BASELINE=Path('/opt/data/desktop-plugins/00-kaizen-theme/plugin.js')
async def run():
 (PROFILE/'DevToolsActivePort').unlink(missing_ok=True)
 proc=subprocess.Popen(['/usr/bin/chromium','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',f'--user-data-dir={PROFILE}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(100):
   p=PROFILE/'DevToolsActivePort'
   if p.exists():break
   await asyncio.sleep(.1)
  else:raise RuntimeError('Chromium did not start')
  port=int(p.read_text().splitlines()[0])
  pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
  page=next(x for x in pages if x['type']=='page')
  async with websockets.connect(page['webSocketDebuggerUrl'],max_size=None,proxy=None) as ws:
   i=0
   async def cdp(method,params=None):
    nonlocal i
    i+=1;mid=i
    await ws.send(json.dumps({'id':mid,'method':method,'params':params or {}}))
    while True:
     msg=json.loads(await ws.recv())
     if msg.get('id')==mid:
      if 'error'in msg:raise RuntimeError(msg['error'])
      return msg.get('result',{})
   async def js(expr):
    r=await cdp('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
    if r.get('exceptionDetails'):raise RuntimeError(r['exceptionDetails'])
    return r.get('result',{}).get('value')
   async def shot(name):
    s=await cdp('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
    (ROOT/name).write_bytes(base64.b64decode(s['data']))
   await cdp('Page.enable');await cdp('Runtime.enable')
   results=[]
   for width,height,viewport in [(1280,920,'desktop'),(390,844,'phone')]:
    await cdp('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
    for mode in ['light','dark']:
     for variant in (['current','proposal'] if viewport=='desktop' else ['proposal']):
      await cdp('Page.navigate',{'url':(ROOT/f'{variant}-{mode}.html').as_uri()})
      await asyncio.sleep(.45)
      await js('document.fonts.ready.then(()=>true)')
      layout=await js('''(()=>{const $=s=>document.querySelector(s),b=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {overflow:document.documentElement.scrollWidth>innerWidth,viewport:[innerWidth,innerHeight],rail:getComputedStyle($('.rail')).backgroundColor,surface:getComputedStyle($('.workspace')).backgroundColor,text:getComputedStyle($('.assistant')).color,bubblePosition:getComputedStyle($('[data-slot="aui_user-message-root"]')).position,composer:b($('.composer-wrap')),workspace:b($('.workspace')),font:getComputedStyle(document.body).fontFamily,styleCount:document.styleSheets.length,ready:document.fonts.status}})()''')
      assert not layout['overflow'],(viewport,mode,variant,'horizontal overflow')
      assert layout['bubblePosition']=='relative',layout
      assert layout['composer']['y']+layout['composer']['h']<=height+1,layout
      assert layout['composer']['y']>height*.6,layout
      name=f'{variant}-{mode}-{viewport}.png';await shot(name)
      checks={'layout':True,'user_message_unpinned':True}
      expanded=await js("document.querySelector('.tool-row summary').click();document.querySelector('.tool-row details').open")
      assert expanded;checks['tool_expansion']=True
      await js("document.querySelector('.tool-row summary').click()")
      if viewport=='desktop':
       await js("document.querySelector('#search-open').click()")
       assert await js("document.querySelector('#command').open")
       await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
       assert not await js("document.querySelector('#command').open")
       checks['palette_open_close']=True
      else:
       await js("document.querySelector('#nav-toggle').click()")
       assert await js("getComputedStyle(document.querySelector('.rail')).display")=='flex'
       if mode=='light':await shot('proposal-light-phone-navigation.png')
       await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
       assert await js("getComputedStyle(document.querySelector('.rail')).display")=='none'
       checks['phone_menu_escape']=True
       await js("document.querySelector('#mobile-search').click()")
       assert await js("document.querySelector('#command').open")
       await js("document.querySelector('.dismiss').click()")
       checks['phone_search_open_close']=True
       targets=await js("['#nav-toggle','#mobile-search','.send','.tool-row summary'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {selector:s,width:r.width,height:r.height}})")
       assert all(t['width']>=44 and t['height']>=44 for t in targets),targets
       checks['main_phone_touch_targets_44px']=True
      assert await js("document.querySelector('.send').disabled")
      await js("const t=document.querySelector('#message');t.value='Mock interaction test';t.dispatchEvent(new Event('input'))")
      assert not await js("document.querySelector('.send').disabled")
      await js("document.querySelector('#sample-composer').requestSubmit()")
      assert await js("document.querySelector('.toast').textContent")=='Preview only. No message was sent.'
      assert await js("document.querySelector('.send').disabled")
      checks['composer_empty_enabled_mock_submit']=True
      results.append({'variant':variant,'mode':mode,'viewport':viewport,'screenshot':name,'layout':layout,'checks':checks})
   # Narrow edge sizes checked independently for proposed light/dark.
   edges=[]
   for width in [320,640,768,1024,1440]:
    await cdp('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':False})
    for mode in ['light','dark']:
     await cdp('Page.navigate',{'url':(ROOT/f'proposal-{mode}.html').as_uri()});await asyncio.sleep(.15)
     r=await js('''(()=>{const r=document.querySelector('.composer-wrap').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,composerWithin:r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.left>=0,bodyWidth:document.body.clientWidth}})()''')
     assert not r['overflow'] and r['composerWithin'],(width,mode,r)
     edges.append({'width':width,'mode':mode,**r})
   receipt={'scope':'mock-only rendering and interaction checks; not live Desktop/Webapp validation','results':results,'responsive_edges':edges,'production_unchanged':hashlib.sha256(BASELINE.read_bytes()).hexdigest()==json.loads((ROOT/'manifest.json').read_text())['deployed_sha256']}
   assert receipt['production_unchanged']
   (ROOT/'qa-receipt.json').write_text(json.dumps(receipt,indent=2))
   print(json.dumps({'renders':len(results),'responsive_edge_cases':len(edges),'all_checks':'PASS','production_unchanged':True,'outputs':str(ROOT)},indent=2))
 finally:
  proc.terminate()
  try:proc.wait(timeout=8)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
 for mode in ['light','dark']:
  a=Image.open(ROOT/f'current-{mode}-desktop.png').convert('RGB');b=Image.open(ROOT/f'proposal-{mode}-desktop.png').convert('RGB')
  out=Image.new('RGB',(a.width+b.width+16,a.height),(68,70,64));out.paste(a,(0,0));out.paste(b,(a.width+16,0));out.save(ROOT/f'comparison-{mode}.png')
 a=Image.open(ROOT/'proposal-light-phone.png').convert('RGB');b=Image.open(ROOT/'proposal-dark-phone.png').convert('RGB')
 out=Image.new('RGB',(a.width+b.width+16,a.height),(68,70,64));out.paste(a,(0,0));out.paste(b,(a.width+16,0));out.save(ROOT/'proposal-phone-pair.png')
if __name__=='__main__':asyncio.run(run())
