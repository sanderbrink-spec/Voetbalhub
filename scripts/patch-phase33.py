"""Install bounded loading and the independent stadium archive after phase 32 patches."""
from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
old='new HomeFeatureView(this,this::showEditorialArticle,this::showWeeklyPreview,this::showColumn)'
assert s.count(old)==1,'Home constructor anchor changed'
s=s.replace(old,'new HomeFeatureView(this, this::showEditorialArticle, this::showWeeklyPreview, this::showColumn, this::showStadiums)')
anchor='    private void showMore() {'
assert s.count(anchor)==1
s=s.replace(anchor,'''    private void showStadiums(String id) {
        enterScreen("stadiums:"+id,()->showStadiums(id));
        personalHubVisible=false; personalHub=null; eredivisieStatisticsVisible=false; weeklyPreviewVisible=false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();content.addView(new StadiumView(this,id,this::onBackPressed),new android.widget.FrameLayout.LayoutParams(-1,-1));
    }
'''+anchor)
anchor='        addActionRow(list, "Favorieten", "Mijn clubs", this::showFavorites);'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'\n        addActionRow(list, "Stadions", "Stadion van de week", ()->showStadiums(""));')
p.write_text(s)
for name in ['DeadlineHttp','StadiumRepository','StadiumView','FeedRepository','FeedPanel','HomeFeatureView']:
 shutil.copyfile('android-ui/java/'+name+'.java',p.parent/(name+'.java'))
assets=Path('app/src/main/assets')
for name in ['news-bootstrap.json','stadium-bootstrap.json','stadium.html','stadium-view.js','home-features.html']:
 shutil.copyfile('android-ui/assets/'+name,assets/name)
print('Phase 33: bounded requests, offline feed, stadium long-read/archive, football quiz')
