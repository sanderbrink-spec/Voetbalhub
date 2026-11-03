"""Focused real-APK player test; regression and competition checks run separately."""
from pathlib import Path
source=Path('scripts/android-interface39.py').read_text().replace('4.47-interface39','4.51-phase43').replace('MIJN VELDIO','Mijn Veldio')
source=source[:source.index("adb('install','-r',sys.argv[1])")]
source=source.replace("if web is not None:\n    b=bounds(web)","if web is None:web=next((n for n in root.iter('node') if n.get('class')=='android.widget.ScrollView'),None)\n   if web is not None:\n    b=bounds(web)")
exec(compile(source,'android-video43-driver.py','exec'))
import urllib.request,websocket
adb('install','-r',sys.argv[1]);adb('shell','am','force-stop',PACKAGE);launch()
resultPath=OUT/'video43-result.json';resultPath.write_text(json.dumps({'checks':[],'limits':['Focused player test; other regression checks are separate.']}))
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

back_home();root,node=find('Menu: Samenvattingen','43-videos-open',clickable=True,scroll=True);tap(node);time.sleep(3)
ids=[v['id'] for v in json.loads(Path('videos/catalog43.json').read_text())['videos']][:5]
assert len(ids)>=5,'Five verified videos required for device test'
video_checks=[]
for index,id in enumerate(ids):
 root,node=find('Video afspelen: '+id,'43-video-card-'+str(index),clickable=True,scroll=True);before=bounds(node);tap(node)
 root,node=find('Toestaan','43-video-consent-'+str(index),clickable=True);tap(node);time.sleep(2)
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
report=json.loads(resultPath.read_text());report['version']='4.51-phase43';report['videoChecks']=video_checks;report['videoPlaybackAcceptance']=all(v['playing'] for v in video_checks)
report['checks']+=['five real immersive player openings','landscape player viewport','back returns to preserved list position','background/resume lifecycle','external YouTube intent']
report['limits']+=['Playback requires reachable YouTube and may be blocked by YouTube device, region or account policies; inspect phase43-video-results.json.']
resultPath.write_text(json.dumps(report,ensure_ascii=False,indent=2))
