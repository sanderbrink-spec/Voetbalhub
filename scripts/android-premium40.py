"""Exercise the exact phase40 APK; retain the existing offline persistence checks."""
from pathlib import Path
source=Path('scripts/android-interface39.py').read_text()
source=source.replace('4.47-interface39','4.48-premium40').replace('MIJN VELDIO','Mijn Veldio')
source=source.replace("'Standen','Clubs','Favorieten','Meldingen'","'Standen','Favorieten','Mijn Club','Meer'")
a=source.index('positions=[]');b=source.index('checks=[]',a)
source=source[:a]+'''# Every native tile must remain reachable above the fixed bottom navigation.
for label in labels:
 root,node=find('Menu: '+label,'40-menu',clickable=True,scroll=True)
 b=bounds(node)
 nav=[bounds(n) for n in root.iter('node') if n.get('text')=='Home']
 assert all(b[3]<=n[1] for n in nav if len(n)==4 and n[1]>b[1]),label+' covered by navigation'
adb('shell','input','swipe','200','260','200','1600','500')
''' +source[b:]
source=source.replace("find(label,'39-home',clickable=True)","find('Menu: '+label,'40-home',clickable=True,scroll=True)")
source=source.replace("if web is not None:\n    b=bounds(web)","if web is None:web=next((n for n in root.iter('node') if n.get('class')=='android.widget.ScrollView'),None)\n   if web is not None:\n    b=bounds(web)")
for label in ['Favorieten','Club Quiz']:
 for suffix in ['39-home','39-offline-home']:
  source=source.replace("find('"+label+"','"+suffix+"',clickable=True)","find('Menu: "+label+"','40-home',clickable=True,scroll=True)")
source=source.replace(" if label=='Meldingen':",''' if label=='Meer':
  root,node=find('Meldingen','40-notifications-entry',scroll=True);tap(node)
 if label=='Meer':''')
# Home always reconstructs the launcher at the top after navigating back.
a=source.index('def back_home():');b=source.index("adb('install'",a)
source=source[:a]+'''def back_home():
 adb('shell','input','keyevent','4');time.sleep(.5)
 root=capture('40-return-home')
 home=next(n for n in root.iter('node') if n.get('text')=='Home')
 tap(home);time.sleep(.5)
 find('Mijn Veldio','40-return-home')
'''+source[b:]
# A search begins at the top, then scrolls down to controls below the fold.
source=source.replace("if scroll and attempt in [1,3,5]:", "if scroll and attempt in [0,1,3,5]:")
source=source.replace("str(b[3]-80),str(x),str(b[1]+120),'500'", "str(b[1]+120 if attempt==0 else b[3]-80),str(x),str(b[3]-80 if attempt==0 else b[1]+120),'500'")

source=source.replace("'No physical S23'","'S23 viewport emulated; no physical device'")
if __name__=='__main__':exec(compile(source,'android-premium40-generated.py','exec'))
