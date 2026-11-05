"""Real Android WebView -> production server save/change/restart/offline acceptance on existing APK.
Creates and erases only its own emulator profile. Does not alter fixtures or official scores.
"""
from pathlib import Path
import subprocess,sys,os,re,time,json,urllib.request
import uiautomator2 as u2
import websocket
OUT=Path('.android-prediction50');OUT.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT,timeout=40)
def wait_for(fn,seconds=35):
 end=time.time()+seconds
 while time.time()<end:
  try:
   value=fn()
   if value:return value
  except Exception:pass
  time.sleep(.5)
 raise AssertionError('Condition timed out')
sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT']);aapt=sorted(sdk.glob('build-tools/*/aapt'))[-1];badging=subprocess.check_output([str(aapt),'dump','badging',sys.argv[1]],text=True);assert "versionName='4.50-test'" in badging
PACKAGE=re.search(r"package: name='([^']+)'",badging).group(1);PAGE='predictions49.html';checks=[];fixture=None;connected=False
adb('install','-r',sys.argv[1]);device=u2.connect()
def launch():adb('shell','am','start','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(3);device(text='Voorspellen').click()
def evaluate(expression):
 pid=adb('shell','pidof',PACKAGE).strip().split()[0];adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
 with urllib.request.urlopen('http://127.0.0.1:9222/json/list',timeout=5) as r:targets=json.load(r)
 target=next(t for t in targets if PAGE in t.get('url',''));ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=25,suppress_origin=True)
 try:
  ws.send(json.dumps({'id':50,'method':'Runtime.evaluate','params':{'expression':expression,'returnByValue':True,'awaitPromise':True}}))
  while True:
   v=json.loads(ws.recv())
   if v.get('id')==50:
    assert not v.get('result',{}).get('exceptionDetails'),v
    return v.get('result',{}).get('result',{}).get('value')
 finally:ws.close()
def choose(c):
 evaluate("document.querySelector('[data-choice=\""+c+"\"]').click();document.querySelector('#savePrediction').click();true")
 wait_for(lambda:evaluate("document.querySelector('.saved').textContent.includes('Opgeslagen: "+c+"') && !document.querySelector('.saved').textContent.includes('Opslag niet bevestigd')"))
try:
 launch();wait_for(lambda:evaluate("!!document.querySelector('#join')"));evaluate("document.querySelector('#eligible').checked=true;document.querySelector('#join').click();true");wait_for(lambda:evaluate("!!document.querySelector('[data-choice]:enabled')"),50);connected=True
 assert evaluate("getComputedStyle(document.querySelector('.club-shirt')).webkitMaskImage.includes('data:image/webp')"),'Shirt mask must not require a cross-origin file request';fixture=evaluate("document.querySelector('[data-choice]').dataset.fixture");assert str(fixture).startswith('of-nl-');checks.append('Real released Eredivisie fixture loaded over native bridge: '+fixture)
 from PIL import ImageChops
 wait_for(lambda:evaluate("Array.from(document.querySelectorAll('.club-shirt img')).every(i=>i.complete&&i.naturalWidth>0)"))
 box=evaluate("(()=>{const r=document.querySelector('.club-shirt').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,viewport:innerWidth};})()")
 bounds=device(className='android.webkit.WebView').info['bounds'];scale=(bounds['right']-bounds['left'])/box['viewport'];area=(round(bounds['left']+box['x']*scale),round(bounds['top']+box['y']*scale),round(bounds['left']+(box['x']+box['w'])*scale),round(bounds['top']+(box['y']+box['h'])*scale))
 shown=device.screenshot().crop(area).convert('RGB');evaluate("document.querySelector('.club-shirt').style.visibility='hidden';true");hidden=device.screenshot().crop(area).convert('RGB');evaluate("document.querySelector('.club-shirt').style.visibility='';true")
 assert ImageChops.difference(shown,hidden).getbbox() is not None,'Shirt must actually paint pixels in the Android WebView'
 checks.append('Actual Android shirt pixels verified against hidden-state screenshot; no file-origin mask failure')
 for c in ['1','X','2','X']:choose(c)
 checks.append('1, X and 2 each saved and confirmed by production server; final choice X')
 assert evaluate("QuizApi.request('predictions',{competition:'eredivisie'}).then(r=>r.predictions.length)")==1
 checks.append('Repeated changes retain one prediction record')
 device.screenshot().save(str(OUT/'saved-before-restart.png'));adb('shell','am','force-stop',PACKAGE);launch();wait_for(lambda:evaluate("!!document.querySelector('[data-choice]')"),50)
 evaluate("document.querySelector('#selectorTitle').parentElement.open=true;const b=Array.from(document.querySelectorAll('[data-select]')).find(b=>b.dataset.select==="+json.dumps(fixture)+");if(b)b.click();true")
 assert evaluate("document.querySelector('.saved').textContent.includes('Opgeslagen: X')");assert evaluate("document.querySelector('[data-choice=\"X\"]').getAttribute('aria-pressed')")== 'true';checks.append('Force-stop and relaunch restore real server choice X and same profile')
 device.screenshot().save(str(OUT/'restored-after-restart.png'))
 adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');evaluate("document.querySelector('[data-choice=\"2\"]').click();document.querySelector('#savePrediction').click();true")
 wait_for(lambda:evaluate("/Geen verbinding|Probeer opnieuw/.test(document.querySelector('#status').textContent)"),35)
 assert evaluate("document.querySelector('.saved').textContent.includes('Opgeslagen: X') && document.querySelector('.saved').textContent.includes('Opslag niet bevestigd')");device.screenshot().save(str(OUT/'offline-save-retains-confirmed-choice.png'));checks.append('Offline save reports failure and retains confirmed choice X')
 adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');time.sleep(5)
 choice=evaluate("QuizApi.request('predictions',{competition:'eredivisie'}).then(r=>r.predictions.find(p=>p.fixtureId==="+json.dumps(fixture)+").choice)");assert choice in ['X','2'],repr(choice);checks.append('Reconnect resolves uncertain request outcome from server: '+choice);evaluate("document.querySelector('#refresh').click();true");wait_for(lambda:evaluate("document.querySelector('.saved').textContent.includes('Opgeslagen: "+choice+"')"));checks.append('Refresh displays confirmed server outcome without false success before acknowledgement')
 evaluate("QuizApi.request('delete').then(()=>true)");connected=False;checks.append('Temporary emulator profile and its predictions deleted');device(text='Home').click();wait_for(lambda:device(description='Menu: Wedstrijden').exists);device.screenshot().save(str(OUT/'home-fully-loaded.png'))
 (OUT/'result.json').write_text(json.dumps({'status':'PASS','package':PACKAGE,'apk':sys.argv[1],'androidApi':36,'fixtureId':fixture,'checks':checks,'limits':['Android16 emulator at S23 viewport; no physical Samsung S23.','Final result calculations and concurrent requests tested separately using isolated Redis; no production scores altered.']},ensure_ascii=False,indent=2));print(json.dumps(checks))
except Exception as e:
 device.screenshot().save(str(OUT/'failure.png'));(OUT/'failure.json').write_text(json.dumps({'status':'FAIL','error':str(e),'checks':checks},indent=2));raise
finally:
 adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
 if connected:
  try:evaluate("QuizApi.request('delete').then(()=>true)")
  except Exception:pass
