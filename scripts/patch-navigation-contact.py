"""Install a single Back stack, responsive thumbnails and the contact form."""
from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
def replace_method(source,signature,replacement):
 start=source.index(signature);brace=source.index('{',start);depth=0
 for i in range(brace,len(source)):
  if source[i]=='{':depth+=1
  elif source[i]=='}':
   depth-=1
   if depth==0:return source[:start]+replacement+source[i+1:]
 raise ValueError(signature)
anchor='private HomeFeatureView homeFeature;';assert anchor in s
s=s.replace(anchor,anchor+'''
    private final ScreenHistory screenHistory = new ScreenHistory();
    private EredivisieStatsView statisticsView;
    private boolean statisticsFeature;
    private String personalMode = "favorites", personalQuery = "";
    private ContactView contactView;
    private String contactDraft = "{}";
    private android.app.Dialog exitDialog;
    private Runnable cancelScrollRestore;
''',1)
helpers='''
    private ScrollView pageScroll(android.view.View view) {
        if(view instanceof ScrollView)return (ScrollView)view;
        if(view instanceof android.view.ViewGroup){android.view.ViewGroup group=(android.view.ViewGroup)view;for(int i=0;i<group.getChildCount();i++){ScrollView found=pageScroll(group.getChildAt(i));if(found!=null)return found;}}
        return null;
    }
    private void rememberScreen() {
        ScreenHistory.Entry entry=screenHistory.current();if(entry==null)return;
        ScrollView scroll=pageScroll(content);if(scroll!=null)entry.scrollY=scroll.getScrollY();
        if(entry.key.startsWith("personal:")&&personalHub!=null){final String mode=personalMode,query=personalQuery,snapshot=personalHub.navigationState();entry.restore=()->showPersonalHub(mode,query,snapshot);}
        if(entry.key.startsWith("statistics:")&&statisticsView!=null){final boolean feature=statisticsFeature;final String snapshot=statisticsView.navigationState();entry.restore=()->showEredivisieStatistics(feature,snapshot);}
        if(entry.key.equals("contact")&&contactView!=null)contactDraft=contactView.draft();
    }
    private void enterScreen(String key,Runnable restore) {
        if(cancelScrollRestore!=null){cancelScrollRestore.run();cancelScrollRestore=null;}
        if(!screenHistory.isRestoring()) {rememberScreen();screenHistory.enter(key,restore);}
    }
    private boolean previousScreen() {
        rememberScreen();
        if(!screenHistory.back())return false;
        final int y=screenHistory.current().scrollY;
        final String route=screenHistory.current().key;
        main.post(()->{
            ScrollView scroll=pageScroll(content);if(scroll==null)return;
            android.view.ViewTreeObserver.OnGlobalLayoutListener[] listener=new android.view.ViewTreeObserver.OnGlobalLayoutListener[1];
            cancelScrollRestore=()->{if(content.getViewTreeObserver().isAlive())content.getViewTreeObserver().removeOnGlobalLayoutListener(listener[0]);scroll.setOnTouchListener(null);};
            listener[0]=()->{if(!screenHistory.current().key.equals(route)){if(cancelScrollRestore!=null)cancelScrollRestore.run();return;}int range=scroll.getChildCount()==0?0:Math.max(0,scroll.getChildAt(0).getHeight()-scroll.getHeight());scroll.scrollTo(0,y);if(range>=y&&cancelScrollRestore!=null){cancelScrollRestore.run();cancelScrollRestore=null;}};
            scroll.setOnTouchListener((v,event)->{if(event.getAction()==android.view.MotionEvent.ACTION_DOWN&&cancelScrollRestore!=null){cancelScrollRestore.run();cancelScrollRestore=null;}return false;});
            content.getViewTreeObserver().addOnGlobalLayoutListener(listener[0]);listener[0].onGlobalLayout();
        });
        return true;
    }
    private void showContact() {
        enterScreen("contact",this::showContact);
        if(homeFeature!=null)homeFeature.closeVideo();
        personalHubVisible=false;weeklyPreviewVisible=false;eredivisieStatisticsVisible=false;scoresPageVisible=false;
        currentBottomTab="Meer";buildNav();findViewById(R.id.header).setVisibility(android.view.View.GONE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();contactView=new ContactView(this,contactDraft,this::onBackPressed);content.addView(contactView,new android.widget.FrameLayout.LayoutParams(-1,-1));
    }
'''
s=s.replace('private void showNews() {',helpers+'''\n    private void showNews() {
        final String category=active;enterScreen("news:"+category,()->{active=category;buildChips();showNews();});''',1)
