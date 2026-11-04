"""Run the complete existing API36 audit, then verify the actual phase42 destinations."""
from pathlib import Path
source=Path('scripts/android-premium40.py').read_text().replace('4.48-premium40','4.50-phase42')
source=source.replace("source=Path('scripts/android-interface39.py').read_text()", "source=Path('scripts/android-interface39.py').read_text().replace(\"Video's\",\"Samenvattingen\")")
exec(compile(source,'android-phase42-generated.py','exec'))

# The shared driver leaves the app on Home. Verify the new native layouts, not a mock.
back_home()
root,node=find('Menu: Meer','42-more-open',clickable=True,scroll=True);tap(node)
root=capture('42-more')
texts=[n.get('text','') for n in root.iter('node')]
for label in ['ALGEMEEN','INSTELLINGEN','JURIDISCH','Over Veldio','Contact','App-instellingen','Meldingen','Advertentievoorkeuren','Privacyverklaring','Juridische informatie']:
 assert label in texts,label+' missing from compact More'
for label in ['Clubquiz','Stadions','De Derde Helft']:
 assert label not in texts,'Duplicate destination in More: '+label
back_home()
root,node=find('Menu: Samenvattingen','42-summaries-open',clickable=True,scroll=True);tap(node)
root,node=find('NOS Sport op YouTube openen ↗','42-summaries',scroll=True)
assert any(n.get('text')=='SAMENVATTINGEN' for n in root.iter('node'))
# External YouTube playback is deliberate; no untested embedded player is claimed.
back_home()
import json,subprocess,time
resultPath=OUT/'interface39-result.json';report=json.loads(resultPath.read_text())
launch=adb('shell','am','start','-W','-n',PACKAGE+'/nl.voetbalhub.app.MainActivity')
(OUT/'phase42-startup.txt').write_text(launch)
(OUT/'phase42-memory.txt').write_text(adb('shell','dumpsys','meminfo',PACKAGE))
assert adb('shell','getprop','ro.build.version.sdk').strip()=='36'
report['androidApi']=36;report['version']='4.50-phase42';report['physicalSamsungTest']=False
report['checks']+=['compact More sections and seven entries','no duplicate quiz/stadium/column in More','NOS summaries official external link available']
report['limits']+=['No physical Galaxy S23 or battery test','No NOS video playback or unique generation for every article tested']
resultPath.write_text(json.dumps(report,ensure_ascii=False,indent=2))
