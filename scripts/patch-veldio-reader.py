"""Final, scoped UI patch. Keeps article content, callbacks and navigation intact."""
from pathlib import Path
import shutil

p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java')
s=p.read_text()
a=s.index('private void showEditorialArticle(org.json.JSONObject article)')
b=s.index('private void addEditorialNewsSection(',a)
reader=s[a:b]
header=next(line for line in reader.splitlines() if 'root.addView(sectionHeader(' in line)
reader=reader.replace(header,'        root.addView(VeldioEditorial.readerHeader(this, "column".equalsIgnoreCase(article.optString("type")) || "de derde helft".equalsIgnoreCase(article.optString("category")), this::closeEditorialArticle));',1)
assert reader.count('root.addView(tools);')==1
reader=reader.replace('root.addView(tools);','VeldioEditorial.styleTools(this, tools); LinearLayout.LayoutParams toolsLp=new LinearLayout.LayoutParams(-1,-2);toolsLp.setMargins(dp(12),dp(8),dp(12),dp(6));root.addView(tools,toolsLp);')
reader=reader.replace('page.setPadding(dp(18), dp(14), dp(18), dp(28));','page.setPadding(dp(16), dp(8), dp(16), dp(28));')
category=next(line for line in reader.splitlines() if 'page.addView(tv(article.optString("category"' in line)
reader=reader.replace(category,'            page.addView(VeldioEditorial.category(this, article.optString("category", "VOETBAL").toUpperCase(java.util.Locale.ROOT)));',1)
reader=reader.replace('), 29, C.TEXT, true);','), 30, VeldioEditorial.SILVER, true);',1)
art=next(line for line in reader.splitlines() if 'TextView originalArt =' in line)
reader=reader.replace(art,'        TextView originalArt = VeldioEditorial.artwork(this);',1)
reader=reader.replace('originalArt.setBackground(artBackground);','VeldioEditorial.styleArtwork(this,originalArt);')
reader=reader.replace('            originalArt.setVisibility(android.view.View.GONE);\n            executor.execute', '            cover.setVisibility(android.view.View.GONE);\n            executor.execute')
reader=reader.replace('runOnUiThread(() -> cover.setImageBitmap(bitmap));','runOnUiThread(() -> {cover.setImageBitmap(bitmap);cover.setVisibility(android.view.View.VISIBLE);originalArt.setVisibility(android.view.View.GONE);});')
reader=reader.replace('new LinearLayout.LayoutParams(-1, dp(150))','new LinearLayout.LayoutParams(-1, Math.round((getResources().getDisplayMetrics().widthPixels-dp(32))*9f/16f))')
reader=reader.replace('cover.setContentDescription("Afbeelding bij artikel");','cover.setContentDescription("Afbeelding bij artikel"); VeldioEditorial.styleCover(this,cover);')
reader=reader.replace('TextView introText = tv(intro, 16, C.MUTED, false);','TextView introText = tv(intro, 16, 0xFFCDDDD2, false); introText.setLineSpacing(dp(4),1f);')
reader=reader.replace('page.addView(tv("VELDIO ORIGINALS  ·  Onafhankelijke redactie", 11, C.GREEN, true));','page.addView(VeldioEditorial.footer(this));')
reader=reader.replace('root.setOrientation(LinearLayout.VERTICAL);','root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(VeldioEditorial.INK);',1)
s=s[:a]+reader+s[b:]
a=s.index('private void showColumn()')
b=s.index('private void showScores()',a)
column=s[a:b]
column=column.replace('root.addView(sectionHeader("De Derde Helft", "TERUG", this::onBackPressed));','root.addView(VeldioEditorial.columnHeader(this,this::onBackPressed));')
column=column.replace('page.setPadding(dp(8), 0, dp(8), dp(20));','page.setPadding(dp(12), 0, dp(12), dp(24));')
column=column.replace('De column van Sander Brink over de Eredivisie. Een eigen kijk op het voetbal.','De column van Sander Brink voor Veldio. Een eigen kijk op voetbal.')
column=column.replace('bannerParams.setMargins(0, dp(8), 0, dp(14));','bannerParams.setMargins(0, dp(4), 0, dp(14));')
s=s[:a]+column+s[b:]
p.write_text(s)
for name in ['VeldioEditorial.java','EditorialArtwork.java','ColumnBannerView.java','NewsListCard.java']:
 shutil.copyfile('android-ui/java/'+name,p.parent/name)
gradle=Path('app/build.gradle.kts');g=gradle.read_text().replace('versionCode = 56','versionCode = 57').replace('versionName = "4.24-veldio"','versionName = "4.25-veldio"');gradle.write_text(g)
print('Installed Veldio editorial chrome, local portrait thumbnails and improved column identity.')
