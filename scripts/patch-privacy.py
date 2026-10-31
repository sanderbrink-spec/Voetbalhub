"""Final Android safeguard after all compatibility patches; no paid SDK or keys."""
from pathlib import Path
import re
import shutil

root = Path('app/src/main')
p = root / 'java/nl/voetbalhub/app/MainActivity.java'
s = p.read_text()
# Remove imports, initialization and banner calls if inherited from the old ZIP.
s = re.sub(r'^import com\.google\.android\.gms\.ads\.[^;]+;\n', '', s, flags=re.M)
start = s.find('MobileAds.initialize(')
if start >= 0:
    end = s.find('\n        });', start)
    assert end > start, 'Unrecognized ad initialization block'
    s = s[:start] + s[end + len('\n        });'):]
assert 'MobileAds.initialize' not in s
s = re.sub(r'^.*private AdView bannerAdView;\n', '', s, flags=re.M)
s = re.sub(r'        if \(bannerAdView != null\) \{.*?\n        \}\n', '', s, flags=re.S)
s = re.sub(r'^.*if \(bannerAdView != null\) bannerAdView\.(?:pause|resume)\(\);\n', '', s, flags=re.M)
assert 'bannerAdView' not in s, 'Unrecognized banner reference'
anchor = 'addActionRow(list, "Info", "Bronnen en beeldgebruik", this::showLegalInfo);'
assert s.count(anchor) == 1, 'Privacy entry point changed'
s = s.replace(anchor, anchor + '\n        addActionRow(list, "Info", "Privacy en gegevens", () -> PrivacyInfo.show(this));')
s = s.replace('De competitiepagina gebruikt officiële Eredivisiegegevens en aanvullende wedstrijdgegevens.', 'Externe competitiegegevens staan uit totdat de gebruiksrechten zijn vastgelegd.')
s = s.replace("Namen en clublogo's blijven herkenbaar als die van de betreffende clubs.", 'Externe clublogo’s en stadionfoto’s staan uit zolang de rechten niet zijn aangetoond.')
p.write_text(s)
shutil.copyfile('android-ui/java/PrivacyInfo.java', p.parent / 'PrivacyInfo.java')
shutil.copyfile('public/privacy.html', root / 'assets/privacy.html')
gradle = Path('app/build.gradle.kts')
g = gradle.read_text()
g = re.sub(r'^.*implementation\("com.google.android.gms:play-services-ads:[^\n]+\n', '', g, flags=re.M)
g = re.sub(r'^.*buildConfigField\("String", "API_FOOTBALL_KEY"[^\n]+\n', '        buildConfigField("String", "API_FOOTBALL_KEY", "\\\"\\\"")\n', g, flags=re.M)
assert 'System.getenv("API_FOOTBALL_KEY")' not in g
gradle.write_text(g)
manifest = root / 'AndroidManifest.xml'
m = manifest.read_text()
m = re.sub(r'<meta-data\b[^>]*android:name="com.google.android.gms.ads.APPLICATION_ID"[^>]*/>', '', m)
m = re.sub(r'<uses-permission\b[^>]*android:name="com.google.android.gms.permission.AD_ID"[^>]*/>', '', m)
m = re.sub(r'android:allowBackup="[^"]*"', 'android:allowBackup="false"', m)
if 'android:allowBackup=' not in m: m = m.replace('<application', '<application android:allowBackup="false"', 1)
m = m.replace('<application', '<application android:usesCleartextTraffic="false"', 1) if 'android:usesCleartextTraffic=' not in m else re.sub(r'android:usesCleartextTraffic="[^"]*"', 'android:usesCleartextTraffic="false"', m)
manifest.write_text(m)
print('Installed local privacy, removed ads SDK and client API key, disabled backup and HTTP')
