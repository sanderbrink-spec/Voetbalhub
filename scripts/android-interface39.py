"""Install final APK, traverse every destination and verify persistent local settings."""
from pathlib import Path
import subprocess,os,re,time,sys,xml.etree.ElementTree as ET,json,atexit
OUT=Path('.android-smoke');OUT.mkdir(exist_ok=True)
sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
aapt=sorted(sdk.glob('build-tools/*/aapt'))[-1]
badging=subprocess.check_output([str(aapt),'dump','badging',sys.argv[1]],text=True)
PACKAGE=re.search(r"package: name='([^']+)'",badging).group(1)
assert "versionName='4.47-interface39'" in badging

def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT,timeout=40)
def diagnostics():
 for label,args in [('logcat',('logcat','-d','-t','1200')),('activity',('shell','dumpsys','activity','activities'))]:
  try:(OUT/(label+'.txt')).write_text(adb(*args))
  except Exception:pass
atexit.register(diagnostics)
def bounds(n):return list(map(int,re.findall(r'\d+',n.get('bounds',''))))
def capture(name):
 for attempt in range(5):
  try:
   adb('shell','uiautomator','dump','--compressed','/sdcard/veldio39.xml');adb('pull','/sdcard/veldio39.xml',str(OUT/(name+'.xml')));root=ET.parse(OUT/(name+'.xml')).getroot();break
  except subprocess.CalledProcessError:
   if attempt==4:raise
   time.sleep(1)
 adb('shell','screencap','-p','/sdcard/veldio39.png');adb('pull','/sdcard/veldio39.png',str(OUT/(name+'.png')))
 return root

def find(text,name,exact=True,clickable=False,scroll=False):
 for attempt in range(10):
  root=capture(name)
  for n in root.iter('node'):
   values=[n.get('text',''),n.get('content-desc','')];b=bounds(n)
   if any(v==text if exact else text in v for v in values) and len(b)==4 and b[3]>b[1]>=0 and (not clickable or n.get('clickable')=='true'):return root,n
  if scroll and attempt in [1,3,5]:
   web=next((n for n in root.iter('node') if n.get('class')=='android.webkit.WebView'),None)
   if web is not None:
    b=bounds(web);x=(b[0]+b[2])//2;adb('shell','input','swipe',str(x),str(b[3]-80),str(x),str(b[1]+120),'500')
  time.sleep(.7)
 raise AssertionError('Missing control: '+text)
def tap(n):
 b=bounds(n);assert len(b)==4;adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2))
def launch():
 result=adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');assert 'Error:' not in result;time.sleep(3)

def back_home():
 adb('shell','input','keyevent','4');time.sleep(.6)
 root=capture('return-home')
 if any(n.get('text')=='MIJN VELDIO' for n in root.iter('node')):return
 if not any(n.get('text')=='MIJN VELDIO' for n in root.iter('node')):
  home=next((n for n in root.iter('node') if n.get('text')=='Home'),None)
  assert home is not None;tap(home)
 find('MIJN VELDIO','return-home')
subprocess.run([sys.executable,'scripts/android-test-accessibility.py'],check=True)
adb('install','-r',sys.argv[1]);adb('shell','am','force-stop',PACKAGE);launch()
root,node=find('MIJN VELDIO','39-home')
launcher=next((n for n in root.iter('node') if n.get('text')=="Pixel Launcher isn't responding"),None)
if launcher:
 close=next(n for n in root.iter('node') if n.get('resource-id')=='android:id/aerr_close');tap(close);launch();root,node=find('MIJN VELDIO','39-home')
labels=['Nieuws','Wedstrijden','Competities','Voorspellen','Club Quiz','Stadion van de Week','De Derde Helft',"Video's",'Standen','Clubs','Favorieten','Meldingen']
positions=[]
for label in labels:
 node=next((n for n in root.iter('node') if label in [n.get('text',''),n.get('content-desc','')] and n.get('clickable')=='true' and len(bounds(n))==4 and bounds(n)[3]>bounds(n)[1]>=0),None)
 assert node is not None,'Missing native tile: '+label
 positions.append(bounds(node))
assert len(set(b[1] for b in positions[:3]))==1,'First row misaligned'
assert len(set(b[0] for b in positions[::3]))==1,'Column misaligned'
assert len(set(b[1] for b in positions[::3]))==4,'Four rows missing'
assert all(any(n.get('text')==x for n in root.iter('node')) for x in ['Home','Column','Competities','Favorieten','Meer'])
checks=[]
for index,label in enumerate(labels):
 root,node=find(label,'39-home',clickable=True);tap(node);time.sleep(2)
 root=capture('39-destination-'+str(index+1))
 assert adb('shell','pidof',PACKAGE).strip(),label+' stopped app'
 if label=='Clubs':
  root,node=find('FC Groningen','39-clubs',exact=False,clickable=True);tap(node);root,node=find('Clubnieuws','39-club-profile',clickable=True)
 if label=='Meldingen':
  root,node=find('Voorkeuren opslaan','39-notifications',clickable=True);tap(node);time.sleep(1)
  pref=adb('shell','run-as',PACKAGE,'cat','shared_prefs/veldio_tools39.xml');assert 'clubNews' in pref and 'columns' in pref
 if label=='Voorspellen':
  # Actual approved production source can be empty; never inject demo fixtures here.
  root,node=find('Mijn voorspellingen','39-predictions')
 checks.append(label)
 back_home()
# Persist a favourite through a fresh process, offline.
root,node=find('Favorieten','39-home',clickable=True);tap(node);root,node=find('Club toevoegen +','39-favorites',exact=False,clickable=True);tap(node)
root,node=find('FC Groningen','39-picker',exact=False,clickable=True);tap(node);time.sleep(1)
xml=ET.fromstring(adb('shell','run-as',PACKAGE,'cat','shared_prefs/voethub.xml'));clubs=xml.find("set[@name='clubs']");assert clubs is not None and any(n.text=='FC Groningen' for n in clubs)
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');adb('shell','am','force-stop',PACKAGE);launch()
root,node=find('Favorieten','39-offline-home',clickable=True);tap(node);find('FC Groningen','39-favorites-persisted',exact=False)
back_home();root,node=find('Club Quiz','39-home',clickable=True);tap(node);root,node=find('Start de quiz','39-quiz-start',clickable=True,scroll=True);tap(node);time.sleep(1)
root=capture('39-quiz-question');buttons=[n for n in root.iter('node') if n.get('clickable')=='true' and n.get('text','').startswith(('A ','B ','C ','D '))]
# Quiz answer labels can use a newline between letter and text.
if not buttons:buttons=[n for n in root.iter('node') if n.get('clickable')=='true' and re.match(r'^[ABCD]\s',n.get('text',''))]
assert len(buttons)==4,'Offline quiz must expose four answer choices';tap(buttons[0]);time.sleep(1);find('Volgende vraag','39-quiz-answer',exact=False,clickable=True)
adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
log=adb('logcat','-d','-t','1500');assert not re.search(r'FATAL EXCEPTION:[\s\S]{0,350}Process: '+re.escape(PACKAGE),log),'App crash'
result={'apk':sys.argv[1],'package':PACKAGE,'version':'4.47-interface39','checks':['install','launch','3x4 grid','all twelve native bridge destinations','back navigation','notification SharedPreferences write','favourite SharedPreferences and cold-start offline persistence','offline quiz four choices and feedback','no observed app crash'],'destinations':checks,'limits':['No physical S23','No background push test','No invented production fixtures','News freshness and video playback are not asserted by this navigation test']}
(OUT/'interface39-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