for method,key in [('showColumn','column'),('showCompetitions','competitions'),('showMore','more'),('showScores','scores'),('showVideos','videos')]:
 anchor='private void '+method+'() {';assert s.count(anchor)==1
 s=s.replace(anchor,anchor+'\n        enterScreen("'+key+'",this::'+method+');',1)
anchor='private void showWeeklyPreview(String snapshot) {';assert anchor in s
s=s.replace(anchor,anchor+'\n        enterScreen("preview:"+snapshot.hashCode(),()->showWeeklyPreview(snapshot));',1)
# Overloads carry the exact internal tab/search state when returning from another screen.
anchor='private void showPersonalHub(String mode,String query) {';assert anchor in s
s=s.replace(anchor,'''private void showPersonalHub(String mode,String query) {showPersonalHub(mode,query,"");}
    private void showPersonalHub(String mode,String query,String restoredState) {
        enterScreen("personal:"+mode+":"+query,()->showPersonalHub(mode,query,restoredState));personalMode=mode;personalQuery=query;''',1)
s=s.replace('new PersonalHubView(this, mode, query, this::showEditorialArticle, this::showNews)', 'new PersonalHubView(this, mode, query, this::showEditorialArticle, this::onBackPressed,restoredState)')
anchor='private void showEredivisieStatistics(boolean feature) {';assert anchor in s
s=s.replace(anchor,'''private void showEredivisieStatistics(boolean feature) {showEredivisieStatistics(feature,"");}
    private void showEredivisieStatistics(boolean feature,String restoredState) {
        enterScreen("statistics:"+feature,()->showEredivisieStatistics(feature,restoredState));statisticsFeature=feature;''',1)
s=s.replace('content.addView(new EredivisieStatsView(this, this::showCompetitions, feature),', 'statisticsView=new EredivisieStatsView(this, this::onBackPressed, feature,restoredState);\n        content.addView(statisticsView,')
s=s.replace('new MatchPreviewView(this, snapshot, this::showNews)', 'new MatchPreviewView(this, snapshot, this::onBackPressed)')
s=s.replace('sectionHeader("De Derde Helft", "NIEUWS", this::showNews)', 'sectionHeader("De Derde Helft", "TERUG", this::onBackPressed)')
s=s.replace('sectionHeader("Uitslagen", "NIEUWS", this::showNews)', 'sectionHeader("Uitslagen", "TERUG", this::onBackPressed)')
# Contact is a real internal page, not a mail link disguised as a page.
a=s.index('        addActionRow(list, "Contact", "Contact",');b=s.index('\n',a)
s=s[:a]+'        addActionRow(list, "Contact", "Contact", this::showContact);'+s[b:]
s=s.replace('voetbalhub.app@gmail.com','voetbalhub@gmail.com')
back='''public void onBackPressed() {
        screenHistory.resetExit();
        if(editorialDialog!=null&&editorialDialog.isShowing()){closeEditorialArticle();return;}
        if(articleDialog!=null&&articleDialog.isShowing()){closeArticleView();return;}
        if(homeFeature!=null&&homeFeature.closeVideo()){screenHistory.resetExit();return;}
        if(personalHubVisible&&personalHub!=null&&personalHub.handleBack()){screenHistory.resetExit();return;}
        if(eredivisieStatisticsVisible&&statisticsView!=null&&statisticsView.handleBack()){screenHistory.resetExit();return;}
        if(previousScreen())return;
        if(screenHistory.confirmExit(android.os.SystemClock.elapsedRealtime())){
            if(exitDialog!=null&&exitDialog.isShowing())return;
            exitDialog=new AlertDialog.Builder(this).setTitle("VoetbalHub afsluiten?")
                .setMessage("Wil je de app afsluiten?").setNegativeButton("Annuleren",(d,w)->screenHistory.resetExit())
                .setPositiveButton("Afsluiten",(d,w)->finish()).create();
            exitDialog.setOnCancelListener(d->screenHistory.resetExit());exitDialog.show();
        }
    }'''
