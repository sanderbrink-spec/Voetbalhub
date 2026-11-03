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
# Refresh the native catalogue instead of opening old search-result WebViews.
a=s.index('private void showVideos()');b=s.index('\n    private ',a+10)
s=s[:a]+'''private void showVideos(){
 enterScreen("videos",this::showVideos);content.removeAllViews();
 findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
 content.addView(new VideoShelf40(this),new android.widget.FrameLayout.LayoutParams(-1,-1));
}
'''+s[b:]
# Shared backgrounds, including native settings and menus.
s=s.replace('setBackgroundColor(C.BG)','setBackgroundColor(PremiumDesign40.INK)')
for key,value in {'GREEN':'GREEN','TEXT':'WHITE','MUTED':'MUTED','BG':'INK','CARD':'SURFACE','BORDER':'EDGE'}.items():
 s=re.sub(r'(static final int '+key+r' = )0x[0-9A-Fa-f]+;',r'\1PremiumDesign40.'+value+';',s)
p.write_text(s)
for f in ['PremiumDesign40','VideoShelf40','DestinationView39','HomeMenu39','HomeSlideshow40','MatchStrip40','CompetitionTile','NewsListCard','NavIconView']:
 shutil.copyfile('android-ui/java/'+f+'.java',p.parent/(f+'.java'))
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
