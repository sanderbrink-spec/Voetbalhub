"""Actual API36 navigation and offline persistence, extended with a real-source prediction."""
from pathlib import Path
source=Path('scripts/android-premium40.py').read_text().replace("'4.48-premium40'","'4.47-test'")
source=source.replace("'Standen','Favorieten','Mijn Club','Meer'","'Standen','Mijn Clubs','Clubgids','Meer'")
source=source.replace("if __name__=='__main__':exec", "source=source.replace(\"Video's\",\"Samenvattingen\").replace('Favorieten','Mijn Clubs')\nif __name__=='__main__':exec")
source=source.replace("if __name__=='__main__':exec","source=source.replace(\"find('Mijn voorspellingen','39-predictions')\",\"find('Mijn voorspellingen','39-predictions',scroll=True)\")\nif __name__=='__main__':exec")
exec(compile(source,'android-phase47-generated.py','exec'))
# Record a real prediction through the actual JavaScript -> Java bridge, not a demo fixture.
import urllib.request,websocket

def evaluate47(expression):
 pid=adb('shell','pidof',PACKAGE).strip().split()[0]
 adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
 with urllib.request.urlopen('http://127.0.0.1:9222/json/list',timeout=5) as r:targets=json.load(r)
 target=next(t for t in targets if 'destinations39.html' in t.get('url',''))
 ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=8,suppress_origin=True)
 try:
  ws.send(json.dumps({'id':47,'method':'Runtime.evaluate','params':{'expression':expression,'returnByValue':True}}))
  while True:
   result=json.loads(ws.recv())
   if result.get('id')==47:return result.get('result',{}).get('result',{}).get('value')
 finally:ws.close()
back_home();root,node=find('Menu: Voorspellen','47-predictions-open',clickable=True,scroll=True);tap(node)
for attempt in range(20):
 try:
  if evaluate47("!!document.querySelector('#prediction')"):break
 except Exception:pass
 time.sleep(1)
else:raise AssertionError('Real licensed upcoming fixture required for prediction acceptance')
result=evaluate47("(()=>{const e=document.querySelector('#fixture'),id=e.value;document.querySelector('#homeGoals').value='2';document.querySelector('#awayGoals').value='1';document.querySelector('#prediction').requestSubmit();return id;})()")
assert result and result.startswith('oldb-'),result
time.sleep(2)
prefs=adb('shell','run-as',PACKAGE,'cat','shared_prefs/veldio_tools39.xml');assert result in prefs
adb('shell','am','force-stop',PACKAGE);launch();prefs=adb('shell','run-as',PACKAGE,'cat','shared_prefs/veldio_tools39.xml');assert result in prefs
report=json.loads((OUT/'interface39-result.json').read_text());report['version']='4.47-test';report['androidApi']=36;report['checks']+=['real licensed upcoming fixture prediction via Java bridge','prediction persists after process restart'];report['limits']+=['Exact 3/1/0 scoring and kickoff boundaries covered by model/browser tests, not by waiting for a real final score'];(OUT/'phase47-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
