"""Apply presentation branding last, without migrating app, API or storage identifiers."""
from pathlib import Path
import shutil
import re

root=Path('app/src/main')
p=root/'java/nl/voetbalhub/app/MainActivity.java'
s=p.read_text().replace('VoetbalHub','Veldio').replace('VOETBALHUB','VELDIO')
s=s.replace('Alles voetbal. Eén hub.','Alles voetbal. Eén plek.').replace('Alle voetbalbronnen. Eén plek.','Alles voetbal. Eén plek.')
s=s.replace('voetbalhub.app@gmail.com','redactie.veldio@gmail.com').replace('voetbalhub@gmail.com','redactie.veldio@gmail.com')
s=s.replace('splash.setScaleType(ImageView.ScaleType.FIT_XY);','splash.setScaleType(ImageView.ScaleType.FIT_CENTER);')
s=s.replace('splash.setContentDescription("Veldio: alle voetbalbronnen op één plek");','splash.setContentDescription("Veldio. Alles voetbal. Eén plek.");')
s=s.replace('private void showEditorialArticle(org.json.JSONObject article) {','private void showEditorialArticle(org.json.JSONObject article) {\n        Branding.article(article);')
s=s.replace('data = new org.json.JSONObject(responseText);','data = Branding.response(new org.json.JSONObject(responseText));')
# Brand names split into two spans in the legacy native masthead.
s=s.replace('tv("VOETBAL",','tv("VEL",').replace('tv("HUB",','tv("DIO",')
s=s.replace('drawText("VOETBAL",','drawText("VEL",').replace('drawText("HUB",','drawText("DIO",')
s=s.replace('R.drawable.ic_launcher','R.drawable.veldio_logo')
p.write_text(s)
shutil.copyfile('android-ui/java/Branding.java',p.parent/'Branding.java')
shutil.copyfile('android-ui/java/EditorialStore.java',p.parent/'EditorialStore.java')
for f in root.rglob('*.xml'):
 value=f.read_text().replace('VoetbalHub','Veldio').replace('VOETBALHUB','VELDIO')
 value=re.sub(r'(android:label=")[^"]+(\")',r'\1Veldio\2',value) if f.name=='AndroidManifest.xml' else value
 if f.name=='AndroidManifest.xml':
  value=re.sub(r'android:(icon|roundIcon)="[^"]+"',lambda m:'android:'+m[1]+'="@drawable/veldio_logo"',value)
 value=value.replace('Alles voetbal. Eén hub.','Alles voetbal. Eén plek.')
 f.write_text(value)
resources=root/'res/drawable-nodpi';resources.mkdir(parents=True,exist_ok=True)
shutil.copyfile('android-ui/drawable-nodpi/veldio_logo.png',resources/'veldio_logo.png')
shutil.copyfile('android-ui/drawable-nodpi/veldio_logo.png',resources/'intro_splash.png')
assets=root/'assets';assets.mkdir(parents=True,exist_ok=True)
shutil.copyfile('public/brand/veldio-logo.png',assets/'veldio-logo.png')
for asset in (Path('public')/'article-covers').glob('*.webp'):shutil.copyfile(asset,assets/asset.name)
gradle=Path('app/build.gradle.kts');g=gradle.read_text().replace('versionCode = 54','versionCode = 56').replace('versionName = "4.22"','versionName = "4.24-veldio"');gradle.write_text(g)
print('Veldio app label, splash, official logo, metadata, cache presentation and article branding installed; technical identifiers preserved.')
