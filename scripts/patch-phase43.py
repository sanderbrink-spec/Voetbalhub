"""Apply phase43 after the exact phase42 preparation, preserving existing features."""
from pathlib import Path
import shutil,re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
s=s.replace('if(videoShelf40!=null)videoShelf40.closeVideo();','if(videoShelf40!=null)videoShelf40.pauseVideo();')
s=s.replace('if (homeFeature != null) homeFeature.closeVideo();','if (homeFeature != null) homeFeature.pauseVideo();')
s=s.replace('super.onResume();','super.onResume();\n        if(videoShelf40!=null)videoShelf40.resumeVideo();\n        if(homeFeature!=null)homeFeature.resumeVideo();',1)
s=s.replace('protected void onDestroy() {','protected void onDestroy() {\n        if(videoShelf40!=null)videoShelf40.closeVideo();\n        if(homeFeature!=null)homeFeature.closeVideo();',1)
p.write_text(s)
for name in ['YoutubePlayerView','VideoShelf40','HomeFeatureView','EditorialIllustrations42','EditorialPhotos','PresentationCovers','Branding','EditorialImages43']:
 shutil.copyfile('android-ui/java/'+name+'.java',p.parent/(name+'.java'))
for name in ['youtube-player43.html','youtube-catalog43.json','presentation-covers43.json']:
 shutil.copyfile('android-ui/assets/'+name,'app/src/main/assets/'+name)
shutil.copytree('android-ui/assets/news43','app/src/main/assets/news43',dirs_exist_ok=True)
m=Path('app/src/main/AndroidManifest.xml');s=m.read_text()
# Rotation is a resize, not a new Activity or a second audio source.
s=re.sub(r'(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*)(>)',lambda v:re.sub(r'\s+android:configChanges="[^"]*"','',v[1])+' android:configChanges="orientation|screenSize|smallestScreenSize|screenLayout|keyboardHidden"'+v[2],s)
m.write_text(s)
g=Path('app/build.gradle.kts');t=g.read_text();t=re.sub(r'versionCode\s*=\s*\d+','versionCode = 83',t);t=re.sub(r'versionName\s*=\s*"[^"]+"','versionName = "4.51-phase43"',t);g.write_text(t)
print('Phase43 player, lifecycle, catalogue and registered article images installed')
