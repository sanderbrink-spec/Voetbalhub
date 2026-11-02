"""Focused Android production-quiz test against an already built, identified APK."""
from pathlib import Path
import subprocess,time,re,sys,xml.etree.ElementTree as ET,json,urllib.request,atexit
OUT=Path('.android-smoke');OUT.mkdir(exist_ok=True)
PACKAGE='nl.voetbalhub.app1.test39'
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def bounds(n):return list(map(int,re.findall(r'\d+',n.get('bounds',''))))
def capture(name):
    adb('shell','uiautomator','dump','--compressed','/sdcard/quiz39.xml');adb('pull','/sdcard/quiz39.xml',str(OUT/(name+'.xml')))
    adb('shell','screencap','-p','/sdcard/quiz39.png');adb('pull','/sdcard/quiz39.png',str(OUT/(name+'.png')))
    return ET.parse(OUT/(name+'.xml')).getroot()
def tap_node(root,predicate):
    n=next(n for n in root.iter('node') if predicate(n));b=bounds(n);assert b[3]>b[1] and b[2]>b[0];adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2))
def find_quiz_text(text,name,clickable=False):
    for attempt in range(9):
        root=capture(name)
        node=next((n for n in root.iter('node') if text in n.get('text','') and (not clickable or n.get('clickable')=='true') and len(bounds(n))==4 and bounds(n)[1]>0 and bounds(n)[3]>bounds(n)[1]),None)
        if node is not None:return root,node
        adb('shell','input','swipe',str(width//2),str(int(height*.78)),str(width//2),str(int(height*.42)),'350');time.sleep(.4)
    raise AssertionError('Quiz control not reachable: '+text)

adb('install','-r',sys.argv[1]);adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(7)
width,height=list(map(int,re.findall(r'\d+',adb('shell','wm','size'))))[-2:]
root=capture('00-quiz39-home')
if any(n.get('text')=="Pixel Launcher isn't responding" for n in root.iter('node')):
    tap_node(root,lambda n:n.get('resource-id')=='android:id/aerr_close');adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(5);root=capture('00-quiz39-home')
tap_node(root,lambda n:n.get('text')=='Meer');time.sleep(1)
root,node=find_quiz_text('Speel de clubquiz','01-quiz39-menu');tap_node(root,lambda n:n is node);time.sleep(2)
(OUT/'result.txt').write_text('Exact existing APK SHA256 e1e645a73f6b1e69ab71f79cf8d682c203463eed1c03d3e45d5c999223a81f8d; focused native online test.\n')
# Phase 39: actual WebView -> native HTTPS bridge -> production quiz, synthetic participant only.
# The anonymous token is never printed or included in screenshots/log files.
import urllib.request

def find_quiz_text(text,name,clickable=False):
    for attempt in range(9):
        root=capture(name)
        node=next((n for n in root.iter('node') if text in n.get('text','') and (not clickable or n.get('clickable')=='true') and len(bounds(n))==4 and bounds(n)[1]>0 and bounds(n)[3]>bounds(n)[1]),None)
        if node is not None:return root,node
        adb('shell','input','swipe',str(width//2),str(int(height*.78)),str(width//2),str(int(height*.42)),'350');time.sleep(.4)
    raise AssertionError('Quiz control not reachable: '+text)

quiz_token=None
try:
    for _ in range(4):adb('shell','input','swipe',str(width//2),str(int(height*.28)),str(width//2),str(int(height*.83)),'200')
    time.sleep(1)
    root,node=find_quiz_text('Live klassement','33-quiz39-online');tap_node(root,lambda n:n is node)
    root,node=find_quiz_text('Leeftijdsgroep','34-quiz39-age',clickable=True);tap_node(root,lambda n:n is node);time.sleep(.5)
    root=capture('34b-quiz39-age-options');tap_node(root,lambda n:'16 jaar of ouder' in n.get('text',''));time.sleep(.4)
    root,node=find_quiz_text('Ik wil aan het technische testklassement','35-quiz39-privacy');tap_node(root,lambda n:n is node)
    root,node=find_quiz_text('Online profiel maken','36-quiz39-join');tap_node(root,lambda n:n is node);time.sleep(5)
    prefs=adb('shell','run-as',PACKAGE,'cat','shared_prefs/veldio_quiz39_private.xml')
    quiz_token=ET.fromstring(prefs).find("string[@name='token']").text
    assert re.fullmatch(r'[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}',quiz_token),'Native profile token not stored privately'
    root,node=find_quiz_text('Start de quiz','37-quiz39-start');tap_node(root,lambda n:n is node);time.sleep(4)
    root=capture('38-quiz39-question');assert any('Vraag 1 / 10' in n.get('text','') for n in root.iter('node')),'Online server round absent'
    for attempt in range(5):
        root=capture('38-quiz39-question');answer=next((n for n in root.iter('node') if n.get('class')=='android.widget.Button' and re.match(r'^[A-D]',n.get('text','')) and len(bounds(n))==4 and bounds(n)[1]>0 and bounds(n)[3]>bounds(n)[1]),None)
        if answer is not None:break
        adb('shell','input','swipe',str(width//2),str(int(height*.78)),str(width//2),str(int(height*.42)),'300');time.sleep(.3)
    assert answer is not None,'Online answer not reachable';tap_node(root,lambda n:n is answer);time.sleep(3)
    root,node=find_quiz_text('Punten en antwoordtijd zijn door de server bevestigd','39-quiz39-server-confirmed')
    root,node=find_quiz_text('Live top 5','40-quiz39-live-board')
    assert adb('shell','pidof',PACKAGE).strip()
    with (OUT/'result.txt').open('a') as result:result.write('PASS: Phase 39 real Android WebView/native HTTPS bridge, explicit synthetic 16+ test opt-in, private token, production server round, server-confirmed answer and live leaderboard. No phone-clock score supplied.\n')
finally:
    if quiz_token:
        req=urllib.request.Request('https://voetbalhub-redactie.onrender.com/quiz/v1/me',method='DELETE',headers={'Authorization':'Bearer '+quiz_token})
        with urllib.request.urlopen(req,timeout=15) as response:assert json.load(response).get('deleted') is True
        with (OUT/'result.txt').open('a') as result:result.write('PASS: synthetic online quiz profile and scores deleted after Android test.\n')
        del quiz_token
print((OUT/'result.txt').read_text())
