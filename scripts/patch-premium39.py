"""Targeted premium menu and quiz entry points. Keep carousel geometry, logo and column portrait."""
from pathlib import Path
import shutil,re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
old='new HomeFeatureView(this, this::showEditorialArticle, this::showWeeklyPreview, this::showColumn, this::showStadiums)';assert s.count(old)==1;s=s.replace(old,old[:-1]+', this::showClubQuiz)')
a=s.index('private void showMore()');b=s.index('\n    private ',a+10);method=s[a:b];first=method.index('addActionRow(list,')
method=method[:first]+'''android.widget.GridLayout tileGrid=new android.widget.GridLayout(this);tileGrid.setColumnCount(2);tileGrid.setUseDefaultMargins(false);list.addView(tileGrid,new LinearLayout.LayoutParams(-1,-2));
        '''+method[first:];method=method.replace('addActionRow(list,','addPremiumTile(tileGrid,');s=s[:a]+method+s[b:]
helper='''    private void addPremiumTile(android.widget.GridLayout grid,String title,String subtitle,Runnable action){
        LinearLayout tile=new LinearLayout(this);tile.setOrientation(LinearLayout.VERTICAL);tile.setGravity(android.view.Gravity.CENTER);tile.setPadding(dp(9),dp(12),dp(9),dp(12));
        android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,new int[]{0xFF142C1D,0xFF030A06});bg.setCornerRadius(dp(15));bg.setStroke(dp(1),0xFF50754A);tile.setBackground(bg);tile.setElevation(dp(2));
        NavIconView icon=new NavIconView(this,title,true);tile.addView(icon,new LinearLayout.LayoutParams(dp(34),dp(34)));TextView label=tv(title,15,0xFFF1F8F1,true);label.setGravity(android.view.Gravity.CENTER);label.setMaxLines(2);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(7);tile.addView(label,lp);
        if(!subtitle.equals(title)){TextView small=tv(subtitle,10,0xFFB1C8B5,false);small.setGravity(android.view.Gravity.CENTER);small.setMaxLines(2);tile.addView(small);}
        tile.setFocusable(true);tile.setClickable(true);tile.setOnClickListener(v->action.run());android.widget.GridLayout.LayoutParams gp=new android.widget.GridLayout.LayoutParams();gp.width=0;gp.height=dp(127);gp.columnSpec=android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED,1f);gp.setMargins(dp(5),dp(5),dp(5),dp(5));grid.addView(tile,gp);
    }
'''
s=s.replace('    private void showMore() {',helper+'    private void showMore() {',1);p.write_text(s)
for name in ['HomeFeatureView.java','ClubQuizView.java','NavIconView.java']:shutil.copyfile('android-ui/java/'+name,p.parent/name)
# Child/unknown-age test build: no ads SDK, automatic ad initialisers, or advertising IDs.
g=Path('app/build.gradle.kts');x=g.read_text();x=re.sub(r'\s*implementation\("com.google.android.gms:play-services-ads:[^\"]+"\)','',x);x=re.sub(r'\s*implementation\("com.google.android.ump:user-messaging-platform:[^\"]+"\)','',x);g.write_text(x)
shutil.copyfile('android-ui/java/AdController39.java',p.parent/'AdController.java')
manifest=Path('app/src/main/AndroidManifest.xml');x=manifest.read_text();x=re.sub(r'<meta-data android:name="com.google.android.gms.ads.[^"]+"[^>]+/>','',x);manifest.write_text(x)
print('Premium 39 menu, native quiz bridge, original branding and ad-free mixed-age test installed')
