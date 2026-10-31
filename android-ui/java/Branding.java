package nl.voetbalhub.app;

import org.json.JSONArray;
import org.json.JSONObject;

/** Presentation-only migration: stored records, IDs, hashes and API routes stay compatible. */
public final class Branding {
    private static final String ORIGIN="https://voetbalhub-redactie.onrender.com";
    private static final String MEDIA="https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/";
    private Branding() {}
    public static String text(String value){return value.replace("VoetbalHub","Veldio").replace("VOETBALHUB","VELDIO").replace("Alles voetbal. Eén hub.","Alles voetbal. Eén plek.");}
    public static JSONObject article(JSONObject value){return response(value);}
    public static JSONObject response(JSONObject value){
        if(value==null)return value;
        try {
            java.util.Iterator<String> keys=value.keys();java.util.ArrayList<String> names=new java.util.ArrayList<>();while(keys.hasNext())names.add(keys.next());
            for(String key:names){Object item=value.opt(key);if(item instanceof JSONObject)response((JSONObject)item);else if(item instanceof JSONArray)rows((JSONArray)item);else if(item instanceof String)value.put(key,text((String)item));}
            String url=value.optString("imageUrl");
            for(String file:new String[]{"groningen-emmen-2026-10-29.webp","emmen-den-bosch-2026-11-01.webp"})
                if(url.contains("/"+file))value.put("imageUrl",MEDIA+"43490d29c0c4a10347e237a07deafcc960f8e648/public/article-covers/"+file);
            JSONObject review=value.optJSONObject("imageReview");
            if(review!=null&&"fixture-specific-stadium-and-logos-v4".equals(review.optString("method"))&&url.startsWith(MEDIA))
                value.put("imageUrl",ORIGIN+"/brand/fixture-image?source="+android.net.Uri.encode(url));
        }catch(Exception ignored){}
        return value;
    }
    public static JSONArray rows(JSONArray rows){
        if(rows!=null)for(int i=0;i<rows.length();i++)try{Object item=rows.opt(i);if(item instanceof JSONObject)response((JSONObject)item);else if(item instanceof JSONArray)rows((JSONArray)item);else if(item instanceof String)rows.put(i,text((String)item));}catch(Exception ignored){}
        return rows;
    }
}
