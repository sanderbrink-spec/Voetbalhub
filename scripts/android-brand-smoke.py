"""Android presentation and isolated quiz smoke test. Never publishes editorial content."""
from pathlib import Path
import re
import os
import subprocess
import sys
import time
import atexit
import xml.etree.ElementTree as ET

OUT=Path('.android-smoke');OUT.mkdir(exist_ok=True)
sdk = Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
aapt = sorted(sdk.glob('build-tools/*/aapt'))[-1]
badging = subprocess.check_output([str(aapt), 'dump', 'badging', sys.argv[1]], text=True)
match = re.search(r"package: name='([^']+)'", badging)
assert match, 'APK package identity missing'
PACKAGE = match.group(1)
assert PACKAGE in ('nl.voetbalhub.app1', 'nl.voetbalhub.app1.test', 'nl.voetbalhub.app1.test39', 'nl.voetbalhub.app1.test39b'), PACKAGE
if PACKAGE=='nl.voetbalhub.app1.test39b':assert "application-label:'Veldio 39b test'" in badging, 'Distinct test launcher label absent'
def adb(*args):
    return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def capture(name):
    if name=='01-start':
        adb('shell','screencap','-p','/sdcard/veldio.png')
        adb('pull','/sdcard/veldio.png',str(OUT/(name+'.png')))
        return None
    for attempt in range(4):
        try:
            adb('shell','uiautomator','dump','--compressed','/sdcard/veldio.xml')
            adb('pull','/sdcard/veldio.xml',str(OUT/(name+'.xml')))
            break
        except subprocess.CalledProcessError:
            if attempt==3: raise
            time.sleep(2)
    root=ET.parse(OUT/(name+'.xml')).getroot()
    visible=[n.get('text','')+' '+n.get('content-desc','') for n in root.iter('node')]
    assert not any(re.search(r'VoetbalHub',x,re.I) and 'https://' not in x for x in visible),visible
    adb('shell','screencap','-p','/sdcard/veldio.png')
    adb('pull','/sdcard/veldio.png',str(OUT/(name+'.png')))
    return root
def save_logcat():
    try:(OUT/'logcat.txt').write_text(adb('logcat','-d','-t','1200'))
    except Exception:pass
atexit.register(save_logcat)
adb('install','-r',sys.argv[1])
adb('shell','am','force-stop',PACKAGE)
result=adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
assert 'Error:' not in result,result
capture('01-start')
time.sleep(6)
root=capture('02-home')
# Recover only the known emulator Pixel Launcher system ANR, never an app ANR.
launcher_dialog=next((n for n in root.iter('node') if n.get('text')=="Pixel Launcher isn't responding"),None)
if launcher_dialog is not None:
    close=next(n for n in root.iter('node') if n.get('resource-id')=='android:id/aerr_close')
    b=list(map(int,re.findall(r'\d+',close.get('bounds',''))));adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2))
    adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(5);root=capture('02-home')
def bounds(node):return list(map(int,re.findall(r'\d+',node.get('bounds',''))))
logo=next(n for n in root.iter('node') if n.get('resource-id','').endswith('/logo'))
title=next(n for n in root.iter('node') if n.get('resource-id','').endswith('/title'))
search=next(n for n in root.iter('node') if n.get('content-desc')=='Zoeken')
assert bounds(logo)[2]<=bounds(title)[0], 'Logo overlaps title'
assert bounds(title)[2]<=bounds(search)[0], 'Title overlaps search'
assert bounds(logo)[3]-bounds(logo)[1]>bounds(search)[3]-bounds(search)[1], 'Official logo is not prominent'

