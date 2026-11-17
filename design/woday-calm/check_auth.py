import pathlib,re,urllib.request,urllib.error,sys
sys.path.insert(0,'/opt/hermes')
p=pathlib.Path('/opt/data/webapp/session-token')
print('token file exists',p.exists(),'mode',oct(p.stat().st_mode & 0o777) if p.exists() else None)
shape=re.compile(r'[A-Za-z0-9_-]{43}')
token=p.read_text().strip() if p.exists() else ''
print('shape_valid',bool(shape.fullmatch(token)))
for path in ['/api/desktop-plugins/list','/api/desktop-plugins/root']:
 req=urllib.request.Request('http://127.0.0.1:3978'+path)
 try:
  r=urllib.request.urlopen(req,timeout=4);print(path,'unauth ->',r.status)
 except urllib.error.HTTPError as e:print(path,'unauth ->',e.code)
