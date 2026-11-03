"""Finalize phase41 on the exact phase40 preparation pipeline."""
from pathlib import Path
import re
base=Path('app/src/main/java/nl/voetbalhub/app')
for name,anchor in [('ContactView','DeadlineHttp.watch(conn,40000)'),('NewsListCard','DeadlineHttp.watch(conn,15000)'),('PremiumDesign40','LruCache<String,Bitmap>'),('VideoShelf40','if(loading||!attached)return')]:
    assert anchor in (base/(name+'.java')).read_text(),name+' fix missing from prepared app'
gradle=Path('app/build.gradle.kts');s=gradle.read_text();s=re.sub(r'versionCode\s*=\s*\d+','versionCode = 81',s);s=re.sub(r'versionName\s*=\s*"[^"]+"','versionName = "4.49-audit41"',s);gradle.write_text(s)
print('Phase41 fixes and version verified in prepared production sources')
