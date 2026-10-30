from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java')
s=p.read_text()
marker='public class MainActivity'
i=s.index('{',s.index(marker))+1
s=s[:i]+'\n    private boolean eredivisieStatisticsVisible = false;\n'+s[i:]
for method in ['showNews','showColumn','showScores','showCompetitions','showFavorites','showMore']:
 marker='private void '+method+'() {'
 assert marker in s,marker
 s=s.replace(marker,marker+'\n        eredivisieStatisticsVisible = false;',1)
old='for (String[] x : c) addSiteCard(list, x[0], "Officiële competitiepagina", x[1], "https://www.google.com/s2/favicons?domain=" + x[2] + "&sz=128");'
assert old in s
new='''for (String[] x : c) {
            if ("Eredivisie".equals(x[0])) {
                TextView entry = tv("EREDIVISIE  ›\\nStand · Uitslagen · Programma\\nTopscorers · Assists · Clubstatistieken", 17, C.TEXT, true);
                entry.setPadding(dp(18), dp(20), dp(18), dp(20));
                entry.setBackground(cardBackground());
                entry.setOnClickListener(v -> showEredivisieStatistics(false));
                list.addView(entry, new LinearLayout.LayoutParams(-1, -2));
            } else addSiteCard(list, x[0], "Officiële competitiepagina", x[1], "https://www.google.com/s2/favicons?domain=" + x[2] + "&sz=128");
        }'''
s=s.replace(old,new,1)
marker='public void onBackPressed() {'
assert marker in s
s=s.replace(marker,marker+'\n        if (eredivisieStatisticsVisible) { showCompetitions(); return; }',1)
methods='''
    private void showEredivisieStatistics(boolean feature) {
        if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
        scoresPageVisible = false;
        eredivisieStatisticsVisible = true;
        currentBottomTab = "Competities";
        buildNav();
        content.removeAllViews();
        content.addView(new EredivisieStatsView(this, this::showCompetitions, feature), new android.widget.FrameLayout.LayoutParams(-1, -1));
    }
    private void addEredivisieFeature(LinearLayout parent) {
        LinearLayout card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(16)); card.setBackground(cardBackground());
        TextView title = tv("Eredivisie · Alle statistieken  ›", 17, C.TEXT, true);
        card.addView(tv("WEDSTRIJD VAN DE SPEELRONDE", 11, C.GREEN, true));card.addView(title);
        card.addView(tv("Stand, programma, uitslagen en topscorers", 12, C.MUTED, false));
        card.setOnClickListener(v -> showEredivisieStatistics(false));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1,-2);lp.setMargins(dp(4),dp(8),dp(4),dp(12));parent.addView(card,lp);
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection=(HttpURLConnection)new URL("https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json?v="+(System.currentTimeMillis()/60000)).openConnection();
                connection.setConnectTimeout(12000);connection.setReadTimeout(15000);connection.setInstanceFollowRedirects(false);
                if(connection.getResponseCode()!=200)return;
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                try(InputStream in=connection.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>3000000)return;}}
                JSONObject data=new JSONObject(out.toString("UTF-8")),feature=data.optJSONObject("featured");
                if(feature==null)return;
                JSONObject preview=feature.optJSONObject("preview");if(preview==null)return;
                String kickoff=preview.getJSONObject("fixture").optString("date", "");
                long time=java.time.Instant.parse(kickoff).toEpochMilli();if(time<=System.currentTimeMillis())return;
                String headline=preview.optString("headline", "Wedstrijd van de speelronde");
                runOnUiThread(() -> {title.setText(headline+"  ›");card.setOnClickListener(v->showEredivisieStatistics(true));});
            } catch(Exception ignored) {} finally {if(connection!=null)connection.disconnect();}
        });
    }
'''
marker='    private void showCompetitions()'
s=s.replace(marker,methods+'\n'+marker,1)
# One compact feature at the top; no row of linked match previews.
marker='if ("Voor jou".equals(active)) { addEditorialNewsSection(list, false);'
assert marker in s
s=s.replace(marker,'if ("Voor jou".equals(active)) { addEredivisieFeature(list); addEditorialNewsSection(list, false);',1)
p.write_text(s)
assets=Path('app/src/main/assets');assets.mkdir(parents=True,exist_ok=True)
shutil.copyfile('android-ui/assets/eredivisie.html',assets/'eredivisie.html')
shutil.copyfile('android-ui/java/EredivisieStatsView.java',p.parent/'EredivisieStatsView.java')
print('Installed internal Eredivisie statistics and weekly feature subpage')
