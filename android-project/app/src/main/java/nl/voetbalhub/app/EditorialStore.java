package nl.voetbalhub.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

/** Saved originals keep their complete text, independent of the current news window. */
public final class EditorialStore {
    private static String key(JSONObject article){return article.optString("id","").trim();}
    public static JSONArray saved(Context context){try{return Branding.rows(new JSONArray(context.getSharedPreferences("voetbalhub_editorial",0).getString("saved_originals","[]")));}catch(Exception ignored){return new JSONArray();}}
    public static boolean contains(Context context,JSONObject article){String id=key(article);if(id.isEmpty())return false;JSONArray rows=saved(context);for(int i=0;i<rows.length();i++)if(id.equals(rows.optJSONObject(i)==null?"":key(rows.optJSONObject(i))))return true;return false;}
    static synchronized void refreshSaved(Context context, JSONArray articles) {
        if (articles == null) return;
        java.util.Map<String, JSONObject> revised = new java.util.HashMap<>();
        for (int i = 0; i < articles.length(); i++) {
            JSONObject article = articles.optJSONObject(i);
            if (article != null && "published".equals(article.optString("status")) &&
                !article.optString("updatedAt").isEmpty()) revised.put(key(article), article);
        }
        if (revised.isEmpty()) return;
        JSONArray rows = saved(context), next = new JSONArray();
        boolean changed = false;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject old = rows.optJSONObject(i);
            if (old == null) continue;
            JSONObject fresh = revised.get(key(old));
            if (fresh != null && fresh.optString("updatedAt").compareTo(old.optString("updatedAt")) > 0) {
                next.put(fresh);
                changed = true;
            } else next.put(old);
        }
        if (changed) context.getSharedPreferences("voetbalhub_editorial", 0).edit()
            .putString("saved_originals", next.toString()).apply();
    }
    public static synchronized boolean toggle(Context context,JSONObject article){
        String id=key(article);if(id.isEmpty()||!"published".equals(article.optString("status")))return false;
        JSONArray old=saved(context),next=new JSONArray();boolean found=false;
        for(int i=0;i<old.length();i++){JSONObject row=old.optJSONObject(i);if(row==null)continue;if(id.equals(key(row)))found=true;else next.put(row);}
        if(!found){JSONArray added=new JSONArray();added.put(article);for(int i=0;i<next.length()&&i<199;i++)added.put(next.optJSONObject(i));next=added;}
        context.getSharedPreferences("voetbalhub_editorial",0).edit().putString("saved_originals",next.toString()).apply();return !found;
    }
}