assert adb('shell','pidof',PACKAGE).strip(),'Veldio is no longer running'
more=next((n for n in root.iter('node') if n.get('text')=='Meer'),None)
assert more is not None,'Bottom navigation Meer is missing'
coords=list(map(int,re.findall(r'\d+',more.get('bounds',''))));assert len(coords)==4
adb('shell','input','tap',str((coords[0]+coords[2])//2),str((coords[1]+coords[3])//2))
time.sleep(1)
root=capture('03-menu')
texts=[n.get('text','') for n in root.iter('node')]
assert any('Veldio' in x or 'VELDIO' in x for x in texts),texts
if not any('Alles voetbal. Eén plek.' in x for x in texts):
    size=list(map(int,re.findall(r'\d+',adb('shell','wm','size'))))[-2:];width,height=size
    adb('shell','input','swipe',str(width//2),str(int(height*.8)),str(width//2),str(int(height*.25)),'350')
    time.sleep(1);root=capture('04-menu-bottom');texts=[n.get('text','') for n in root.iter('node')]
assert any('Alles voetbal. Eén plek.' in x for x in texts),texts
assert adb('shell','pidof',PACKAGE).strip()
(OUT/'result.txt').write_text('PASS: install, launch, active process, home and Meer navigation; Veldio branding and slogan; no old visible brand. Android API 35 emulator. No content published.\n')
print((OUT/'result.txt').read_text())

# Synthetic cached UI data exists only in this disposable emulator.
# No production feed, rights register or API is modified by this scenario.
import json
from xml.sax.saxutils import escape
stamp = int(time.time() * 1000)
common = {'status': 'published', 'author': 'Veldio Test',
          'publishedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
          'standfirst': 'Fictieve inhoud voor een afzonderlijke Android-test.',
          'body': ['Eerste fictieve testalinea.', 'Tweede fictieve testalinea.', 'Derde fictieve testalinea.']}
columns = [{**common, 'id': 'android-test-column', 'type': 'column',
            'category': 'De Derde Helft', 'author': 'Sander Brink',
            'headline': 'Synthetische testcolumn'}]
feed = {'rightsPolicyVersion': 26, 'rightsExpiresAt': stamp + 1800000,
        'articles': [*columns, {**common, 'id': 'android-test-news',
                               'type': 'news', 'category': 'Eredivisie',
                               'headline': 'Synthetisch testartikel'}]}
(OUT/'synthetic-articles.json').write_text(json.dumps(feed))
adb('shell','am','force-stop',PACKAGE)
adb('shell','pm','clear',PACKAGE)  # Isolate this disposable fixture from an interrupted SharedPreferences backup.
preferences='<map><string name="last_articles">'+escape(json.dumps(feed,ensure_ascii=False))+'</string></map>'
(OUT/'editorial-cache.xml').write_text(preferences)
adb('push',str(OUT/'editorial-cache.xml'),'/data/local/tmp/veldio-cache.xml')
adb('shell','run-as',PACKAGE,'mkdir','-p','shared_prefs')
adb('shell','run-as',PACKAGE,'cp','/data/local/tmp/veldio-cache.xml','shared_prefs/voetbalhub_editorial.xml')
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
time.sleep(5)  # Android radio teardown is asynchronous; this fixture must be truly offline.
adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
time.sleep(4)
def tap_node(root,predicate):
    node=next((n for n in root.iter('node') if predicate(n)),None)
    assert node is not None,'Expected control missing'
    bounds=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
    adb('shell','input','tap',str((bounds[0]+bounds[2])//2),str((bounds[1]+bounds[3])//2))
root=capture('05-cache-home')
tap_node(root,lambda n:n.get('text')=='Column')
time.sleep(5)
root=capture('06-column')
assert any(n.get('content-desc')=='Sander Brink, auteur van De Derde Helft' for n in root.iter('node')),'Local portrait thumbnail missing'
tap_node(root,lambda n:n.get('text')==columns[0]['headline'])
time.sleep(2)
root=capture('07-column-reader')
assert any(n.get('text')=='Veldio' for n in root.iter('node')),'Veldio reader header missing'
assert any('Terug' in n.get('text','') for n in root.iter('node'))
tap_node(root,lambda n:'Terug' in n.get('text',''))
time.sleep(1);root=capture('08-back-to-column')
assert any(n.get('text')=='Nieuwste columns' for n in root.iter('node')),'Reader back did not restore column'
# Inspect a regular news reader as well as the column-specific reader.
tap_node(root,lambda n:n.get('text')=='Nieuws')
time.sleep(4)
headlines={a['headline'] for a in feed['articles'] if a not in columns}
for attempt in range(5):
    root=capture('09-news-list')
    target=next((n for n in root.iter('node') if n.get('text') in headlines),None)
    if target is not None:break
    adb('shell','input','swipe','450','1550','450','700','400');time.sleep(1)
assert target is not None,'Cached news card missing'
tap_node(root,lambda n:n is target)
time.sleep(2);root=capture('10-news-reader')
assert any(n.get('text')=='VOETBALNIEUWS' for n in root.iter('node')),'News reader identity missing'
tap_node(root,lambda n:n.get('text')=='A+')
tap_node(root,lambda n:'Bewaren' in n.get('text',''))
time.sleep(1);root=capture('11-news-saved')
assert any('Bewaard' in n.get('text','') for n in root.iter('node')),'Save callback missing'
tap_node(root,lambda n:'Bewaard' in n.get('text',''))
tap_node(root,lambda n:'Terug' in n.get('text',''))
time.sleep(1);capture('12-back-to-news')
adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
with (OUT/'result.txt').open('a') as result:
    result.write('PASS: synthetic isolated cache, local column portrait thumbnail, column and news readers, save toggle, font control and back navigation. Synthetic cached/offline UI scenario; does not verify live content, permissions or Android live networking.\n')
print((OUT/'result.txt').read_text())

def pref_timestamp():
    try:
        raw=adb('shell','run-as',PACKAGE,'cat','shared_prefs/voetbalhub_editorial.xml')
        root=ET.fromstring(raw)
        return next((int(n.get('value')) for n in root if n.get('name')=='last_fetch_at'),0)
    except Exception:return 0

# Read-only production fetch plus real native pull gesture. No test data is published.
import urllib.request
with urllib.request.urlopen('https://voetbalhub-redactie.onrender.com/articles',timeout=80) as response:
    live=json.load(response)
assert live.get('articles'),'Production feed unavailable'
latest=next(a['headline'] for a in live['articles'] if a.get('type')!='column' and a.get('category','').casefold() not in ('column','de derde helft'))
before=pref_timestamp()
adb('shell','am','force-stop',PACKAGE)
adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
time.sleep(5)
for attempt in range(28):
    time.sleep(3)
    if pref_timestamp()>before:break
assert pref_timestamp()>before,'Production feed fetch not persisted'
for attempt in range(8):
    root=capture('13-live-home')
    hero_ready=any('NIEUWSTE ARTIKEL' in n.get('text','') and latest in n.get('text','') for n in root.iter('node'))
    spotlight_ready=any('STADION VAN DE WEEK' in n.get('text','') or 'WEDSTRIJD VAN DE WEEK' in n.get('text','') for n in root.iter('node'))
    if hero_ready and spotlight_ready:break
    time.sleep(.6)
assert hero_ready and spotlight_ready,'Published home carousel or dynamic paired card did not render'
# Start at the top of the ScrollView, below the fixed category chips.
size=list(map(int,re.findall(r'\d+',adb('shell','wm','size'))))[-2:];width,height=size
before=pref_timestamp()
adb('shell','input','swipe',str(width//2),str(int(height*.32)),str(width//2),str(int(height*.72)),'650')
for attempt in range(28):
    time.sleep(3)
    if pref_timestamp()>before:break
assert pref_timestamp()>before,'Pull gesture did not complete a new API fetch'
capture('14-live-refreshed')
# Home retains its cached articles during loss of connectivity.
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
adb('shell','input','swipe',str(width//2),str(int(height*.32)),str(width//2),str(int(height*.72)),'650')
time.sleep(4);root=capture('15-live-offline')
assert any(latest in (n.get('text','')+' '+n.get('content-desc','')) for n in root.iter('node')),'Offline refresh removed the visible headline'
adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
assert adb('shell','pidof',PACKAGE).strip()
with (OUT/'result.txt').open('a') as result:
    result.write('PASS: read-only live production feed, newest published headline in home, native pull-to-refresh completes another API fetch, offline pull preserves cached headline. Android emulator, no physical S23 or publication claim.\n')
print((OUT/'result.txt').read_text())

# Phase 32: emulator viewport matches the S23 display geometry, not a physical device.
# Inspect the read-only live news rows and actual bundled photography in the reader.
for attempt in range(5):
    root=capture('16-phase32-feed')
    target=next((n for n in root.iter('node') if n.get('text')==latest and n.get('class')=='android.widget.TextView'),None)
    if target is not None:break
    adb('shell','input','swipe',str(width//2),str(int(height*.8)),str(width//2),str(int(height*.3)),'500');time.sleep(1)
assert target is not None,'Phase 32 native photo-led news row absent'
tap_node(root,lambda n:n is target)
time.sleep(2);root=capture('17-phase32-photo-reader')
assert any('Archiefbeeld' in n.get('text','') for n in root.iter('node')),'Archival context caption absent'
assert any('CC BY' in n.get('text','') for n in root.iter('node')),'Photograph licence attribution absent'
assert any(n.get('class')=='android.widget.ImageView' and n.get('content-desc')=='Afbeelding bij artikel' for n in root.iter('node')),'Bundled photograph not visible in reader'
tap_node(root,lambda n:'Terug' in n.get('text',''))
time.sleep(1);capture('18-phase32-back-to-feed')
assert adb('shell','pidof',PACKAGE).strip()
with (OUT/'result.txt').open('a') as result:
    result.write('PASS: Phase 32 native photo-led live feed, actual bundled image in reader, archival context, photographer/licence credit and back navigation. Emulator display geometry only, no physical S23 claim.\n')

# Phase 33: wait past the hard feed deadline, then navigate to the offline stadium archive.
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
time.sleep(22);root=capture('19-phase33-offline-home')
assert not any('Nieuws bijwerken' in n.get('text','') for n in root.iter('node')), 'Loading exceeded hard deadline'
assert not any('video’s laden' in n.get('text','') for n in root.iter('node')), 'Orphan video loader'
for attempt in range(4):
    if any('VOETBAL IN CIJFERS' in (n.get('text','')+' '+n.get('content-desc','')) for n in root.iter('node')):break
    adb('shell','input','swipe',str(width//2),str(int(height*.8)),str(width//2),str(int(height*.48)),'450');time.sleep(1);root=capture('19-phase33-offline-home')
assert any('VOETBAL IN CIJFERS' in (n.get('text','')+' '+n.get('content-desc','')) for n in root.iter('node')), 'Original football quiz absent after scrolling'

# Search in small increments: a full-screen fling can skip the short status bar.
for attempt in range(12):
    if any(n.get('text','').casefold()=='opnieuw proberen' for n in root.iter('node')):break
    adb('shell','input','swipe',str(width//2),str(int(height*.76)),str(width//2),str(int(height*.64)),'500');time.sleep(.6)
    root=capture('19b-phase33-offline-feed')
assert any(n.get('text','').casefold()=='opnieuw proberen' for n in root.iter('node')), 'Retry button absent after offline deadline'
assert not any(n.get('class')=='android.widget.ProgressBar' for n in root.iter('node')), 'Offline feed spinner never stopped'
tap_node(root,lambda n:n.get('text')=='Meer');time.sleep(1);root=capture('20-phase33-more')
tap_node(root,lambda n:n.get('text')=='Stadion van de week');time.sleep(2);root=capture('21-phase33-stadium-archive')
assert any('De Kuip' in (n.get('text','')+' '+n.get('content-desc','')) for n in root.iter('node')), 'Offline stadium archive missing'
tap_node(root,lambda n:n.get('class')=='android.widget.Button' and 'De Kuip' in (n.get('text','')+' '+n.get('content-desc','')))
time.sleep(2);root=capture('22-phase33-stadium-reader')
assert any('1' in n.get('text','') and 'woorden' in n.get('text','') for n in root.iter('node')), 'Long stadium feature missing'
adb('shell','input','keyevent','4');time.sleep(1);capture('23-phase33-stadium-back')
adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
with (OUT/'result.txt').open('a') as result:result.write('PASS: Phase 33 offline timeout, retained homepage, no video loader, original quiz, permanent stadium archive, long De Kuip reader and Android Back. Emulator only.\n')

# Real emulator cellular-only and throttled-network conditions, with existing news retained.
adb('shell','svc','wifi','disable');adb('shell','svc','data','enable')
adb('emu','network','speed','gsm');adb('emu','network','delay','gprs')
root=capture('24-before-slow-data');tap_node(root,lambda n:n.get('text')=='Nieuws');time.sleep(22)
root=capture('25-slow-cellular-home')
assert adb('shell','pidof',PACKAGE).strip()
assert not any('Nieuws bijwerken' in n.get('text','') for n in root.iter('node')), 'Slow network did not respect deadline'
adb('emu','network','speed','full');adb('emu','network','delay','none')
adb('shell','svc','wifi','enable');adb('shell','svc','data','disable')
with (OUT/'result.txt').open('a') as result:result.write('PASS: cellular-only emulator with GSM speed/GPRS latency does not block UI beyond the bounded refresh; Wi-Fi-only restored. No physical radio or physical S23 test.\n')

# Phase 35: separate club quiz is reachable without altering the homepage.
adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
time.sleep(3);root=capture('26-phase35-home');tap_node(root,lambda n:n.get('text')=='Meer')
time.sleep(1);root=capture('27-phase35-menu')
for attempt in range(4):
    if any(n.get('text')=='Speel de clubquiz' for n in root.iter('node')):break
    adb('shell','input','swipe',str(width//2),str(int(height*.75)),str(width//2),str(int(height*.35)),'400');time.sleep(1);root=capture('27-phase35-menu')
tap_node(root,lambda n:n.get('text')=='Speel de clubquiz');time.sleep(2);root=capture('28-phase35-quiz-setup')
assert any('655' in n.get('text','') and 'vragen' in n.get('text','') for n in root.iter('node')), 'Quiz bank not loaded'
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
for attempt in range(5):
    startnodes=[n for n in root.iter('node') if 'Start de quiz' in n.get('text','') and len(bounds(n))==4 and bounds(n)[1]>0 and bounds(n)[3]>bounds(n)[1]]
    if startnodes:break
    adb('shell','input','swipe',str(width//2),str(int(height*.8)),str(width//2),str(int(height*.4)),'400');time.sleep(1);root=capture('28-phase37-quiz-setup-scroll')
tap_node(root,lambda n:'Start de quiz' in n.get('text',''));time.sleep(1);root=capture('29-phase35-quiz-question')
assert any('Vraag 1 / 10' in n.get('text','') for n in root.iter('node')), 'First quiz question absent offline'
answers=[n for n in root.iter('node') if n.get('class')=='android.widget.Button' and re.match(r'^[A-D]',n.get('text',''))]
if not answers:
    answers=[n for n in root.iter('node') if n.get('class')=='android.widget.Button' and re.match(r'^[A-D](Eredivisie|Keuken|Premier|Bundesliga)',n.get('text',''))]
assert len(answers)==4, 'Four quiz answers not exposed'
tap_node(root,lambda n:n is answers[0]);time.sleep(1);root=capture('30-phase35-quiz-answer')
def visible_quiz_next(n):
    b=bounds(n)
    return 'Volgende vraag' in n.get('text','') and len(b)==4 and b[0]>=0 and b[1]>0 and b[2]>b[0] and b[3]>b[1]
# WebView accessibility also reports offscreen nodes with zero/inverted bounds.
# Finding the text alone is not evidence that the button can be tapped.
for attempt in range(5):
    if any(visible_quiz_next(n) for n in root.iter('node')):break
    adb('shell','input','swipe',str(width//2),str(int(height*.8)),str(width//2),str(int(height*.4)),'400');time.sleep(1);root=capture('30-phase35-quiz-answer')
assert any(visible_quiz_next(n) for n in root.iter('node')), 'Next quiz button not visible after scrolling'
tap_node(root,visible_quiz_next);time.sleep(1);root=capture('31-phase35-quiz-next')
assert any('Vraag 2 / 10' in n.get('text','') for n in root.iter('node')), 'Quiz progress not advanced'
adb('shell','input','keyevent','4');time.sleep(1);capture('32-phase35-quiz-back')
adb('shell','svc','wifi','enable')
assert adb('shell','pidof',PACKAGE).strip()
with (OUT/'result.txt').open('a') as result:result.write('PASS: Phase 35 separate Clubquiz under Meer, 655-question bank, four offline choices, answer feedback, progression and Android Back. Emulator only.\n')

# Phase 39: actual WebView -> native HTTPS bridge -> production quiz, synthetic participant only.
# The anonymous token is never printed or included in screenshots/log files.
import urllib.request

def find_quiz_text(text,name,clickable=False):
    for attempt in range(9):
        root=capture(name)
        node=next((n for n in root.iter('node') if text in n.get('text','') and (not clickable or n.get('clickable')=='true') and len(bounds(n))==4 and bounds(n)[1]>0 and bounds(n)[3]>bounds(n)[1]),None)
        if node is not None:return root,node
        adb('shell','input','swipe',str(int(width*.98)),str(int(height*.78)),str(int(width*.98)),str(int(height*.42)),'350');time.sleep(.4)
    raise AssertionError('Quiz control not reachable: '+text)

quiz_token=None
try:
    # Setup already scrolls to the top. Swipe the margin to avoid activating native selects.
    root=capture('32b-quiz39-ready')
    if any(n.get('class')=='android.widget.CheckedTextView' and 'Snelle aftrap' in n.get('text','') for n in root.iter('node')):
        adb('shell','input','keyevent','4');time.sleep(.5)
    root,node=find_quiz_text('Live klassement','33-quiz39-online');tap_node(root,lambda n:n is node)
    root,node=find_quiz_text('Leeftijdsgroep','34-quiz39-age',clickable=True);tap_node(root,lambda n:n is node);time.sleep(.5)
    root=capture('34b-quiz39-age-options');tap_node(root,lambda n:'16 jaar of ouder' in n.get('text',''));time.sleep(.4)
    root,node=find_quiz_text('Ik wil aan het technische testklassement','35-quiz39-privacy');tap_node(root,lambda n:n is node)
    root,node=find_quiz_text('Online profiel maken','36-quiz39-join');tap_node(root,lambda n:n is node);time.sleep(5)
    # Wi-Fi was deliberately disabled earlier. Wait for the two bounded native requests, not a fixed 5-second assumption.
    for attempt in range(30):
        try:
            prefs=ET.fromstring(adb('shell','run-as',PACKAGE,'cat','shared_prefs/veldio_quiz39_private.xml'))
            stored=prefs.find("string[@name='token']")
            if stored is not None and stored.text:
                quiz_token=stored.text;break
        except (subprocess.CalledProcessError,ET.ParseError):pass
        time.sleep(1)
    if not quiz_token:
        capture('36b-quiz39-join-failure');raise AssertionError('No native quiz token after bounded reconnect wait')
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
