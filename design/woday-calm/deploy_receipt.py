import json,subprocess
from pathlib import Path
out={}
for name,path in [('deployed','/opt/data/desktop-plugins/00-kaizen-theme/plugin.js'),('staged','/opt/data/repos/hermes-kaizen-ui/packages/theme/desktop/plugin.js')]:
 b=Path(path).read_bytes();out[name]={'size':len(b),'sha256':__import__('hashlib').sha256(b).hexdigest()}
out['latest_commit']=subprocess.run(['git','-C','/opt/data/repos/hermes-kaizen-ui','log','-1','--format=%h %s'],capture_output=True,text=True).stdout.strip()
out['live_config']=json.loads(subprocess.run(['/opt/hermes/.venv/bin/hermes','config','get','display.skin'],capture_output=True,text=True).stdout.strip().splitlines()[-1]) if False else None
print(json.dumps(out,indent=2))
