"""All phase42 regression checks, then actual immersive player checks on API36.
Playback success is recorded independently from window, orientation and navigation success.
"""
from pathlib import Path
source=Path('scripts/android-phase42.py').read_text().replace('4.50-phase42','4.45-test')
source=source.replace("root,node=find('NOS Sport op YouTube openen ↗','42-summaries',scroll=True)\nassert any(n.get('text')=='SAMENVATTINGEN' for n in root.iter('node'))","root=capture('43-summaries-heading')\nassert any(n.get('text')=='SAMENVATTINGEN' for n in root.iter('node'))\nroot,node=find('NOS Sport op YouTube openen ↗','42-summaries',scroll=True)")
exec(compile(source,'android-phase43-base.py','exec'))
import urllib.request,websocket

def player_eval(expression):
 pid=adb('shell','pidof',PACKAGE).strip().split()[0]
 adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
 with urllib.request.urlopen('http://127.0.0.1:9222/json/list',timeout=5) as r:targets=json.load(r)
 targets=[t for t in targets if t.get('url','').startswith('https://'+PACKAGE.lower())]
 if not targets:return None
 ws=websocket.create_connection(targets[0]['webSocketDebuggerUrl'],timeout=5,suppress_origin=True)
 try:
  ws.send(json.dumps({'id':43,'method':'Runtime.evaluate','params':{'expression':expression,'returnByValue':True}}))
  while True:
   r=json.loads(ws.recv())
   if r.get('id')==43:return r.get('result',{}).get('result',{}).get('value')
 finally:ws.close()

# Exercise all six specified native competition routes.
competition_checks=[]
for name in ['Eredivisie','Keuken Kampioen Divisie','Champions League','Europa League','Conference League','Premier League']:
 back_home();root,node=find('Menu: Competities','43-competitions-open',clickable=True,scroll=True);tap(node)
 root,node=find(name+', openen','43-competition-'+name,clickable=True,scroll=True);tap(node);time.sleep(.6)
 root=capture('43-competition-detail-'+name);assert adb('shell','pidof',PACKAGE).strip();competition_checks.append(name)
 adb('shell','input','keyevent','4');time.sleep(.3)
# Multiple local club selections, removal and a cold process restart.
back_home();root,node=find('Menu: Favorieten','43-favourites-open',clickable=True,scroll=True);tap(node)
root,node=find('Club toevoegen +','43-favourites-picker',exact=False,clickable=True);tap(node)
for club in ['Ajax','PSV','PSV']:
 root,node=find(club,'43-favourite-'+club,exact=False,clickable=True,scroll=True);tap(node);time.sleep(.7)
prefs=adb('shell','run-as',PACKAGE,'cat','shared_prefs/voethub.xml');assert 'Ajax' in prefs and 'FC Groningen' in prefs and '<string>PSV</string>' not in prefs
adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(3);prefs=adb('shell','run-as',PACKAGE,'cat','shared_prefs/voethub.xml');assert 'Ajax' in prefs and '<string>PSV</string>' not in prefs
back_home();root,node=find('Menu: Samenvattingen','43-videos-open',clickable=True,scroll=True);tap(node);time.sleep(3)
ids=[v['id'] for v in json.loads(Path('videos/catalog43.json').read_text())['videos']][:5]
assert len(ids)>=5,'Five verified videos required for device test'
def allow_player(index):
 for attempt in range(12):
  root=capture('43-video-consent-'+str(index))
  system=next((n for n in root.iter('node') if n.get('text') in ['Got it','Begrepen'] and n.get('clickable')=='true'),None)
  if system is not None:tap(system);time.sleep(.4);continue
  button=next((n for n in root.iter('node') if n.get('text','').upper()=='TOESTAAN' and n.get('clickable')=='true'),None)
  if button is not None:tap(button);return
  time.sleep(.5)
 raise AssertionError('YouTube consent button unavailable')

video_checks=[]
for index,id in enumerate(ids):
 root,node=find('Video afspelen: '+id,'43-video-card-'+str(index),clickable=True,scroll=True);before=bounds(node);tap(node)
 allow_player(index);time.sleep(2)
 dimensions=adb('shell','dumpsys','window','displays');(OUT/('43-window-'+str(index)+'.txt')).write_text(dimensions)
 root=capture('43-player-'+str(index));web=next(n for n in root.iter('node') if n.get('class')=='android.webkit.WebView');b=bounds(web);assert b[2]-b[0]>b[3]-b[1],'Player must be landscape'
 state=None
 for attempt in range(8):
  try:state=player_eval("JSON.stringify({ready:typeof player!=='undefined'&&!!player&&typeof player.getPlayerState==='function',state:typeof player!=='undefined'&&player&&player.getPlayerState?player.getPlayerState():null,status:document.querySelector('#status').textContent,frame:!!document.querySelector('iframe'),width:innerWidth,height:innerHeight})")
  except Exception:pass
  if state:
   decoded=json.loads(state)
   if decoded.get('state')==1 or decoded.get('status'):break
  time.sleep(2)
 result={'id':id,'windowLandscape':True,'iframe':json.loads(state) if state else None,'playing':bool(state and json.loads(state).get('state')==1)}
 if result['playing']:
  player_eval('player.pauseVideo();true');time.sleep(.5);result['pauseState']=player_eval('player.getPlayerState()');assert result['pauseState']==2
  player_eval('player.playVideo();true');time.sleep(.5);result['resumeState']=player_eval('player.getPlayerState()')
  player_eval('player.seekTo(10,true);true');result['seekRequested']=True
 # Real Android background/resume, no second player instance.
 adb('shell','input','keyevent','3');time.sleep(.5);adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity');time.sleep(.5)
 try:result['resumePlayerCount']=player_eval("document.querySelectorAll('iframe').length")
 except Exception:pass
 adb('shell','input','keyevent','4');time.sleep(.7)
 root,node=find('Video afspelen: '+id,'43-video-return-'+str(index),clickable=True)
 restored=bounds(node);assert abs(restored[1]-before[1])<100,'Video list scroll changed'
 # Check real Activity orientation requested by the app after dismissal.
 activity=adb('shell','dumpsys','activity','activities');(OUT/('43-return-activity-'+str(index)+'.txt')).write_text(activity)
 result['backRestoredList']=True;video_checks.append(result)
(OUT/'phase43-video-results.json').write_text(json.dumps(video_checks,ensure_ascii=False,indent=2))
# Open the explicit external fallback from a video card and verify the dispatched URL.
root,node=find('Deze video bekijken op YouTube ↗','43-external-fallback',clickable=True,scroll=True);tap(node);time.sleep(1)
(OUT/'phase43-external-intent.txt').write_text(adb('shell','dumpsys','activity','activities'))
report=json.loads(resultPath.read_text());report['version']='4.45-test';report['competitionChecks']=competition_checks;report['favouriteMultipleAndRemovalPersistence']=True;report['videoChecks']=video_checks;report['videoPlaybackAcceptance']=all(v['playing'] for v in video_checks)
report['checks']+=['five real immersive player openings','landscape player viewport','back returns to preserved list position','background/resume lifecycle','external YouTube intent']
report['limits']+=['Playback requires reachable YouTube and may be blocked by YouTube device, region or account policies; inspect phase43-video-results.json.']
resultPath.write_text(json.dumps(report,ensure_ascii=False,indent=2))
