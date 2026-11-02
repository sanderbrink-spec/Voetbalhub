"""Add two consent-gated ad positions after all existing visual and launch patches."""
from pathlib import Path
import shutil,re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
for name in ['AdController','AdSettings','AdRequestGate']:shutil.copyfile('android-ui/java/'+name+'.java',p.parent/(name+'.java'))
anchor='public class MainActivity';i=s.index('{',s.index(anchor))+1
s=s[:i]+'\n    private AdController veldioAds;\n    private AdController ads(){if(veldioAds==null)veldioAds=new AdController(this);return veldioAds;}\n'+s[i:]
old='section.addView(homeFeature, new LinearLayout.LayoutParams(-1, dp(600)));';assert s.count(old)==1
s=s.replace(old,old+'\n                      section.addView(ads().slot("home"),new LinearLayout.LayoutParams(-1,-2));')
old='page.addView(VeldioEditorial.footer(this));';assert s.count(old)==1
s=s.replace(old,'''String disclosure=article.optString("aiDisclosure", "");
        if(!disclosure.isEmpty()){TextView disclosureView=tv(disclosure,11,C.MUTED,false);disclosureView.setPadding(0,dp(8),0,dp(8));page.addView(disclosureView);}
        page.addView(ads().slot("reader"),new LinearLayout.LayoutParams(-1,-2));
        '''+old)
old='        addActionRow(list, "Contact", "Contact", this::showContact);';assert s.count(old)==1
s=s.replace(old,old+'\n        addActionRow(list,"Advertentieprivacy","Privacykeuzes",()->ads().privacy());')
s=s.replace('    @Override protected void onPause() {','    @Override protected void onPause() {\n        if(veldioAds!=null)veldioAds.pause();')
s=s.replace('    @Override protected void onDestroy() {','    @Override protected void onDestroy() {\n        if(veldioAds!=null)veldioAds.dispose();')
s=s.replace('        super.onResume();','        super.onResume();\n        ads().resume();')
p.write_text(s)
p=Path('app/build.gradle.kts');s=p.read_text();s=s.replace('    compileSdk = 36','    compileSdk = 36\n    buildToolsVersion = \"36.0.0\"');s=s.replace('dependencies {','dependencies {\n    implementation("com.google.android.gms:play-services-ads:25.5.0")\n    implementation("com.google.android.ump:user-messaging-platform:4.0.0")',1);p.write_text(s)
app_id=re.search(r'APP_ID="(ca-app-pub-[0-9]{16}~[0-9]{10})"',Path('android-ui/java/AdSettings.java').read_text()).group(1)
p=Path('app/src/main/AndroidManifest.xml');s=p.read_text().replace('<manifest ','<manifest xmlns:tools="http://schemas.android.com/tools" ',1)
s=s.replace('</application>',f'''<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="{app_id}" />
        <meta-data android:name="com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT" android:value="true" />
        <provider android:name="com.google.android.gms.ads.MobileAdsInitProvider" tools:node="remove" />
    </application>''')
for permission in ['com.google.android.gms.permission.AD_ID','android.permission.ACCESS_ADSERVICES_AD_ID','android.permission.ACCESS_ADSERVICES_ATTRIBUTION','android.permission.ACCESS_ADSERVICES_TOPICS']:
    s=s.replace('</manifest>','    <uses-permission android:name="'+permission+'" tools:node="remove" />\n</manifest>')
p.write_text(s)
print('Two test-only ad positions, UMP gate and privacy entry added; automatic SDK provider and AD_ID removed.')

p=Path("build.gradle.kts");p.write_text(p.read_text().replace('version "8.9.1"','version "8.13.2"'))
