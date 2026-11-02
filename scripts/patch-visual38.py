"""Add the phase-38 upgrade after the latest Android patches, preserving screen routes."""
from pathlib import Path
import shutil,re
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
a=s.index('private void showCompetitions()');b=s.index('\n    private ',a+10);method=s[a:b]
start=method.index('for (String[] x : c)');end=method.index('ScrollView scroll',start)
method=method[:start]+'''android.widget.GridLayout grid=new android.widget.GridLayout(this);grid.setColumnCount(2);
        android.graphics.Bitmap arena=CompetitionTile.artwork(this);
        String[] codes={"ED","KKD","CL","EL","CO","PL","LL","SA","BL","L1"};
        int[] accents={0xFF338AF4,0xFFDA3651,0xFF436DF1,0xFFEF9426,0xFF40C94B,0xFFAE52D1,0xFFDB436B,0xFF2E9DE4,0xFFDD383F,0xFF438A9C};
        for(int i=0;i<c.length;i++){final String[] x=c[i];CompetitionTile tile=new CompetitionTile(this,x[0],codes[i%codes.length],accents[i%accents.length],arena,()->{if("Eredivisie".equals(x[0]))showEredivisieStatistics(false);else{try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(x[1])));}catch(android.content.ActivityNotFoundException e){android.widget.Toast.makeText(this,"Geen browser beschikbaar",android.widget.Toast.LENGTH_SHORT).show();}}});
            android.widget.GridLayout.LayoutParams gp=new android.widget.GridLayout.LayoutParams();gp.width=0;gp.height=-2;gp.columnSpec=android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED,1f);gp.setMargins(dp(5),dp(6),dp(5),dp(6));grid.addView(tile,gp);
        }
        list.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        TextView artNote=tv("Eigen competitie-emblemen · AI-sfeerbeeld van een fictief stadion",10,C.MUTED,false);artNote.setPadding(dp(9),dp(10),dp(9),dp(12));list.addView(artNote);
        '''+method[end:];s=s[:a]+method+s[b:];p.write_text(s)
shutil.copyfile('android-ui/java/CompetitionTile.java',p.parent/'CompetitionTile.java')
for f in ['PersonalHubView.java','PresentationCovers.java']:shutil.copyfile('android-ui/java/'+f,p.parent/f)
assets=Path('app/src/main/assets')
for f in ['club-directory.json','club-directory.js','personal-hub.html','veldio-arena.webp','visual-rights38.json','home-features.html','clubquiz.html','clubquiz-ui.js','quiz39.css','clubquiz-engine.js','stadium-view.js']:shutil.copyfile('android-ui/assets/'+f,assets/f)
shutil.copyfile('android-ui/assets/veldio-arena.webp',assets/'news-photos/veldio-arena.webp')
g=Path('app/build.gradle.kts');t=g.read_text();t=re.sub(r'versionCode\s*=\s*\d+','versionCode = 77',t);t=re.sub(r'versionName\s*=\s*"[^"]+"','versionName = "4.45-visual38"',t);g.write_text(t)
print('Phase 38: competition grid, offline directory, acknowledged saves and original arena artwork installed')