# Do not reset the root double-press timer before evaluating it.
back=back.replace('        screenHistory.resetExit();\n','')
# Only actual page/modal Back steps reset exit arming.
back=back.replace('closeEditorialArticle();return;', 'screenHistory.resetExit();closeEditorialArticle();return;').replace('closeArticleView();return;', 'screenHistory.resetExit();closeArticleView();return;')
s=replace_method(s,'public void onBackPressed()',back)
# Remove the former home-only exit flow; only ScreenHistory handles Back now.
s=replace_method(s,'private boolean returnToNewsBottomTab()', '')
s=s.replace('    private boolean backPressedOnce = false;','').replace('    private final Runnable resetBackPressed = () -> backPressedOnce = false;','').replace('        main.removeCallbacks(resetBackPressed);','')
# previousScreen must not reset exit arming if there is no previous route.
s=s.replace('        if(!screenHistory.back())return false;', '        if(!screenHistory.canGoBack())return false;\n        screenHistory.back();')
# A background refresh must never navigate away from contact/search/statistics.
a=s.index('private void refreshNews()');b=s.index('private String newestArticleDate(',a)
refresh=s[a:b].replace('        showNews();','        if(screenHistory.current()!=null&&screenHistory.current().key.startsWith("news:")&&!editorialArticleOpen&&!articleOpen)showNews();').replace('                showNews();','                if(screenHistory.current()!=null&&screenHistory.current().key.startsWith("news:")&&!editorialArticleOpen&&!articleOpen)showNews();')
s=s[:a]+refresh+s[b:]
# Android back gestures and the hardware button use the same implementation.
anchor='super.onCreate(savedInstanceState);'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+"\n        getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){@Override public void handleOnBackPressed(){MainActivity.this.onBackPressed();}});",1)
for anchor in ['private void showSettings() {','private void showLegalInfo() {','private void showEditorialArticle(org.json.JSONObject article) {','private void openArticle(String url, String title) {','protected void onPause() {']:
 assert s.count(anchor)==1,anchor
 s=s.replace(anchor,anchor+'\n        screenHistory.resetExit();',1)
# External web readers step back within their page history before closing the reader.
s=s.replace('if(articleDialog!=null&&articleDialog.isShowing()){screenHistory.resetExit();closeArticleView();return;}', 'if(articleDialog!=null&&articleDialog.isShowing()){screenHistory.resetExit();if(activeWebView!=null&&activeWebView.canGoBack())activeWebView.goBack();else closeArticleView();return;}')
s=s.replace('close.setOnClickListener(v -> closeArticleView());','close.setOnClickListener(v -> onBackPressed());')
anchor='articleDialog.show();'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'\n            articleDialog.setOnKeyListener((dialog,key,event)->{if(key!=android.view.KeyEvent.KEYCODE_BACK)return false;if(event.getAction()==android.view.KeyEvent.ACTION_UP)onBackPressed();return true;});\n            if(android.os.Build.VERSION.SDK_INT>=33)articleDialog.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::onBackPressed);',1)
p.write_text(s)
for name in ['ScreenHistory.java','WebPageHistory.java','ContactView.java','PersonalHubView.java','EredivisieStatsView.java','NewsListCard.java']:
 shutil.copyfile('android-ui/java/'+name,p.parent/name)
assets=Path('app/src/main/assets')
for name in ['page-history.js','contact.html','personal-hub.html','eredivisie.html']:shutil.copyfile('android-ui/assets/'+name,assets/name)
print('Installed previous-screen navigation, responsive article images and contact form')
