"""Exercise the compiled APK on API36: actual native bridge, production save/reopen, offline full quiz."""
from pathlib import Path
import subprocess,sys,os,re,time,json,urllib.request
import uiautomator2 as u2
import websocket
OUT=Path('.android-smoke');OUT.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT,timeout=40)
def wait_for(fn,seconds=25):
 end=time.time()+seconds
 while time.time()<end:
  try:
   result=fn()
   if result:return result
  except Exception:pass
  time.sleep(.5)
 raise AssertionError('Condition timed out: '+getattr(fn,'__name__','condition'))
sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT']);aapt=sorted(sdk.glob('build-tools/*/aapt'))[-1]
badging=subprocess.check_output([str(aapt),'dump','badging',sys.argv[1]],text=True);assert "versionName='4.49-test'" in badging
PACKAGE=re.search(r"package: name='([^']+)'",badging).group(1)
adb('install','-r',sys.argv[1]);device=u2.connect();adb('shell','am','start','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(4)
def open_tile(label):
 home=device(text='Home')
 if home.exists:home.click();time.sleep(1)
 for _ in range(8):
  tile=device(description='Menu: '+label)
  if tile.exists:tile.click();time.sleep(1);return
  device.swipe(.1,.8,.1,.25,.3)
 raise AssertionError('Missing tile: '+label)
def evaluate(expression,page):
 pid=adb('shell','pidof',PACKAGE).strip().split()[0];adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
 with urllib.request.urlopen('http://127.0.0.1:9222/json/list',timeout=5) as r:targets=json.load(r)
 target=next(t for t in targets if page in t.get('url',''));ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=15,suppress_origin=True)
 try:
  ws.send(json.dumps({'id':49,'method':'Runtime.evaluate','params':{'expression':expression,'returnByValue':True,'awaitPromise':True}}))
  while True:
   result=json.loads(ws.recv())
   if result.get('id')==49:
    assert not result.get('result',{}).get('exceptionDetails'),result
    return result.get('result',{}).get('result',{}).get('value')
 finally:ws.close()
checks=[];limits=['API36 emulator at S23 viewport; no physical Samsung S23.','Final scoring/cancellation use isolated HTTP/Redis integration tests; no invented production finals.']
try:
 # Retain legacy records across a real process restart.
 legacy='[{"fixtureId":"legacy49-device","label":"Legacy bewaard","home":2,"away":1,"kickoff":"2026-01-01T00:00:00Z","competition":"bundesliga"}]'
 adb('shell','run-as',PACKAGE,'mkdir','-p','shared_prefs');content='<map><string name="predictions">'+legacy.replace('&','&amp;').replace('"','&quot;')+'</string></map>'
 import base64
 encoded=base64.b64encode(content.encode()).decode();adb('shell',f'echo {encoded} | base64 -d | run-as {PACKAGE} tee shared_prefs/veldio_tools39.xml >/dev/null')
 adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(3)
 open_tile('Voorspellen');page='predictions49.html'
 wait_for(lambda:evaluate("!!document.querySelector('#join')",page));evaluate("document.querySelector('#eligible').checked=true;document.querySelector('#join').click();true",page)
 wait_for(lambda:evaluate("!!document.querySelector('[data-fixture]:enabled')",page),70)
 fixture=evaluate("(()=>{const b=document.querySelector('[data-choice=\"1\"]:enabled');const id=b.dataset.fixture;b.click();return id;})()",page)
 wait_for(lambda:evaluate("document.querySelector('.saved')?.textContent.includes('Opgeslagen: 1')",page))
 evaluate("document.querySelector('[data-choice=\"X\"]:enabled').click();true",page);wait_for(lambda:evaluate("document.querySelector('.saved')?.textContent.includes('Opgeslagen: X')",page))
 checks+=['actual JS-to-Java-to-production server prediction saved and changed before kickoff']
 adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(3);open_tile('Voorspellen')
 wait_for(lambda:evaluate("!!document.querySelector('[data-choice=\"X\"][aria-pressed=true]')",page))
 wait_for(lambda:evaluate("document.querySelector('#legacy').textContent.includes('Legacy bewaard')",page));checks+=['server prediction and legacy local record survive actual cold restart']
 assert evaluate("document.documentElement.scrollWidth<=innerWidth",page)
 evaluate("document.querySelector('[data-scope=round]').click();true",page);wait_for(lambda:evaluate("document.querySelector('#rank').textContent.includes('positie')",page));checks+=['round and season rankings render from server']
 # Remove the disposable test identity and its predictions after production verification.
 assert evaluate("QuizApi.request('delete').then(r=>r.deleted)",page);checks+=['test profile and prediction records removed after verification']
 open_tile('Club Quiz');page='clubquiz.html';wait_for(lambda:evaluate("!!document.querySelector('#start')",page))
 evaluate("document.querySelector('#practice').click();document.querySelector('#start').click();true",page)
 seen=[]
 for index in range(10):
  wait_for(lambda:evaluate("document.querySelectorAll('#answers button:not(:disabled)').length===4",page))
  result=evaluate("(()=>{const text=document.querySelector('#question').textContent,q=CLUBQUIZ_BANK.find(q=>q.question===text);if(!q)throw Error('Missing source question');const image=QuizImages49.get(q),photo=document.querySelector('#photo');if(!image&&!photo.hidden)throw Error('Random image shown');if(image&&!photo.src.endsWith(image.file))throw Error('Wrong image mapping');document.querySelectorAll('#answers button').forEach(b=>{if(b.querySelector('b').textContent===q.correct)b.click();});return q.id;})()",page);seen.append(result)
  wait_for(lambda:evaluate("!document.querySelector('#next').hidden",page));evaluate("document.querySelector('#next').click();true",page)
 wait_for(lambda:evaluate("!document.querySelector('#result').hidden",page));assert len(set(seen))==10
 assert evaluate("document.querySelector('#score').textContent==='10 / 10'",page)
 evaluate("document.querySelector('#again').click();true",page);assert evaluate("!document.querySelector('#setup').hidden",page)
 checks+=['offline ten-question round completed with four answers, correct feedback, ten correct answers and no duplicate questions','exact quiz image mapping or no image, full result and restart']
 # Verify exact diagram bindings even when random selection did not pick the three new questions.
 assert evaluate("QuizImages49.get({id:'rules49-centre-circle'}).file==='quiz49/rules49-centre-circle.webp'&&QuizImages49.get({id:'unknown'})===null",page)
 log=adb('logcat','-d','-t','1000');assert not re.search(r'FATAL EXCEPTION:[\s\S]{0,350}Process: '+re.escape(PACKAGE),log)
 report={'status':'PASS','apk':sys.argv[1],'version':'4.49-test','androidApi':36,'fixture':fixture,'checks':checks,'limits':limits};(OUT/'phase49-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report))
except Exception as error:
 (OUT/'phase49-failure.json').write_text(json.dumps({'status':'FAIL','error':str(error),'checks':checks,'limits':limits},indent=2));raise
