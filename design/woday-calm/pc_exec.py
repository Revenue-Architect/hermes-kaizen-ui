"""Task-scoped PowerShell-over-SSH helper; no credentials in argv."""
import base64,subprocess,sys
from pathlib import Path
if __name__=='__main__':
 script=Path(sys.argv[1]).read_text()
 encoded=base64.b64encode(script.encode('utf-16le')).decode()
 result=subprocess.run(['ssh','-F','/opt/data/.ssh/config','-o','ConnectTimeout=8','kamran-pc','powershell -NoProfile -EncodedCommand '+encoded],text=True,capture_output=True,timeout=90)
 print(result.stdout)
 if result.returncode:print(result.stderr,file=sys.stderr)
 raise SystemExit(result.returncode)
