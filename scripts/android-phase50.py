"""Compiled APK, Android16 emulator: navigation, actual WebView bridge, favourites and offline behaviour.
No physical Samsung test claim. Never writes invented production fixtures or finals.
"""
from pathlib import Path
import subprocess,sys,os,re,time,json,urllib.request
import uiautomator2 as u2
import websocket
OUT=Path('.android-smoke');OUT.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT,timeout=40)
def wait_for(fn,seconds=30):
 end=time.time()+seconds
 while time.time()<end:
  try:
   v=fn()
   if v:return v
  except Exception:pass
  time.sleep(.5)
 raise AssertionError('Condition timed out')
sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT']);aapt=sorted(sdk.glob('build-tools/*/aapt'))[-1]
badging=subprocess.check_output([str(aapt),'dump','badging',sys.argv[1]],text=True);assert "versionName='4.50-test'" in badging
PACKAGE=re.search(r"package: name='([^']+)'",badging).group(1)
adb('install','-r',sys.argv[1]);device=u2.connect()
def launch():adb('shell','am','start','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(3)
def evaluate(expression,page):
 pid=adb('shell','pidof',PACKAGE).strip().split()[0];adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
 with urllib.request.urlopen('http://127.0.0.1:9222/json/list',timeout=5) as r:targets=json.load(r)
 target=next(t for t in targets if page in t.get('url',''));ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=20,suppress_origin=True)
 try:
  ws.send(json.dumps({'id':50,'method':'Runtime.evaluate','params':{'expression':expression,'returnByValue':True,'awaitPromise':True}}))
  while True:
   v=json.loads(ws.recv())
   if v.get('id')==50:
    assert not v.get('result',{}).get('exceptionDetails'),v
    return v.get('result',{}).get('result',{}).get('value')
 finally:ws.close()
checks=[];limits=['Android16 API36 emulator at S23 viewport; no physical Samsung S23.','Production data depends on deployment. Server persistence/deadlines/scoring independently tested with isolated Redis.','Separate preview package when original phase48 signer is unavailable.']
try:
 launch();device.screenshot().save(str(OUT/'home50.png'));assert device(text='Voorspellen').exists;checks.append('Home renders with direct prediction navigation')
 device(text='Voorspellen').click();page='predictions49.html';wait_for(lambda:evaluate("!!document.querySelector('#join')",page))
 assert evaluate("document.querySelector('#competition').value",page)=='eredivisie'
 # Real native identity connection; no production prediction or score manipulation.
 evaluate("document.querySelector('#eligible').checked=true;document.querySelector('#join').click();true",page)
 wait_for(lambda:evaluate("!document.querySelector('#game').hidden || /verbinding|beschikbaar/.test(document.querySelector('#status').textContent)",page),40)
 device.screenshot().save(str(OUT/'voorspellen50.png'));checks.append('Prediction WebView opens, Eredivisie default, native identity bridge responds')
 if evaluate("!document.querySelector('#game').hidden",page):
  assert evaluate("Array.from(document.querySelectorAll('[data-competition]')).length",page)==4
  checks.append('Server profile connected; 4 selected competition filters')
  # Delete only the emulator-created identity, avoiding production test-data residue.
  evaluate("QuizApi.request('delete').then(()=>true)",page)
 else:limits.append('Production identity unavailable during emulator run; failure UI observed, no production save claimed.')
 evaluate("document.querySelector('#startQuiz').click();true",page);wait_for(lambda:evaluate("!!document.querySelector('#start')",'clubquiz.html'));device.press('back');wait_for(lambda:evaluate("!!document.querySelector('#startQuiz')",page));checks.append('Quiz opens from predictions and Android back returns to predictions')
 device(text='Mijn Clubs').click();page='personal-hub.html';wait_for(lambda:evaluate("typeof setData==='function'",page))
 evaluate("toggleClub('FC Groningen');true",page);wait_for(lambda:evaluate("!savePending",page));assert evaluate("selected.has('FC Groningen')",page)
 device.screenshot().save(str(OUT/'mijn-clubs50.png'));adb('shell','am','force-stop',PACKAGE);launch();device(text='Mijn Clubs').click();wait_for(lambda:evaluate("typeof selected!=='undefined' && selected.has('FC Groningen')",page));checks.append('Favourite survives actual app process restart')
 assert evaluate("document.querySelectorAll('[data-club50]').length",page)>=3
 evaluate("document.querySelector('[data-section50=matches]').click();true",page);assert evaluate("!!document.querySelector('#club-matches50')",page);checks.append('Club match button reaches club fixture section')
 device(text='Wedstrijden').click();page='destinations39.html';wait_for(lambda:evaluate("document.body.dataset.section==='fixtures'",page));device.screenshot().save(str(OUT/'wedstrijden50.png'));assert evaluate("document.querySelectorAll('[data-comp50]').length",page)==4;checks.append('Compact matches page and competition filters render')
 adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');evaluate("document.querySelector('#refresh').click();true",page);time.sleep(16);device.screenshot().save(str(OUT/'offline50.png'));assert evaluate("document.documentElement.scrollWidth<=innerWidth",page);checks.append('Network loss keeps page usable without horizontal overflow');device.press('back');time.sleep(1);assert adb('shell','pidof',PACKAGE).strip();checks.append('Android back leaves the app responsive')
 report={'status':'PASS','apk':sys.argv[1],'package':PACKAGE,'version':'4.50-test','androidApi':36,'checks':checks,'limits':limits};(OUT/'phase50-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report))
except Exception as e:
 device.screenshot().save(str(OUT/'failure50.png'));(OUT/'phase50-failure.json').write_text(json.dumps({'status':'FAIL','error':str(e),'checks':checks,'limits':limits},indent=2));raise
finally:
 adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
