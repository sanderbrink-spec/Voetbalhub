"""Apply phase40 once, after interface39, without replacing data or column content."""
from pathlib import Path
import shutil,re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
old='new HomeMenu39(this,this::openDestination39)';assert s.count(old)==1;s=s.replace(old,'new HomeMenu39(this,this::openDestination39,this::showEditorialArticle)')
old='case "favorites":showFavorites();break;';assert s.count(old)==1
s=s.replace(old,old+'\n        case "myclub":showDestination39("myclub");break;\n        case "more":showMore();break;')
# Keep the existing screen tree, safe areas and bottom navigation layout.
s=s.replace('content.addView(root);','content.addView(root);PremiumDesign40.polish(root);')
s=s.replace('content.addView(root, new FrameLayout.LayoutParams(-1, -1));','content.addView(root, new FrameLayout.LayoutParams(-1, -1));PremiumDesign40.polish(root);')
# The launcher owns the opening carousel. News remains the actual news feed.
a=s.index('private void addEditorialNewsSection(LinearLayout parent, boolean columnOnly)');b=s.index('\n    private ',a+10)
method=s[a:b];start=method.find('    if(!columnOnly&&"Voor jou".equals(active)) {')
if start>=0:
 end=method.index('\n    }',start)+6;method=method[:start]+method[end:]
s=s[:a]+method+s[b:]
s=s.replace('private HomeFeatureView homeFeature;','private HomeFeatureView homeFeature;\n    private VideoShelf40 videoShelf40;',1)
s=s.replace('public void onBackPressed() {','public void onBackPressed() {\n        if(videoShelf40!=null&&videoShelf40.closeVideo())return;',1)
s=s.replace('protected void onPause() {','protected void onPause() {\n        if(videoShelf40!=null)videoShelf40.closeVideo();',1)
# Refresh the native catalogue instead of opening old search-result WebViews.
a=s.index('private void showVideos()');b=s.index('private void showColumn()',a)
s=s[:a]+'''private void showVideos(){
 enterScreen("videos",this::showVideos);content.removeAllViews();
 findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
 videoShelf40=new VideoShelf40(this);content.addView(videoShelf40,new android.widget.FrameLayout.LayoutParams(-1,-1));
}
'''+s[b:]
# Keep competition detail pages in the same app shell. No unlicensed tables are invented.
old='else{try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(x[1])));}catch(android.content.ActivityNotFoundException e){android.widget.Toast.makeText(this,"Geen browser beschikbaar",android.widget.Toast.LENGTH_SHORT).show();}}'
assert s.count(old)==1
s=s.replace(old,'else showCompetition40(x[0],x[1]);')
anchor='    private void showMore() {'
helper='''    private void showCompetition40(String name,String source){
 enterScreen("competition40:"+name,()->showCompetition40(name,source));content.removeAllViews();
 findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
 LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.addView(sectionHeader(name,"TERUG",this::onBackPressed));
 ScrollView scroll=new ScrollView(this);LinearLayout page=new LinearLayout(this);page.setOrientation(1);page.setPadding(dp(16),dp(12),dp(16),dp(28));
 android.widget.ImageView art=new android.widget.ImageView(this);art.setImageBitmap(PremiumDesign40.artwork(this,"competitions"));art.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);art.setContentDescription("Eigen decoratieve competitie-illustratie");PremiumDesign40.card(art,PremiumDesign40.EDGE);page.addView(art,new LinearLayout.LayoutParams(-1,dp(200)));
 TextView title=tv(name,27,C.TEXT,true);title.setPadding(0,dp(20),0,dp(12));page.addView(title);
 page.addView(tv("Programma, uitslagen en standen verschijnen zodra gecontroleerde gegevens voor deze competitie beschikbaar zijn.",15,C.MUTED,false));
 android.widget.Button official=new android.widget.Button(this);official.setText("Officiële competitiepagina openen ↗");official.setOnClickListener(v->{try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(source)));}catch(android.content.ActivityNotFoundException e){android.widget.Toast.makeText(this,"Geen browser beschikbaar",android.widget.Toast.LENGTH_SHORT).show();}});LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(20);page.addView(official,lp);scroll.addView(page);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));content.addView(root);PremiumDesign40.polish(root);
 }
'''
assert s.count(anchor)==1;s=s.replace(anchor,helper+anchor)
marker='        addPremiumTile(tileGrid, "Instellingen", "Instellingen", this::showSettings);'
assert s.count(marker)==1
s=s.replace(marker,'        addPremiumTile(tileGrid,"Meldingen","Nieuws en columns",()->showDestination39("notifications"));\n'+marker)
a=s.index('private void showClubQuiz()');b=s.index('\n    private ',a+10)
quiz=s[a:b].replace('findViewById(R.id.header).setVisibility(android.view.View.VISIBLE)','findViewById(R.id.header).setVisibility(android.view.View.GONE)')
s=s[:a]+quiz+s[b:]
# Shared backgrounds, including native settings and menus.
s=s.replace('setBackgroundColor(C.BG)','setBackgroundColor(PremiumDesign40.INK)')
for key,value in {'GREEN':'GREEN','TEXT':'WHITE','MUTED':'MUTED','BG':'INK','CARD':'SURFACE','BORDER':'EDGE'}.items():
 s=re.sub(r'(static final int '+key+r' = )0x[0-9A-Fa-f]+;',r'\1PremiumDesign40.'+value+';',s)
assert 'private void showColumn()' in s and 'private void showScores()' in s
p.write_text(s)
for f in ['PremiumDesign40','YoutubePlayerView','VideoShelf40','DestinationView39','HomeMenu39','HomeSlideshow40','MatchStrip40','CompetitionTile','FeedPanel','NewsListCard','NavIconView']:
 shutil.copyfile('android-ui/java/'+f+'.java',p.parent/(f+'.java'))
shutil.copyfile('android-ui/assets/clubquiz-ui.js','app/src/main/assets/clubquiz-ui.js')
shutil.copyfile('android-ui/assets/stadium-view.js','app/src/main/assets/stadium-view.js')
assets=Path('app/src/main/assets');shutil.copytree('android-ui/assets/premium40',assets/'premium40',dirs_exist_ok=True)
# Inline shared CSS to preserve restrictive WebView CSPs (no new network/style domains).
css=Path('android-ui/assets/premium40.css').read_text()
for src in Path('android-ui/assets').glob('*.html'):
 html=src.read_text()
 if '</style>' in html:html=html.replace('</style>','\n'+css+'\n</style>',1)
 else:
  assert '</head>' in html,src
  html=html.replace('</head>','<style>'+css+'</style></head>',1)
 (assets/src.name).write_text(html)
g=Path('app/build.gradle.kts');t=g.read_text();t=re.sub(r'versionCode\s*=\s*\d+','versionCode = 80',t);t=re.sub(r'versionName\s*=\s*"[^"]+"','versionName = "4.48-premium40"',t);g.write_text(t)
print('Phase40: shared native/WebView design, opening carousel, checked fixture strip, twelve routes and original artwork')
