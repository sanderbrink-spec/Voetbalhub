"""Install the twelve-destination interface on top of the approved visual38 APK."""
from pathlib import Path
import shutil,re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
# New launcher route, keeping original news and carousel intact as a destination.
start=s.index('protected void onCreate(');end=s.index('\n    private ',start)
method=s[start:end];assert method.count('        showNews();')==1
method=method.replace('        showNews();','        ImageRegistry39.load(this);\n        showHome39();\n        newsNotifications39=new NewsNotifications39(this);')
method=method.replace('articleDisplayLimit = 20; buildChips(); showNews();','articleDisplayLimit = 20; buildChips(); showHome39();')
s=s[:start]+method+s[end:]
s=s.replace('private HomeFeatureView homeFeature;','private HomeFeatureView homeFeature;\n    private NewsNotifications39 newsNotifications39;')
# Home occupies the original first bottom-navigation slot, all four other slots retained.
s=s.replace('{{"⌂", "Nieuws"}', '{{"⌂", "Home"}')
s=s.replace('case "Nieuws": currentBottomTab = "Nieuws"; buildNav(); active = "Voor jou"; articleDisplayLimit = 20; buildChips(); showNews(); break;', 'case "Home": currentBottomTab = "Home"; buildNav(); showHome39(); break;')
anchor='    private void showMore() {'
helper='''    private void showHome39(){showDestination39("home");}
    private void openDestination39(String id){
        switch(id){
        case "news":active="Voor jou";articleDisplayLimit=20;showNews();break;
        case "competitions":showCompetitions();break;
        case "quiz":showClubQuiz();break;
        case "stadium":showStadiums("");break;
        case "column":showColumn();break;
        case "videos":showVideos();break;
        case "standings":showEredivisieStatistics(false);break;
        case "favorites":showFavorites();break;
        case "fixtures":case "predictions":case "clubs":case "notifications":showDestination39(id);break;
        }
    }
    private void showDestination39(String mode){
        enterScreen("destination39:"+mode,()->showDestination39(mode));
        if(liveScoresRefresh!=null)main.removeCallbacks(liveScoresRefresh);
        if(homeFeature!=null)homeFeature.closeVideo();
        personalHubVisible=false;personalHub=null;eredivisieStatisticsVisible=false;weeklyPreviewVisible=false;scoresPageVisible=false;clubQuizView=null;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        currentBottomTab="home".equals(mode)?"Home":"";buildNav();content.removeAllViews();
        content.addView("home".equals(mode)?new HomeMenu39(this,this::openDestination39):new DestinationView39(this,mode,this::openDestination39,name->showPersonalHub("search",name)),new android.widget.FrameLayout.LayoutParams(-1,-1));
    }
'''
assert s.count(anchor)==1;s=s.replace(anchor,helper+anchor)
# Accessible ripple feedback for the existing secondary tiles.
marker='tile.setFocusable(true);tile.setClickable(true);'
s=s.replace(marker,'android.util.TypedValue feedback=new android.util.TypedValue();getTheme().resolveAttribute(android.R.attr.selectableItemBackground,feedback,true);tile.setForeground(getDrawable(feedback.resourceId));'+marker)
# Destroy the one activity-scoped feed observer.
marker='protected void onDestroy() {'
assert marker in s;s=s.replace(marker,marker+'\n        if(newsNotifications39!=null)newsNotifications39.dispose();',1)
p.write_text(s)
for f in ['HomeMenu39.java','DestinationView39.java','NewsNotifications39.java','NavIconView.java','FeedPanel.java','NewsListCard.java','EditorialPhotos.java','ImageRegistry39.java','TopicArtwork39.java','Branding.java']:
 shutil.copyfile('android-ui/java/'+f,p.parent/f)
assets=Path('app/src/main/assets');shutil.copyfile('android-ui/assets/destinations39.html',assets/'destinations39.html');shutil.copytree('android-ui/assets/icons',assets/'icons',dirs_exist_ok=True);shutil.copytree('android-ui/assets/news-photos',assets/'news-photos',dirs_exist_ok=True)
shutil.copytree('android-ui/assets/quiz-art39',assets/'quiz-art39',dirs_exist_ok=True)
for f in ['clubquiz-ui.js','image-registry39.json','image-registry39.js','personal-hub.html','home-features.html']:shutil.copyfile('android-ui/assets/'+f,assets/f)
g=Path('app/build.gradle.kts');t=g.read_text();t=re.sub(r'versionCode\s*=\s*\d+','versionCode = 79',t);t=re.sub(r'versionName\s*=\s*"[^"]+"','versionName = "4.47-interface39"',t);g.write_text(t)
manifest=Path('app/src/main/AndroidManifest.xml');t=manifest.read_text()
if 'android.permission.POST_NOTIFICATIONS' not in t:t=t.replace('<application','<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>\n    <application',1)
manifest.write_text(t)
print('Interface39: twelve unique destinations, original news carousel, bounded data and local tools installed')
