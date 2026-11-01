package nl.voetbalhub.app;
import org.json.JSONObject;
/** Accept only data delivered under the current server rights policy, including offline caches. */
public final class PublicationPolicy {
    private PublicationPolicy(){}
    public static boolean allows(JSONObject data){return data!=null&&data.optInt("rightsPolicyVersion")==26&&data.optLong("rightsExpiresAt")>System.currentTimeMillis();}
    /** The deployed manual feed predates envelope versioning. An explicit expired
     * policy still fails closed; legacy rows need their existing four review flags. */
    public static JSONObject articleFeed(JSONObject data) throws org.json.JSONException {
        if(data==null||data.optJSONArray("articles")==null)return null;
        if(data.has("rightsPolicyVersion"))return allows(data)?data:null;
        org.json.JSONArray accepted=new org.json.JSONArray(),rows=data.getJSONArray("articles");
        for(int i=0;i<rows.length();i++){
            JSONObject a=rows.optJSONObject(i);if(a==null||!"published".equals(a.optString("status"))||a.optString("id").isEmpty()||a.optString("headline").isEmpty()||a.optJSONArray("body")==null||a.optJSONArray("body").length()<3)continue;
            JSONObject checks=a.optJSONObject("editorialChecks");boolean reviewed=checks!=null;
            for(String key:new String[]{"originalSourceReviewed","claimsIndependentlyChecked","duplicateChecked","languageChecked"})reviewed=reviewed&&checks.optBoolean(key);
            if(reviewed)accepted.put(a);
        }
        if(rows.length()>0&&accepted.length()==0)return null;
        return new JSONObject().put("articles",accepted).put("count",accepted.length());
    }
}
