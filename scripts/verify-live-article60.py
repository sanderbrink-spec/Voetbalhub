"""Validate a real autonomous publication in an existing APK on Android 16."""
from pathlib import Path
import json, subprocess, sys, time, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime
from zoneinfo import ZoneInfo
import uiautomator2 as u2
OUT=Path('.android-smoke'); OUT.mkdir(exist_ok=True)
PACKAGE='nl.voetbalhub.app1'
article_id=sys.argv[2]
with urllib.request.urlopen('https://voetbalhub-redactie.onrender.com/articles',timeout=60) as r:
    article=next(a for a in json.load(r)['articles'] if a['id']==article_id)
def adb(*args):
    return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT,timeout=40)
adb('install','-r',sys.argv[1])
adb('shell','am','start','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
d=u2.connect()
checks=[]
try:
    assert adb('shell','getprop','ro.build.version.sdk').strip()=='36'
    assert d(text='Nieuws').wait(timeout=40),'Nieuws navigation missing'
    d(text='Nieuws').click()
    if d(text='Laatste nieuws').wait(timeout=8):d(text='Laatste nieuws').click()
    refresh=d(textMatches='(?i)ververs(?:en)?')
    if refresh.wait(timeout=8):refresh.click()
    # Use a rendered native card, never inject a test article or call a Java bridge.
    for _ in range(20):
        node=d(description=article['headline'])
        title=d(text=article['headline'])
        if node.exists:node.click();break
        if title.exists:title.click();break
        if d(text='Nieuws bijwerken…').exists:time.sleep(1)
        else:d.swipe(.5,.8,.5,.3,.3);time.sleep(.5)
    else:raise AssertionError('Production article card missing')
    reader_back=d(description='Terug naar de vorige pagina')
    assert reader_back.wait(timeout=20),'Article reader did not open'
    assert d(text=article['headline']).wait(timeout=15),'Reader headline missing at the top'
    for i in range(16):
        tree=d.dump_hierarchy()
        (OUT/('article60-'+str(i)+'.xml')).write_text(tree)
        d.screenshot(str(OUT/('article60-'+str(i)+'.png')))
        d.swipe(.5,.8,.5,.3,.3);time.sleep(.4)
    # Parse each hierarchy independently because each dump has an XML declaration.
    values=[];descriptions=[]
    for path in OUT.glob('article60-*.xml'):
        for n in ET.fromstring(path.read_text()).iter():
            values.append(n.attrib.get('text',''));descriptions.append(n.attrib.get('content-desc',''))
    assert article['headline'] in values,'Reader headline missing'
    assert article['standfirst'] in values,'Reader intro missing'
    for paragraph in article['body']:assert paragraph in values,'Reader paragraph missing'
    assert article['category'].upper() in values,'Reader category missing'
    date=datetime.fromisoformat(article['publishedAt'].replace('Z','+00:00')).astimezone(ZoneInfo('Europe/Amsterdam'))
    months=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
    label=f'{date.day} {months[date.month-1]} {date.year} · {date:%H:%M}'
    assert any(label in v for v in values),'Reader publication date missing'
    if article.get('imageUrl'):
        assert any(label.startswith(('Afbeelding bij ', 'AI-illustratie bij ', 'Illustratie in de clubkleuren')) for label in descriptions),'Reader image missing'
    checks.append('Native article reader displayed the production headline, intro, every paragraph, category, date and image slot')
    report={'status':'PASS','articleId':article_id,'apk':sys.argv[1],'androidApi':36,'checks':checks,
            'limits':['Emulator, no physical Samsung S23','Release proof checks the visible reader without debug-only run-as']}
    (OUT/'article60-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report))
except Exception as e:
    d.screenshot(str(OUT/'article60-failure.png'))
    (OUT/'article60-failure.json').write_text(json.dumps({'status':'FAIL','articleId':article_id,'error':str(e),'checks':checks},indent=2));raise
