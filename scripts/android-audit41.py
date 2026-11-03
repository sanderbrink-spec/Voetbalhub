"""Run all phase40 destination, offline and persistence checks against the phase41 APK."""
from pathlib import Path
source=Path('scripts/android-premium40.py').read_text().replace('4.48-premium40','4.49-audit41')
exec(compile(source,'android-audit41-generated.py','exec'))

import json,subprocess,time
out=Path('.android-smoke')
resultPath=out/'interface39-result.json';report=json.loads(resultPath.read_text());package=report['package']
subprocess.run(['adb','shell','am','force-stop',package],check=True)
launch=subprocess.check_output(['adb','shell','am','start','-W','-n',package+'/nl.voetbalhub.app.MainActivity'],text=True)
assert 'Status: ok' in launch,launch
(out/'phase41-startup.txt').write_text(launch)
time.sleep(3)
(out/'phase41-memory.txt').write_text(subprocess.check_output(['adb','shell','dumpsys','meminfo',package],text=True))
sdk=subprocess.check_output(['adb','shell','getprop','ro.build.version.sdk'],text=True).strip();assert sdk=='36',sdk
report['androidApi']=int(sdk);report['version']='4.49-audit41';report['physicalSamsungTest']=False
report['limits'].append('No battery benchmark or hardware performance measurement')
resultPath.write_text(json.dumps(report,ensure_ascii=False,indent=2))
