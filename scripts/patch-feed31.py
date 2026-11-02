"""Install shared refresh without replacing navigation, approved hero or column layout."""
from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
a=s.index('private void addEditorialNewsSection(LinearLayout parent, boolean columnOnly)');brace=s.index('{',a);depth=0
for end in range(brace,len(s)):
 if s[end]=='{':depth+=1
 elif s[end]=='}':
  depth-=1
  if not depth:break
s=s[:a]+'''private void addEditorialNewsSection(LinearLayout parent, boolean columnOnly) {
    FeedRepository.configure(this,EDITORIAL_API_URL);
    LinearLayout section=new LinearLayout(this);section.setOrientation(LinearLayout.VERTICAL);parent.addView(section,new LinearLayout.LayoutParams(-1,-2));
    if(!columnOnly&&"Voor jou".equals(active)) {
        homeFeature=new HomeFeatureView(this,this::showEditorialArticle,this::showWeeklyPreview,this::showColumn);
        section.addView(homeFeature,new LinearLayout.LayoutParams(-1,dp(600)));
    }
    section.addView(new FeedPanel(this,active,columnOnly,this::showEditorialArticle),new LinearLayout.LayoutParams(-1,-2));
}'''+s[end+1:]
a=s.index('private void showNews()');b=s.index('\n    private ',a+10)
news=s[a:b];assert 'new ScrollView(this)' in news
news=news.replace('new ScrollView(this)','new RefreshScrollView(this,()->FeedRepository.refresh(true))')
s=s[:a]+news+s[b:]
# Existing refresh actions must update this source without destroying its scroll tree.
a=s.index('private void refreshNews()');b=s.index('private String newestArticleDate(',a)
s=s[:a]+'''private void refreshNews() { FeedRepository.configure(this,EDITORIAL_API_URL);FeedRepository.refresh(true); }
    '''+s[b:]
p.write_text(s)
for name in ['FeedRepository','FeedPanel','RefreshScrollView','PublicationPolicy','PresentationCovers','Branding','AuthorColumnPolicy']:
 shutil.copyfile('android-ui/java/'+name+'.java',p.parent/(name+'.java'))
shutil.copyfile('android-ui/assets/editorial-fallback.svg','app/src/main/assets/editorial-fallback.svg')
print('Shared reviewed feed, in-place refresh, offline retry and top pull installed.')

# Reuse the existing reviewed archive decisions in the client while backend rollout is pending.
import json
ids=json.loads(Path('feed-policy.json').read_text())['archived']
java='package nl.voetbalhub.app;\nimport org.json.*;\npublic final class FeedVisibility {\n private static final java.util.Set<String> ARCHIVED=new java.util.HashSet<>(java.util.Arrays.asList(IDS));\n public static JSONObject filter(JSONObject input)throws JSONException {if(input==null)return null;JSONArray rows=input.getJSONArray("articles"),keep=new JSONArray();for(int i=0;i<rows.length();i++){JSONObject a=rows.optJSONObject(i);if(a!=null&&!ARCHIVED.contains(a.optString("id")))keep.put(a);}return new JSONObject(input.toString()).put("articles",keep).put("count",keep.length());}\n}\n'
(p.parent/'FeedVisibility.java').write_text(java.replace('IDS',','.join(json.dumps(i) for i in ids)))
