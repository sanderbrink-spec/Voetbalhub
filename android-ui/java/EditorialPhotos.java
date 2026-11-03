package nl.voetbalhub.app;
import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.URLSpan;
import android.text.method.LinkMovementMethod;
import android.widget.TextView;
import org.json.*;
import java.io.InputStream;

/** Packaged photos are offline-safe. Licence terms apply to the image, not the app code. */
public final class EditorialPhotos {
 private EditorialPhotos(){}
 public static boolean safeAsset(String path){return path!=null&&path.matches("news-photos/[a-z0-9-]+\\.webp");}
 public static Bitmap bitmap(Activity activity,JSONObject article,int width){Bitmap approved42=EditorialIllustrations42.bitmap(activity,article,width);if(approved42!=null)return approved42;if(article.optBoolean("uniqueFallback39"))return TopicArtwork39.bitmap(article,width);String path=article.optString("imageAsset");if(!safeAsset(path))return null;try(InputStream in=activity.getAssets().open(path)){return EditorialBitmap.read(in,width);}catch(Exception ignored){return null;}}
 public static JSONArray clubs(Activity activity){try(InputStream in=activity.getAssets().open("news-photo-catalog.json")){
  JSONObject catalog=new JSONObject(new String(BoundedInput.read(in,200000),java.nio.charset.StandardCharsets.UTF_8));JSONArray out=new JSONArray(),photos=catalog.getJSONArray("photos");
  for(String name:new String[]{"Ajax","Feyenoord","PSV"})for(int i=0;i<photos.length();i++){JSONObject p=photos.getJSONObject(i);if(name.equals(p.optString("club"))&&p.optBoolean("approved")){JSONObject c=new JSONObject(p.toString());c.put("name",name).put("cover","news-photos/"+p.getString("file"));out.put(c);break;}}return out;
 }catch(Exception ignored){return new JSONArray();}}
 public static JSONObject clubArticle(Activity activity,String name){try{JSONArray list=clubs(activity);for(int i=0;i<list.length();i++){JSONObject c=list.getJSONObject(i);if(!name.equals(c.getString("name")))continue;
  return new JSONObject().put("id","club-portret-"+name.toLowerCase(java.util.Locale.ROOT)).put("status","published").put("type","club_profile").put("category","Clubportret").put("author","Veldio Redactie").put("headline",name+" in de spotlight").put("standfirst","Een blik op de club en haar stadion.").put("body",c.getJSONObject("profile").getJSONArray("body")).put("sources",new JSONArray().put(new JSONObject().put("url",c.getJSONObject("profile").getString("source")))).put("imageUrl",c.getString("imageUrl")).put("imageAsset",c.getString("cover")).put("imageRights","licensed").put("imageCredit",c.getString("credit")).put("imageSource",c.getString("sourcePage")).put("imageLicenseUrl",c.getString("licenseUrl")).put("imageCaption",c.getString("caption"));
 }}catch(Exception ignored){}return null;}
 public static TextView credit(Activity a,JSONObject article){TextView t=new TextView(a);String credit=article.optString("imageCredit"),caption=article.optString("imageCaption"),source=article.optString("imageSource"),license=article.optString("imageLicenseUrl");String text=(caption.isEmpty()?"":caption+"\n")+credit;
  SpannableString linked=new SpannableString(text+(source.startsWith("https://")?" · Bron":"")+(license.startsWith("https://")?" · Licentie":""));
  if(source.startsWith("https://")){int start=text.length()+3;linked.setSpan(new URLSpan(source),start,start+4,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);}
  if(license.startsWith("https://")){int start=linked.length()-8;linked.setSpan(new URLSpan(license),start,linked.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);}
  t.setText(linked);t.setTextSize(10);t.setTextColor(0xFFA8B8AD);t.setLinkTextColor(0xFFA9FFBE);t.setMovementMethod(LinkMovementMethod.getInstance());int d=Math.round(8*a.getResources().getDisplayMetrics().density);t.setPadding(0,d,0,d);return t;
 }
}
