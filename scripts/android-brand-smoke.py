"""Read-only Android presentation smoke test. Never submits or publishes content."""
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

OUT=Path('.android-smoke');OUT.mkdir(exist_ok=True)
PACKAGE='nl.voetbalhub.app1'
def adb(*args):
    return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def capture(name):
    adb('shell','screencap','-p','/sdcard/veldio.png')
    adb('pull','/sdcard/veldio.png',str(OUT/(name+'.png')))
    if name=='01-start': return None
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

# Seed a disposable emulator with the public feed to test cached article views.
# No API writes, generated editorial content or production preferences are involved.
import json
import urllib.request
from xml.sax.saxutils import escape
with urllib.request.urlopen('https://voetbalhub-redactie.onrender.com/articles',timeout=90) as response:
    feed=json.load(response)
columns=[a for a in feed['articles'] if a.get('type')=='column' or a.get('category','').lower() in ('column','de derde helft')]
assert columns,'Public column missing from feed'
(OUT/'public-articles.json').write_text(json.dumps(feed))
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
    result.write('PASS: public-feed cache, local column portrait thumbnail, column and news readers, save toggle, font control and back navigation. Cached/offline UI scenario; does not verify Android live networking.\n')
print((OUT/'result.txt').read_text())
