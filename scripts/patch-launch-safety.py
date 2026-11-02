"""Apply launch corrections after all existing UI patches. Does not edit the carousel."""
from pathlib import Path
import re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java')
s=p.read_text()
def replace_method(source, signature, replacement):
    start=source.index(signature);brace=source.index('{',start);depth=0
    for end in range(brace,len(source)):
        if source[end]=='{':depth+=1
        elif source[end]=='}':
            depth-=1
            if depth==0:return source[:start]+replacement+source[end+1:]
    raise RuntimeError(signature)
s=replace_method(s,'private void initializeAds()', '''private void initializeAds() {
        // Advertising remains unavailable until a certified CMP and SDK audit are complete.
        android.view.View container=findViewById(R.id.adContainer);
        if(container!=null)container.setVisibility(android.view.View.GONE);
    }''')
s=re.sub(r'^import com\.google\.android\.gms\.ads\.[^;]+;\n','',s,flags=re.M)
s=s.replace('    private AdView bannerAdView;','')
s=re.sub(r'if \(bannerAdView != null\) \{\s*bannerAdView.destroy\(\);\s*bannerAdView = null;\s*\}', '',s)
s=re.sub(r'if \(bannerAdView != null\) bannerAdView\.(?:pause|resume)\(\);','',s)
assert 'bannerAdView' not in s and 'MobileAds.' not in s
# API credentials are server-only. Old unused score code must never read an embedded key.
s=s.replace('BuildConfig.API_FOOTBALL_KEY','""')
anchor='        addActionRow(list, "Contact", "Contact", this::showContact);'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'''
        addActionRow(list, "Privacyverklaring", "Privacy", () -> startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(EDITORIAL_API_URL.replaceAll("/articles/?$", "") + "/privacy"))));
        addActionRow(list, "Juridische informatie", "Over Veldio", () -> startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(EDITORIAL_API_URL.replaceAll("/articles/?$", "") + "/legal"))));''')
# Native news readers also reject old server responses and unapproved offline caches.
s=s.replace('data = Branding.response(new org.json.JSONObject(responseText));','data = Branding.response(new org.json.JSONObject(responseText)); if(!PublicationPolicy.allows(data))throw new java.io.IOException("Rights approval missing");')
s=s.replace('data = new org.json.JSONObject(savedNews);','data = new org.json.JSONObject(savedNews); if(!PublicationPolicy.allows(data))throw new java.io.IOException("Cached rights approval expired");')
import shutil
shutil.copyfile('android-ui/java/PublicationPolicy.java',p.parent/'PublicationPolicy.java')
for name in ['BoundedInput','EditorialBitmap']:
    shutil.copyfile('android-ui/java/'+name+'.java',p.parent/(name+'.java'))
s=s.replace('android.graphics.BitmapFactory.decodeStream(stream)', 'EditorialBitmap.read(stream,1600)')
p.write_text(s)
p=Path('app/build.gradle.kts');g=p.read_text()
g=re.sub(r'^\s*implementation\("com\.google\.android\.gms:play-services-ads:[^"]+"\)\n','\n',g,flags=re.M)
g=re.sub(r'^\s*buildConfigField\("String", "API_FOOTBALL_KEY"[^\n]+\n','\n',g,flags=re.M)
g=re.sub(r'versionCode = \d+', 'versionCode = 66', g)
g=re.sub(r'versionName = \"[^\"]+\"', 'versionName = \"4.38-veldio\"', g)
g=g.replace('compileSdk = 35','compileSdk = 36').replace('targetSdk = 35','targetSdk = 36')
p.write_text(g)
p=Path('build.gradle.kts');p.write_text(p.read_text().replace('version "8.7.3"','version "8.9.1"'))
p=Path('app/src/main/AndroidManifest.xml');m=p.read_text().replace('android:allowBackup="true"','android:allowBackup="false"')
m=re.sub(r'\s*<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"[^>]+/>','',m)
p.write_text(m)
print('Launch safety applied: ads SDK removed, no embedded sports key, backup disabled, legal links, SDK 36.')
