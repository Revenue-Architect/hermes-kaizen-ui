"""Inspect a private, isolated Webapp tab via native one-use launch link.
No passwords, long-lived tokens or launch URLs are printed.
"""
import asyncio,base64,json,re,subprocess,urllib.request
from pathlib import Path
import websockets
ROOT=Path(__file__).resolve().parent
PROFILE=ROOT/'live-webapp-profile'
async def main():
 cli=subprocess.run(['/opt/hermes/.venv/bin/hermes','webapp','--no-open','--skip-build'],capture_output=True,text=True,timeout=40)
 matches=re.findall(r'https?://[^\s<>\x1b]+/webapp/launch#[^\s\x1b]+',cli.stdout)
 if not matches:
  raise RuntimeError('Native Webapp launch did not provide a one-use link; exit '+str(cli.returncode))
 url=matches[-1]
 (PROFILE/'DevToolsActivePort').unlink(missing_ok=True)
 proc=subprocess.Popen(['/usr/bin/chromium','--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',f'--user-data-dir={PROFILE}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(150):
   p=PROFILE/'DevToolsActivePort'
   if p.exists():break
   await asyncio.sleep(.1)
  port=int(p.read_text().splitlines()[0]);pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
  page=next(x for x in pages if x['type']=='page')
  async with websockets.connect(page['webSocketDebuggerUrl'],proxy=None,max_size=None) as ws:
   mid=0
   async def cdp(method,params=None):
    nonlocal mid
    mid+=1;i=mid;await ws.send(json.dumps({'id':i,'method':method,'params':params or {}}))
    while True:
     m=json.loads(await ws.recv())
     if m.get('id')==i:
      if 'error' in m:raise RuntimeError(m['error'])
      return m.get('result',{})
   async def js(expr):
    r=await cdp('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
    if r.get('exceptionDetails'):raise RuntimeError(r['exceptionDetails'])
    return r.get('result',{}).get('value')
   await cdp('Page.enable');await cdp('Runtime.enable')
   await cdp('Emulation.setDeviceMetricsOverride',{'width':1440,'height':960,'deviceScaleFactor':1,'mobile':False})
   await cdp('Page.navigate',{'url':url});await asyncio.sleep(10)
   # If this fresh browser hasn't chosen Kaizen, only set this isolated tab's
   # native saved theme key after discovering the actual appearance store.
   info=await js('''(()=>({title:document.title,path:location.pathname,theme:document.documentElement.getAttribute('data-hermes-theme'),mode:document.documentElement.getAttribute('data-hermes-mode'),shell:!!document.querySelector('[data-contrib-shell]'),slots:[...document.querySelectorAll('[data-slot]')].map(x=>x.dataset.slot).filter((x,i,a)=>a.indexOf(x)===i),buttons:[...document.querySelectorAll('[data-titlebar-cluster] button')].map(x=>({label:x.getAttribute('aria-label'),title:x.title,text:x.textContent})),tree:[...document.querySelectorAll('[data-tree-group]')].map(x=>({group:x.dataset.treeGroup,host:x.dataset.paneHost,tab:x.querySelector('[data-tree-tab]')?.getAttribute('data-tree-tab'),box:{x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}})),storageKeys:Object.keys(localStorage).filter(k=>/theme|appearance|mode/.test(k))}))()''')
   (ROOT/'live-inspection.json').write_text(json.dumps(info,indent=2))
   shot=await cdp('Page.captureScreenshot',{'format':'png'});(ROOT/'live-initial.png').write_bytes(base64.b64decode(shot['data']))
   print(json.dumps(info,indent=2))
 finally:
  proc.terminate()
  try:proc.wait(timeout=8)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
if __name__=='__main__':asyncio.run(main())
