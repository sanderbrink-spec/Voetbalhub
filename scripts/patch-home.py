"""Install the actual homepage after the existing Android compatibility patches."""
from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java')
s=p.read_text()
old='if (!columnOnly && "Voor jou".equals(active)) { LinearLayout.LayoutParams bannerLp = new LinearLayout.LayoutParams(-1, dp(184)); bannerLp.setMargins(0, dp(2), 0, dp(10)); section.addView(new ColumnBannerView(this, this::showColumn), bannerLp); addEredivisieFeature(section); }'
assert s.count(old)==1,'Home feature anchor changed'
s=s.replace(old,'''if (!columnOnly && "Voor jou".equals(active)) {
                      homeFeature = new HomeFeatureView(this, this::showEditorialArticle, this::showWeeklyPreview, this::showColumn);
                      section.addView(homeFeature, new LinearLayout.LayoutParams(-1, dp(600)));
                  }''',1)
s=s.replace('tv("Laatste nieuws", 18, C.TEXT, true)','tv("VANDAAG – LAATSTE VOETBALNIEUWS", 14, C.TEXT, true)')
# Full-width hero while article list rows retain their own internal text spacing.
start=s.index('private void showNews()');end=s.index('\n    private ',start+10)
news=s[start:end]
import re
news=re.sub(r'list.setPadding\([^;]+;', 'list.setPadding(0, 0, 0, dp(18));',news)
s=s[:start]+news+s[end:]
s=s.replace('section.setPadding(0, dp(7), 0, dp(7));','section.setPadding(0, 0, 0, dp(7));')
# Stop playback before changing screens, on Back, and when the app leaves foreground.
anchor='public class MainActivity'
i=s.index('{',s.index(anchor))+1
s=s[:i]+'\n    private HomeFeatureView homeFeature;\n'+s[i:]
for anchor,extra in [
 ('public void onBackPressed() {','\n        if (homeFeature != null && homeFeature.closeVideo()) return;'),
 ('protected void onPause() {','\n        if (homeFeature != null) homeFeature.closeVideo();'),
 ('private void showEditorialArticle(org.json.JSONObject article) {','\n        if (homeFeature != null) homeFeature.closeVideo();')]:
 assert s.count(anchor)==1,anchor
 s=s.replace(anchor,anchor+extra,1)
p.write_text(s)
assets=Path('app/src/main/assets');assets.mkdir(parents=True,exist_ok=True)
for name in ['home-features.html','home-model.js','youtube-seed.json']:
 shutil.copyfile('android-ui/assets/'+name,assets/name)
shutil.copyfile('android-ui/drawable-nodpi/column_sander_brink_clean.webp',assets/'column-portrait.webp')
shutil.copyfile('android-ui/java/HomeFeatureView.java',p.parent/'HomeFeatureView.java')
print('Installed three-subject carousel, paired features and current YouTube rail')

shutil.copyfile('android-ui/java/YoutubePlayerView.java',p.parent/'YoutubePlayerView.java')
