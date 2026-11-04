package nl.voetbalhub.app;
import android.app.Activity;import android.graphics.Bitmap;import org.json.*;import java.io.InputStream;
/** Approved local assets. Reused fallback is disclosed, never passed off as a match photograph. */
public final class EditorialIllustrations42 {
 public static boolean matches(JSONObject a){String s=a.optString("headline").toLowerCase(java.util.Locale.ROOT);return s.contains("groningen")&&s.contains("sparta");}
 public static void apply(JSONObject a){if(!a.has("headline")||"column".equalsIgnoreCase(a.optString("type")))return;try{
 if(matches(a)){a.put("imageAsset","news42/groningen-sparta42.webp").put("imageAssetId","groningen-sparta42").put("imageUrl","https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/work/veldio-42/public/news42/groningen-sparta42.webp").put("imageRights","cleared").put("imageCredit","Veldio · AI-illustratie").put("imageSource","https://github.com/sanderbrink-spec/Voetbalhub/blob/work/veldio-42/editorial-images42.json").put("imageCaption","AI-illustratie: supporterskleuren bij een fictief voetbalstadion. Geen opname van de wedstrijd of het echte stadion.").put("imageLicenseUrl","https://openai.com/policies/eu-terms-of-use/").put("imageReview",new JSONObject().put("generated",true).put("contextOnly",true).put("method","approved-editorial42"));a.remove("uniqueFallback39");}
 else if(a.optString("imageAsset").endsWith(".svg")||a.optString("imageReview").contains("vector39")||a.optString("imageReview").isEmpty()){
 a.put("imageAsset","news-photos/veldio-arena.webp").put("imageCredit","Veldio · AI-illustratie").put("imageCaption","AI-illustratie: fictief voetbalstadion. Algemeen sfeerbeeld, geen foto van het beschreven onderwerp.").put("imageRights","cleared").put("imageReview",new JSONObject().put("generated",true).put("contextOnly",true).put("method","approved-context-fallback42"));
 }
 }catch(Exception ignored){}}
 public static Bitmap bitmap(Activity a,JSONObject article,int width){String path=article.optString("imageAsset");if(!path.equals("news42/groningen-sparta42.webp")&&!path.equals("news-photos/veldio-arena.webp"))return null;try(InputStream in=a.getAssets().open(path)){return EditorialBitmap.read(in,width);}catch(Exception e){return null;}}
}
