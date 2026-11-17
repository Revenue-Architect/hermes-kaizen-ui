"""Private Webapp smoke test using the gateway's owner-only loopback credential.
Prints only status and DOM facts, never the credential or a launch URL.
"""
import asyncio,base64,json,pathlib,re,subprocess,urllib.request,urllib.error
from pathlib import Path
import websockets
ROOT=Path(__file__).resolve().parent
PROFILE=ROOT/'webapp-live-profile'
async def main():
 token=Path('/opt/data/webapp/session-token').read_text().strip()
 if not re.fullmatch(r'[A-Za-z0-9_-]{43}',token):raise RuntimeError('Stored Webapp credential malformed; stopping')
 # Request a one-use launch link through the native authenticated endpoint.
 for path in ['/api/webapp/launch-link','/api/webapp/launch','/api/webapp/ticket','/api/webapp/socket-ticket?socket=gateway']:
  req=urllib.request.Request('http://127.0.0.1:9120'+path,headers={'X-Hermes-Session-Token':token},method='POST' if 'socket-ticket' not in path else 'POST')
  try:
   r=urllib.request.urlopen(req,timeout=5); body=json.loads(r.read() or b'{}'); print(path,'->',r.status,list(body)[:4]); 
  except urllib.error.HTTPError as e:print(path,'->',e.code)
  except Exception as e:print(path,'->',type(e).__name__)
if __name__=='__main__':asyncio.run(main())
