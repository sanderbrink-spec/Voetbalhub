"""Read-only Android presentation smoke test. Never submits or publishes content."""
from pathlib import Path
import re
import os
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

OUT=Path('.android-smoke');OUT.mkdir(exist_ok=True)
sdk = Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
aapt = sorted(sdk.glob('build-tools/*/aapt'))[-1]
badging = subprocess.check_output([str(aapt), 'dump', 'badging', sys.argv[1]], text=True)
match = re.search(r"package: name='([^']+)'", badging)
assert match, 'APK package identity missing'
PACKAGE = match.group(1)
assert PACKAGE in ('nl.voetbalhub.app1', 'nl.voetbalhub.app1.test', 'nl.voetbalhub.app1.test32'), PACKAGE
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
adb('install','-r',sys.argv[1])
adb('shell','am','force-stop',PACKAGE)
result=adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
assert 'Error:' not in result,result
capture('01-start')
time.sleep(6)
root=capture('02-home')
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
preferences='<map><string name="last_articles">'+escape(json.dumps(feed,ensure_ascii=False))+'</string></map>'
(OUT/'editorial-cache.xml').write_text(preferences)
adb('push',str(OUT/'editorial-cache.xml'),'/data/local/tmp/veldio-cache.xml')
adb('shell','run-as',PACKAGE,'mkdir','-p','shared_prefs')
adb('shell','run-as',PACKAGE,'cp','/data/local/tmp/veldio-cache.xml','shared_prefs/voetbalhub_editorial.xml')
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
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

# Read-only production fetch plus real native pull gesture. No test data is published.
import urllib.request
with urllib.request.urlopen('https://voetbalhub-redactie.onrender.com/articles',timeout=80) as response:
    live=json.load(response)
assert live.get('articles'),'Production feed unavailable'
latest=live['articles'][0]['headline']
adb('shell','am','force-stop',PACKAGE)
adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
def pref_timestamp():
    try:
        raw=adb('shell','run-as',PACKAGE,'cat','shared_prefs/voetbalhub_editorial.xml')
        root=ET.fromstring(raw)
        return next((int(n.get('value')) for n in root if n.get('name')=='last_fetch_at'),0)
    except Exception:return 0
before=pref_timestamp()
for attempt in range(28):
    time.sleep(3)
    if pref_timestamp()>before:break
assert pref_timestamp()>before,'Production feed fetch not persisted'
for attempt in range(8):
    root=capture('13-live-home')
    hero_ready=any('NIEUWSTE ARTIKEL' in n.get('text','') and latest in n.get('text','') for n in root.iter('node'))
    spotlight_ready=any('CLUB IN DE SPOTLIGHT' in n.get('text','') or 'WEDSTRIJD VAN DE WEEK' in n.get('text','') for n in root.iter('node'))
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
