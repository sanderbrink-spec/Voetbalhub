"""Phase42 final native changes after the complete audited phase41 pipeline."""
from pathlib import Path
import shutil,re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
a=s.index('private void showMore()');b=s.index('\n    private ',a+10)
s=s[:a]+'''private void showMore() {
 enterScreen("more",this::showMore);eredivisieStatisticsVisible=false;weeklyPreviewVisible=false;
 findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
 currentBottomTab="Meer";buildNav();content.removeAllViews();
 ScrollView scroll=new ScrollView(this);LinearLayout list=new LinearLayout(this);list.setOrientation(1);list.setPadding(dp(16),dp(12),dp(16),dp(26));
 moreSection42(list,"Algemeen");
 moreRow42(list,"Info","Over Veldio",()->new AlertDialog.Builder(this).setTitle("Over Veldio").setMessage("Alles voetbal. Eén plek. Eigen voetbalnieuws, clubquiz en De Derde Helft van Sander Brink. Veldio is onafhankelijk en geen officiële partner van de genoemde competities.").setPositiveButton("Sluiten",null).show());
 moreRow42(list,"Contact","Contact",this::showContact);
 moreSection42(list,"Instellingen");
 moreRow42(list,"Instellingen","App-instellingen",this::showSettings);
 moreRow42(list,"Meldingen","Meldingen",()->showDestination39("notifications"));
 moreRow42(list,"Advertentieprivacy","Advertentievoorkeuren",()->ads().privacy());
 moreSection42(list,"Juridisch");
 moreRow42(list,"Privacyverklaring","Privacyverklaring",()->openExternal42("https://voetbalhub-redactie.onrender.com/privacy"));
 moreRow42(list,"Info","Juridische informatie",this::showLegalInfo);
 scroll.addView(list);content.addView(scroll);
 }
 private void openExternal42(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(android.content.ActivityNotFoundException e){android.widget.Toast.makeText(this,"Geen browser beschikbaar",android.widget.Toast.LENGTH_SHORT).show();}}
 private void moreSection42(LinearLayout list,String name){TextView t=tv(name.toUpperCase(new java.util.Locale("nl","NL")),12,C.GREEN,true);t.setPadding(dp(4),dp(22),0,dp(8));list.addView(t);}
 private void moreRow42(LinearLayout list,String icon,String title,Runnable action){
 LinearLayout row=new LinearLayout(this);row.setGravity(android.view.Gravity.CENTER_VERTICAL);row.setMinimumHeight(dp(54));row.setPadding(dp(10),dp(12),dp(10),dp(12));
 row.addView(new NavIconView(this,icon,true),new LinearLayout.LayoutParams(dp(22),dp(22)));TextView t=tv(title,16,C.TEXT,false);t.setPadding(dp(14),0,dp(8),0);row.addView(t,new LinearLayout.LayoutParams(0,-2,1));row.addView(tv("›",20,C.MUTED,false));
 PremiumDesign40.touch(row);row.setContentDescription(title);row.setOnClickListener(v->action.run());list.addView(row,new LinearLayout.LayoutParams(-1,-2));android.view.View divider=new android.view.View(this);divider.setBackgroundColor(PremiumDesign40.EDGE);list.addView(divider,new LinearLayout.LayoutParams(-1,dp(1)));
 }
'''+s[b:]
s=s.replace('https://www.premierleague.com/fixtures','https://www.premierleague.com/')
p.write_text(s)
for name in ['CompetitionEmblem42','VideoShelf40','HomeMenu39','CompetitionTile','EditorialPhotos','EditorialIllustrations42','Branding','NewsListCard','HomeSlideshow40']:
 shutil.copyfile('android-ui/java/'+name+'.java',p.parent/(name+'.java'))
shutil.copytree('android-ui/assets/news42',Path('app/src/main/assets/news42'),dirs_exist_ok=True)
g=Path('app/build.gradle.kts');t=g.read_text();t=re.sub(r'versionCode\s*=\s*\d+','versionCode = 82',t);t=re.sub(r'versionName\s*=\s*"[^"]+"','versionName = "4.50-phase42"',t);g.write_text(t)
print('Phase42 compact More, independent emblems, summaries and approved image fallback installed')
