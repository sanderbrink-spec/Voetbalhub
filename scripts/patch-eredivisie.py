from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java')
s=p.read_text()
marker='public class MainActivity'
i=s.index('{',s.index(marker))+1
s=s[:i]+'\n    private boolean eredivisieStatisticsVisible = false;\n    private boolean weeklyPreviewVisible = false;\n'+s[i:]
for method in ['showNews','showColumn','showScores','showCompetitions','showFavorites','showMore']:
 marker='private void '+method+'() {'
 assert marker in s,marker
 visibility = 'android.view.View.VISIBLE' if method == 'showNews' else 'android.view.View.GONE'
 s=s.replace(marker,marker+'\n        eredivisieStatisticsVisible = false; weeklyPreviewVisible = false;\n        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);\n        findViewById(R.id.chipsScroll).setVisibility('+visibility+');',1)
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
s=s.replace(marker,marker+'\n        if (weeklyPreviewVisible) { showNews(); return; }\n        if (eredivisieStatisticsVisible) { showCompetitions(); return; }',1)
methods='''
    private void showWeeklyPreview(String snapshot) {
        if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
        scoresPageVisible = false;
        weeklyPreviewVisible = true; eredivisieStatisticsVisible = false;
        currentBottomTab = "Nieuws"; buildNav();
        findViewById(R.id.header).setVisibility(android.view.View.GONE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();
        content.addView(new MatchPreviewView(this, snapshot, this::showNews), new android.widget.FrameLayout.LayoutParams(-1, -1));
    }
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
        WeeklyMatchCard feature = new WeeklyMatchCard(this, () -> showEredivisieStatistics(false), snapshot -> showWeeklyPreview(snapshot));
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

# Use compact horizontal editorial rows, matching the reference's news hierarchy.
start=s.index('// Image-led, original artwork card:')
end=s.index('card.setOnClickListener(v -> showEditorialArticle(article));',start)+len('card.setOnClickListener(v -> showEditorialArticle(article));')
s=s[:start]+"""NewsListCard card = new NewsListCard(this, article, () -> showEditorialArticle(article));
                                  LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(-1, -2);
                                  cardLp.setMargins(0, dp(4), 0, dp(5));
                                  section.addView(card, cardLp);"""+s[end:]
# A landscape column banner leads the homepage, followed by the compact weekly feature.
old='if (!columnOnly && "Voor jou".equals(active)) section.addView(columnHero, columnLp);'
assert old in s
s=s.replace(old,'if (!columnOnly && "Voor jou".equals(active)) { LinearLayout.LayoutParams bannerLp = new LinearLayout.LayoutParams(-1, dp(184)); bannerLp.setMargins(0, dp(2), 0, dp(10)); section.addView(new ColumnBannerView(this, this::showColumn), bannerLp); addEredivisieFeature(section); }',1)
s=s.replace('if ("Voor jou".equals(active)) { addEredivisieFeature(list); addEditorialNewsSection(list, false); addPublisherLinkSection(list); }','addEditorialNewsSection(list, false);')
# Avoid repeating the selected chip as a large heading above the first card.
s=s.replace('root.addView(sectionHeader(active.equals("Voor jou") ? "Voor jou" : active, "VERVERS", this::refreshNews));','if (!"Voor jou".equals(active)) root.addView(sectionHeader(active, "VERVERS", this::refreshNews));')
news_start=s.index('private void showNews()');news_end=s.index('\n    private ',news_start+10)
news=s[news_start:news_end].replace('root.addView(status);','if (loading || !newsStatusMessage.isEmpty()) root.addView(status);')
s=s[:news_start]+news+s[news_end:]
# Bind article tabs to the editorial category instead of showing an empty RSS list.
anchor='if (!columnOnly && columnArticle) continue;'
category="""if (!columnOnly && columnArticle) continue;
                              String rubriek = article.optString("category", "").toLowerCase(java.util.Locale.ROOT);
                              String articleTitle = article.optString("headline", "").toLowerCase(java.util.Locale.ROOT);
                              if (!columnOnly && "Eredivisie".equals(active) && !rubriek.contains("eredivisie")) continue;
                              if (!columnOnly && "Transfers".equals(active) && !rubriek.contains("transfer") && !articleTitle.matches(".*(transfer|contract|versterking|vertrek).*")) continue;
                              if (!columnOnly && "Buitenland".equals(active) && !rubriek.matches(".*(buitenland|premier league|bundesliga|serie a|la liga|champions|europa|conference).*")) continue;"""
assert anchor in s;s=s.replace(anchor,category,1)
s=s.replace('Er zijn nog geen door de redactie goedgekeurde VoetbalHub-artikelen. Externe nieuwsfeeds zijn uitgeschakeld zolang hergebruikrechten niet zijn bevestigd.','Er zijn nog geen berichten in deze rubriek.')
s=s.replace('VOETBALHUB  ·  Onafhankelijke voetbalnieuws-hub. Artikelen openen bij de oorspronkelijke uitgever.','VOETBALHUB · Eigen voetbalnieuws, de column van Sander Brink en actuele competitiecijfers.')
s=s.replace('static final int GREEN = 0xFFB6FF32;', 'static final int GREEN = 0xFF25F06B;')
old='box.addView(tv(items[i][0], 21, page.equals(currentBottomTab) ? C.GREEN : C.MUTED, true), new LinearLayout.LayoutParams(-1, dp(28)));'
assert old in s;s=s.replace(old,'box.addView(new NavIconView(this, page, page.equals(currentBottomTab)), new LinearLayout.LayoutParams(-1, dp(26)));',1)
old='box.addView(tv(page, 10, page.equals(currentBottomTab) ? C.GREEN : C.MUTED, page.equals(currentBottomTab)), new LinearLayout.LayoutParams(-1, dp(18)));'
new='TextView navLabel = tv(page, 10, page.equals(currentBottomTab) ? C.GREEN : C.MUTED, page.equals(currentBottomTab)); navLabel.setGravity(Gravity.CENTER); box.addView(navLabel, new LinearLayout.LayoutParams(-1, dp(18)));'
assert old in s;s=s.replace(old,new,1)

# Keep the full column landing page consistent with the landscape home identity.
column_start=s.index('private void showColumn()')
column_end=s.index('private void showScores()',column_start)
column=s[column_start:column_end]
portrait_start=column.index('android.widget.ImageView columnBanner')
portrait_end=column.index('page.addView(columnBanner, bannerParams);',portrait_start)+len('page.addView(columnBanner, bannerParams);')
column=column[:portrait_start]+"""ColumnBannerView columnBanner = new ColumnBannerView(this, () -> {}, false);
    LinearLayout.LayoutParams bannerParams = new LinearLayout.LayoutParams(-1, dp(216));
    bannerParams.setMargins(0, dp(8), 0, dp(14));
    page.addView(columnBanner, bannerParams);
    TextView columnIntro = tv("De column van Sander Brink over de Eredivisie. Een eigen kijk op het voetbal.", 14, C.MUTED, false);
    columnIntro.setPadding(dp(4), 0, dp(4), dp(16)); page.addView(columnIntro);"""+column[portrait_end:]
column=column.replace('"COLUMN & ARTIKELEN", 15, C.GREEN','"Nieuwste columns", 20, C.TEXT')
s=s[:column_start]+column+s[column_end:]
s=s.replace('De eerste column van Sander Brink verschijnt hier na zijn persoonlijke goedkeuring.','De nieuwste column verschijnt hier zodra deze is gepubliceerd.')
s=s.replace('list.addView(tv("Nog geen nieuws geladen. Tik op VERVERS.", 15, C.MUTED, false), new LinearLayout.LayoutParams(-1, dp(60)));','/* The editorial section owns loading and empty states. */')

# A functional More page with the same row hierarchy as the visual reference.
def replace_java_method(source,signature,body):
 start=source.index(signature);brace=source.index('{',start);depth=0
 for i in range(brace,len(source)):
  if source[i]=='{':depth+=1
  elif source[i]=='}':
   depth-=1
   if depth==0:return source[:start]+body+source[i+1:]
 raise ValueError('Unclosed method: '+signature)
more="""private void showMore() {
        eredivisieStatisticsVisible = false; weeklyPreviewVisible = false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        currentBottomTab = "Meer"; buildNav(); content.removeAllViews();
        ScrollView scroll = new ScrollView(this); LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL); list.setPadding(dp(12), dp(10), dp(12), dp(24));
        addActionRow(list, "Zoeken", "Zoeken", this::showSearch);
        addActionRow(list, "Instellingen", "Instellingen", this::showSettings);
        addActionRow(list, "Favorieten", "Mijn clubs", this::showFavorites);
        TextView about = tv("Over VoetbalHub", 19, C.TEXT, true); about.setPadding(dp(2), dp(20), 0, dp(12)); list.addView(about);
        addActionRow(list, "Info", "Onze missie", () -> new AlertDialog.Builder(this).setTitle("Alles voetbal. Eén hub.").setMessage("VoetbalHub brengt eigen voetbalnieuws, wedstrijdinformatie en de column van Sander Brink samen.").setPositiveButton("Sluiten", null).show());
        addActionRow(list, "Contact", "Contact", () -> { try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:redactie.veldio@gmail.com?subject=VoetbalHub%20feedback"))); } catch(Exception ignored) {} });
        addActionRow(list, "Column", "De Derde Helft · Sander Brink", this::showColumn);
        addActionRow(list, "Info", "Bronnen en beeldgebruik", this::showLegalInfo);
        TextView brand = tv("VOETBALHUB", 25, C.TEXT, true); brand.setGravity(Gravity.CENTER); brand.setPadding(0, dp(30), 0, dp(5)); list.addView(brand);
        TextView slogan = tv("Alles voetbal. Eén hub.", 12, C.MUTED, false); slogan.setGravity(Gravity.CENTER); list.addView(slogan);
        scroll.addView(list); content.addView(scroll);
    }
    private void addActionRow(LinearLayout parent,String icon,String title,Runnable action) {
        LinearLayout row = new LinearLayout(this); row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(14), dp(14), dp(14), dp(14));row.setBackground(cardBackground());
        row.addView(new NavIconView(this, icon, false), new LinearLayout.LayoutParams(dp(25),dp(25)));
        TextView name = tv(title, 14, C.TEXT, false);name.setPadding(dp(13),0,dp(8),0);row.addView(name,new LinearLayout.LayoutParams(0,-2,1));row.addView(tv("›",22,C.MUTED,false));row.setOnClickListener(v->action.run());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,0,0,dp(5));parent.addView(row,lp);
    }"""
s=replace_java_method(s,'private void showMore()',more)
legal="""private void showLegalInfo() {
        new AlertDialog.Builder(this).setTitle("Bronnen en beeldgebruik")
            .setMessage("VoetbalHub publiceert eigen redactionele artikelen. De competitiepagina gebruikt officiële Eredivisiegegevens en aanvullende wedstrijdgegevens.\\n\\nBij wedstrijdbeelden worden de herkomst en beeldverantwoording vastgelegd. Namen en clublogo's blijven herkenbaar als die van de betreffende clubs.\\n\\nVoetbalHub is een onafhankelijke app en is niet officieel verbonden aan de getoonde clubs of competities.")
            .setPositiveButton("Sluiten", null).show();
    }"""
s=replace_java_method(s,'private void showLegalInfo()',legal)

p.write_text(s)
assets=Path('app/src/main/assets');assets.mkdir(parents=True,exist_ok=True)
shutil.copyfile('android-ui/assets/eredivisie.html',assets/'eredivisie.html')
shutil.copyfile('android-ui/java/EredivisieStatsView.java',p.parent/'EredivisieStatsView.java')
print('Installed internal Eredivisie statistics and weekly feature subpage')

shutil.copyfile('android-ui/java/WeeklyMatchCard.java',p.parent/'WeeklyMatchCard.java')

for filename in ['MatchPreviewView.java','NewsListCard.java','NavIconView.java','ColumnBannerView.java']:
 shutil.copyfile('android-ui/java/'+filename,p.parent/filename)
shutil.copyfile('android-ui/assets/match-preview.html',assets/'match-preview.html')
layout=Path('app/src/main/res/layout/activity_main.xml')
xml=layout.read_text().replace('android:layout_height="72dp"','android:layout_height="64dp"').replace('android:layout_height="46dp"','android:layout_height="42dp"').replace('android:textSize="23sp"','android:textSize="21sp"')
layout.write_text(xml)
for f in Path('app/src/main/res/drawable').glob('rounded_*.xml'):
 f.write_text(f.read_text().replace('#B6FF32','#25F06B'))

portrait_assets=Path("app/src/main/res/drawable-nodpi");portrait_assets.mkdir(parents=True,exist_ok=True)
shutil.copyfile("android-ui/drawable-nodpi/column_sander_brink_clean.webp",portrait_assets/"column_sander_brink_clean.webp")

# Personal hub replaces the legacy RSS search and bookmarks with published originals.
s=p.read_text()
s=s.replace('private boolean weeklyPreviewVisible = false;','private boolean weeklyPreviewVisible = false;\n    private boolean personalHubVisible = false;\n    private PersonalHubView personalHub;')
for method in ['showNews','showColumn','showScores','showCompetitions','showMore']:
 marker='private void '+method+'() {'
 s=s.replace(marker,marker+'\n        personalHubVisible = false; personalHub = null;',1)
s=s.replace('private void showWeeklyPreview(String snapshot) {','private void showWeeklyPreview(String snapshot) {\n        personalHubVisible = false; personalHub = null;',1)
s=s.replace('private void showEredivisieStatistics(boolean feature) {','private void showEredivisieStatistics(boolean feature) {\n        personalHubVisible = false; personalHub = null;',1)
s=s.replace('public void onBackPressed() {','public void onBackPressed() {\n        if (personalHubVisible && !editorialArticleOpen) { showNews(); return; }',1)
s=replace_java_method(s,'private void showFavorites()', '''private void showFavorites() { showPersonalHub("favorites", ""); }''')
s=replace_java_method(s,'private void showSearch()', '''private void showSearch() { showPersonalHub("search", ""); }''')
s=replace_java_method(s,'private void search(String q)', '''private void search(String q) { showPersonalHub("search", q); }''')
methods='''
    private void showPersonalHub(String mode,String query) {
        if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
        scoresPageVisible = false; weeklyPreviewVisible = false; eredivisieStatisticsVisible = false;
        personalHubVisible = true;
        currentBottomTab = "favorites".equals(mode) ? "Favorieten" : "Nieuws";
        buildNav(); findViewById(R.id.header).setVisibility(android.view.View.GONE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();personalHub = new PersonalHubView(this, mode, query, this::showEditorialArticle, this::showNews);
        content.addView(personalHub, new android.widget.FrameLayout.LayoutParams(-1, -1));
    }
'''
s=s.replace('private void showFavorites()',methods+'\n    private void showFavorites()',1)
start=s.index('private void showEditorialArticle(');end=s.index('private void addEditorialNewsSection(',start)
reader=s[start:end]
anchor='ScrollView scroll = new ScrollView(this);'
controls='''final java.util.ArrayList<TextView> readingText = new java.util.ArrayList<>();
        LinearLayout tools = new LinearLayout(this); tools.setGravity(Gravity.CENTER_VERTICAL);tools.setPadding(dp(14), dp(4), dp(14), dp(8));
        TextView save = tv(EditorialStore.contains(this, article) ? "★ Bewaard" : "☆ Bewaren", 13, C.GREEN, true);
        save.setGravity(Gravity.CENTER_VERTICAL); tools.addView(save, new LinearLayout.LayoutParams(0, dp(44), 1));
        save.setOnClickListener(v -> { boolean stored = EditorialStore.toggle(this, article); save.setText(stored ? "★ Bewaard" : "☆ Bewaren"); Toast.makeText(this, stored ? "Artikel bewaard op dit apparaat" : "Artikel uit leeslijst verwijderd", Toast.LENGTH_SHORT).show(); });
        TextView smaller = tv("A−", 14, C.TEXT, true); smaller.setGravity(Gravity.CENTER); tools.addView(smaller, new LinearLayout.LayoutParams(dp(44),dp(44)));smaller.setContentDescription("Kleinere artikeltekst");
        TextView larger = tv("A+", 17, C.TEXT, true); larger.setGravity(Gravity.CENTER); tools.addView(larger, new LinearLayout.LayoutParams(dp(44),dp(44)));larger.setContentDescription("Grotere artikeltekst");
        android.view.View.OnClickListener resize = v -> {int size = Math.max(15, Math.min(23, prefs.getInt("readerFontSize",17) + (v == larger ? 1 : -1)));prefs.edit().putInt("readerFontSize",size).apply();for(TextView paragraph : readingText)paragraph.setTextSize(size);};smaller.setOnClickListener(resize);larger.setOnClickListener(resize);
        TextView share = tv("Delen", 12, C.MUTED, true);share.setGravity(Gravity.CENTER);tools.addView(share,new LinearLayout.LayoutParams(dp(52),dp(44)));share.setOnClickListener(v -> {Intent send = new Intent(Intent.ACTION_SEND);send.setType("text/plain");send.putExtra(Intent.EXTRA_SUBJECT,article.optString("headline"));send.putExtra(Intent.EXTRA_TEXT,article.optString("headline")+"\\n\\n"+article.optString("standfirst")+"\\n\\nVoetbalHub · Alles voetbal. Eén hub.");try{startActivity(Intent.createChooser(send,"Artikel delen"));}catch(Exception ignored){}});
        root.addView(tools);
        ScrollView scroll = new ScrollView(this);'''
assert anchor in reader;reader=reader.replace(anchor,controls,1)
a=reader.index('if (isColumnReader) {');b=reader.index('} else {',a)
reader=reader[:a]+'''if (isColumnReader) {
            LinearLayout.LayoutParams banner = new LinearLayout.LayoutParams(-1, dp(190));banner.bottomMargin=dp(16);page.addView(new ColumnBannerView(this, this::showColumn, false),banner);
        '''+reader[b:]
reader=reader.replace('page.addView(title);','''page.addView(title);
        String published = article.optString("publishedAt", "");String dateLabel = "";
        try {dateLabel = java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy · HH:mm", new java.util.Locale("nl","NL")).withZone(java.time.ZoneId.of("Europe/Amsterdam")).format(java.time.Instant.parse(published));} catch(Exception ignored) {}
        int words = 0;org.json.JSONArray readBody = article.optJSONArray("body");if(readBody!=null)for(int i=0;i<readBody.length();i++)words+=readBody.optString(i, "").trim().split("\\\\s+").length;
        TextView metadata = tv((dateLabel.isEmpty()?"":dateLabel+" · ")+Math.max(1,(words+199)/200)+" min leestijd", 11, C.MUTED, false);metadata.setPadding(0,0,0,dp(10));page.addView(metadata);''',1)
reader=reader.replace('page.addView(originalArt, artParams);','page.addView(originalArt, artParams);if(isColumnReader)originalArt.setVisibility(android.view.View.GONE);')
reader=reader.replace('if (coverUrl.startsWith("https://")','if (!isColumnReader && coverUrl.startsWith("https://")',1)
reader=reader.replace('cover.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);','cover.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);cover.setAdjustViewBounds(true);')
reader=reader.replace('new LinearLayout.LayoutParams(-1, dp(210))','new LinearLayout.LayoutParams(-1, -2)')
reader=reader.replace('TextView bodyText = tv(paragraph, 16, C.TEXT, false);','TextView bodyText = tv(paragraph, prefs.getInt("readerFontSize",17), C.TEXT, false);bodyText.setLineSpacing(dp(5),1f);bodyText.setTextIsSelectable(true);readingText.add(bodyText);')
reader=reader.replace('editorialArticleOpen = false; editorialDialog = null;','editorialArticleOpen = false; editorialDialog = null;if(personalHub!=null)personalHub.refreshSaved();')
s=s[:start]+reader+s[end:]
# Make the complete editorial catalogue reachable after the home preview list.
needle='section.addView(status);'
assert needle in s
s=s.replace(needle,needle+'''
        if(!columnOnly){TextView allNews = tv("Alle eigen artikelen bekijken  →", 12, C.GREEN, true);allNews.setPadding(dp(2),dp(5),0,dp(10));allNews.setMinHeight(dp(44));allNews.setOnClickListener(v -> showPersonalHub("search", ""));section.addView(allNews);}''',1)
p.write_text(s)
for filename in ['EditorialStore.java','PersonalHubView.java']:
 shutil.copyfile('android-ui/java/'+filename,p.parent/filename)
shutil.copyfile('android-ui/assets/personal-hub.html',assets/'personal-hub.html')
