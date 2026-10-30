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
        WeeklyMatchCard feature = new WeeklyMatchCard(this, () -> showEredivisieStatistics(false), () -> showEredivisieStatistics(true));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(dp(4), dp(8), dp(4), dp(16));
        parent.addView(feature, lp);
    }

'''
marker='    private void showCompetitions()'
s=s.replace(marker,methods+'\n'+marker,1)
# One compact feature at the top; no row of linked match previews.
marker='if ("Voor jou".equals(active)) { addEditorialNewsSection(list, false);'
assert marker in s
s=s.replace(marker,'if ("Voor jou".equals(active)) { addEredivisieFeature(list); addEditorialNewsSection(list, false);',1)
# Keep the home column compact; the dedicated Column tab retains its full portrait.
start = s.index('                  // Prominent editorial column feature:') if '                  // Prominent editorial column feature:' in s else s.index('// Prominent editorial column feature:')
end = s.index('// The image cards already carry the Originals label;',start)
column = """LinearLayout columnHero = new LinearLayout(this);
                  columnHero.setOrientation(LinearLayout.HORIZONTAL);
                  columnHero.setGravity(android.view.Gravity.CENTER_VERTICAL);
                  columnHero.setPadding(dp(12), dp(12), dp(12), dp(12));
                  columnHero.setBackground(cardBackground());
                  LinearLayout.LayoutParams columnLp = new LinearLayout.LayoutParams(-1, -2);
                  columnLp.setMargins(0, dp(2), 0, dp(16));
                  if (!columnOnly && "Voor jou".equals(active)) section.addView(columnHero, columnLp);
                  android.widget.ImageView homeColumnPortrait = new android.widget.ImageView(this);
                  homeColumnPortrait.setImageResource(nl.voetbalhub.app.R.drawable.column_sander_brink);
                  homeColumnPortrait.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
                  homeColumnPortrait.setContentDescription("Column door Sander Brink");
                  LinearLayout.LayoutParams thumb = new LinearLayout.LayoutParams(dp(72), dp(96));
                  thumb.setMargins(0, 0, dp(14), 0);
                  columnHero.addView(homeColumnPortrait, thumb);
                  LinearLayout columnCopy = new LinearLayout(this); columnCopy.setOrientation(LinearLayout.VERTICAL);
                  columnHero.addView(columnCopy, new LinearLayout.LayoutParams(0, -2, 1));
                  TextView columnAuthor = tv("COLUMN · SANDER BRINK", 10, C.GREEN, true);
                  columnCopy.addView(columnAuthor);
                  TextView columnTitle = tv("De Derde Helft", 19, C.TEXT, true);
                  columnTitle.setPadding(0, dp(5), 0, dp(5)); columnTitle.setMaxLines(2); columnTitle.setEllipsize(android.text.TextUtils.TruncateAt.END);
                  columnCopy.addView(columnTitle);
                  TextView columnSub = tv("Een eigen kijk op het voetbal.", 12, C.MUTED, false);
                  columnSub.setMaxLines(2); columnSub.setEllipsize(android.text.TextUtils.TruncateAt.END);columnCopy.addView(columnSub);
                  TextView columnAction = tv("Bekijk de column  →", 12, C.GREEN, true);
                  columnAction.setPadding(0, dp(8), 0, 0);columnCopy.addView(columnAction);
                  columnHero.setOnClickListener(v -> showColumn());
                  columnAction.setOnClickListener(v -> showColumn());
                  """
s=s[:start]+column+s[end:]
s=s.replace('columnHero.setOnClickListener(v -> showEditorialArticle(featured));','columnHero.setOnClickListener(v -> showEditorialArticle(featured)); columnAction.setOnClickListener(v -> showEditorialArticle(featured));')
s=s.replace('if (!columnOnly) section.setBackground(cardBackground());','')
s=s.replace('section.setPadding(columnOnly ? 0 : dp(6), dp(7), columnOnly ? 0 : dp(6), dp(7));','section.setPadding(0, dp(7), 0, dp(7));')
s=s.replace('Alleen eigen VoetbalHub-artikelen','Nieuws, achtergronden en jouw clubs')
s=s.replace('tv("LAATSTE NIEUWS  ·  VOETBALHUB ORIGINALS", 14, C.GREEN, true)','tv("Laatste nieuws", 18, C.TEXT, true)')
s=s.replace('card.setBackgroundColor(0xFF101917);','card.setBackground(cardBackground()); card.setClipToOutline(true);')
s=s.replace('headline.setLineSpacing(dp(3), 1.0f);','headline.setLineSpacing(dp(3), 1.0f); headline.setMaxLines(3); headline.setEllipsize(android.text.TextUtils.TruncateAt.END);')

p.write_text(s)
assets=Path('app/src/main/assets');assets.mkdir(parents=True,exist_ok=True)
shutil.copyfile('android-ui/assets/eredivisie.html',assets/'eredivisie.html')
shutil.copyfile('android-ui/java/EredivisieStatsView.java',p.parent/'EredivisieStatsView.java')
print('Installed internal Eredivisie statistics and weekly feature subpage')

shutil.copyfile('android-ui/java/WeeklyMatchCard.java',p.parent/'WeeklyMatchCard.java')
