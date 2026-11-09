package nl.voetbalhub.app;
import org.json.*;
public final class FeedVisibility {
 private static final java.util.Set<String> ARCHIVED=new java.util.HashSet<>(java.util.Arrays.asList("92c3f8b4-8a1e-4afc-9353-c136eb19a896","eec60ce3-7054-470d-bd22-71910f58dde5","537721a2-3e83-4848-8710-53f7d6353f37","1406b2e4-ce33-4372-9964-ea485bbadf61","a911d7bc-6de0-40c1-b71e-dd516b274d1c","0cc1e2c0-3484-4da3-aa72-663a4840bc4d","85abcf58-379d-442f-8d1f-0faed548d9d3"));
 public static JSONObject filter(JSONObject input)throws JSONException {if(input==null)return null;JSONArray rows=input.getJSONArray("articles"),keep=new JSONArray();for(int i=0;i<rows.length();i++){JSONObject a=rows.optJSONObject(i);if(ArticleArtwork.approved(a)&&!"archived".equals(a.optString("feedState"))&&!ARCHIVED.contains(a.optString("id")))keep.put(a);}return new JSONObject(input.toString()).put("articles",keep).put("count",keep.length());}
}
