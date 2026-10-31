package nl.voetbalhub.app;

import org.json.JSONArray;
import org.json.JSONObject;

/** Applies to fresh and cached data, including data from an older server. */
public final class ContentSafety {
    private ContentSafety() {}
    public static JSONObject article(JSONObject article) {
        if (article == null) return null;
        JSONObject review=article.optJSONObject("imageReview");
        String method=review==null?"":review.optString("method");
        String url=article.optString("imageUrl");
        boolean own=("reviewed-match-cover".equals(method)||"original-editorial-artwork".equals(method)) &&
            (url.startsWith("https://voetbalhub-redactie.onrender.com/article-covers/")||
             url.startsWith("https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/"));
        if (!own) {
            for (String field:new String[]{"imageUrl","imageSource","imageCredit","imageReview"}) article.remove(field);
            try {article.put("imageRights","not_needed");} catch(Exception ignored) {}
        }
        return article;
    }
    public static JSONArray rows(JSONArray rows) {
        if(rows!=null)for(int i=0;i<rows.length();i++)article(rows.optJSONObject(i));
        return rows;
    }
    public static JSONObject clubCatalogue() {
        JSONObject data=new JSONObject();JSONArray clubs=new JSONArray();
        String[] names={"FC Groningen","Ajax","PSV","Feyenoord","AZ","FC Twente","SC Heerenveen","FC Utrecht","NEC","Sparta Rotterdam","Heracles Almelo","Go Ahead Eagles","Fortuna Sittard","PEC Zwolle","NAC Breda","Willem II","Real Madrid","FC Barcelona","Liverpool","Arsenal","Manchester City","Bayern München"};
        try {for(String name:names){JSONObject club=new JSONObject();club.put("name",name);clubs.put(club);}data.put("clubOptions",clubs);}catch(Exception ignored){}
        return data;
    }
    public static JSONObject response(JSONObject data) {
        if(data!=null)rows(data.optJSONArray("articles"));
        return data;
    }
}
