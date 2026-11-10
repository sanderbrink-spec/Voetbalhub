package nl.voetbalhub.app;
import android.app.Activity;
import android.graphics.Bitmap;
import android.util.LruCache;
import android.widget.ImageView;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.URLSpan;
import android.text.method.LinkMovementMethod;
import android.widget.TextView;
import org.json.*;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Packaged photos are offline-safe. Licence terms apply to the image, not the app code. */
public final class EditorialPhotos {
 private EditorialPhotos(){}
 public static boolean safeAsset(String path){return path!=null&&path.matches("news-photos/[a-z0-9-]+\\.webp");}
 public static Bitmap bitmap(Activity activity,JSONObject article,int width){Bitmap approved43=EditorialImages43.bitmap(activity,article,width);if(approved43!=null)return approved43;Bitmap approved42=EditorialIllustrations42.bitmap(activity,article,width);if(approved42!=null)return approved42;if(article.optBoolean("uniqueFallback39"))return TopicArtwork39.bitmap(article,width);String path=article.optString("imageAsset");if(!safeAsset(path))return null;try(InputStream in=activity.getAssets().open(path)){return EditorialBitmap.read(in,width);}catch(Exception ignored){return null;}}
 private static Bitmap bundledArticle(Activity activity, String url, String sha, int width) {
  String origin = "https://voetbalhub-redactie.onrender.com/";
  if (!url.startsWith(origin)) return null;
  String path = url.substring(origin.length());
  if (!path.matches("(match-rotations65|article-art69|news43)/[a-z0-9-]+\\.webp")) return null;
  try (InputStream in = activity.getAssets().open(path)) {
   byte[] bytes = BoundedInput.read(in, 2_000_000);
   byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(bytes);
   StringBuilder actual = new StringBuilder(64);
   for (byte value : digest) actual.append(Character.forDigit((value >>> 4) & 15, 16))
       .append(Character.forDigit(value & 15, 16));
   if (!sha.contentEquals(actual)) return null;
   return EditorialBitmap.read(new java.io.ByteArrayInputStream(bytes), width);
  } catch (Exception missing) {
   return null;
  }
 }
 private static final ExecutorService NETWORK = Executors.newFixedThreadPool(3);
 private static final LruCache<String, Bitmap> CACHE = new LruCache<String, Bitmap>(8192) {
  @Override protected int sizeOf(String key, Bitmap image) { return Math.max(1, image.getByteCount() / 1024); }
 };

 public static void bind(Activity activity, ImageView view, JSONObject article, int width) {
  Object request = new Object();
  view.setTag(request);
  String url = article.optString("imageUrl"), rights = article.optString("imageRights");
  boolean central = ArticleArtwork.approved(article);
  JSONObject review = article.optJSONObject("imageReview");
  String description = (review != null && review.optBoolean("generated") ? "AI-illustratie bij " :
   "Afbeelding bij ") + article.optString("headline", "het artikel");
  view.setContentDescription(central ? null : description);
  String sha = review == null ? "" : review.optString("assetSha256");
  String cacheKey = url + "|" + sha + "|" + width;
  Bitmap cached = CACHE.get(cacheKey);
  if (cached != null) {
   view.setImageBitmap(cached);
   view.setContentDescription(description);
   return;
  }
  if (central) {
   Bitmap bundled = bundledArticle(activity, url, sha, width);
   if (bundled != null) {
    CACHE.put(cacheKey, bundled);
    view.setImageBitmap(bundled);
    view.setContentDescription(description);
    return;
   }
  } else {
   view.setImageDrawable(new TopicArtwork39(article));
   Bitmap local = bitmap(activity, article, width);
   if (local != null) {
    view.setImageBitmap(local);
    return;
   }
  }
  if (!url.startsWith("https://") || !("cleared".equals(rights) || "licensed".equals(rights))) return;
  NETWORK.execute(() -> {
   HttpURLConnection connection = null;
   try {
    connection = (HttpURLConnection) new URL(url).openConnection();
    connection.setConnectTimeout(10000);
    connection.setReadTimeout(12000);
    connection.setInstanceFollowRedirects(false);
    try (DeadlineHttp.Guard deadline = DeadlineHttp.watch(connection, 15000)) {
     String type = connection.getContentType();
     if (connection.getResponseCode() != 200 || connection.getContentLength() > 5000000 ||
         type == null || !type.toLowerCase(Locale.ROOT).startsWith("image/")) return;
     try (InputStream stream = connection.getInputStream()) {
      Bitmap image = EditorialBitmap.read(stream, width);
      if (image == null) return;
      CACHE.put(cacheKey, image);
      activity.runOnUiThread(() -> {
       if (view.getTag() == request && view.isAttachedToWindow() && !activity.isFinishing()) {
        view.setImageBitmap(image);
        view.setContentDescription(description);
       }
      });
     }
    }
   } catch (Exception error) {
    android.util.Log.w("VeldioImage", "Article cover could not load: " + article.optString("id"));
   } finally {
    if (connection != null) connection.disconnect();
   }
  });
 }

 private static boolean isGenericMatchCover(JSONObject article, String url) {
  JSONObject match = article.optJSONObject("match");
  if (match == null) return false;
  if (url.endsWith("/veldio-arena.webp") || article.optString("imageAsset").endsWith("/veldio-arena.webp")) return true;
  JSONObject review = article.optJSONObject("imageReview");
  if (review == null || !"approved-library49".equals(review.optString("method"))) return false;
  JSONArray clubs = review.optJSONArray("clubs");
  return clubs == null || clubs.length() != 2 ||
   !clubKey(clubs.optString(0)).equals(clubKey(match.optString("homeTeam"))) ||
   !clubKey(clubs.optString(1)).equals(clubKey(match.optString("awayTeam")));
 }

 private static String clubKey(String value) {
  return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
   .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
 }

 public static JSONArray clubs(Activity activity){try(InputStream in=activity.getAssets().open("news-photo-catalog.json")){
  JSONObject catalog=new JSONObject(new String(BoundedInput.read(in,200000),java.nio.charset.StandardCharsets.UTF_8));JSONArray out=new JSONArray(),photos=catalog.getJSONArray("photos");
  for(String name:new String[]{"Ajax","Feyenoord","PSV"})for(int i=0;i<photos.length();i++){JSONObject p=photos.getJSONObject(i);if(name.equals(p.optString("club"))&&p.optBoolean("approved")){JSONObject c=new JSONObject(p.toString());c.put("name",name).put("cover","news-photos/"+p.getString("file"));out.put(c);break;}}return out;
 }catch(Exception ignored){return new JSONArray();}}
 public static JSONObject clubArticle(Activity activity,String name){try{JSONArray list=clubs(activity);for(int i=0;i<list.length();i++){JSONObject c=list.getJSONObject(i);if(!name.equals(c.getString("name")))continue;
  return new JSONObject().put("id","club-portret-"+name.toLowerCase(java.util.Locale.ROOT)).put("status","published").put("type","club_profile").put("category","Clubportret").put("author","Veldio Redactie").put("headline",name+" in de spotlight").put("standfirst","Een blik op de club en haar stadion.").put("body",c.getJSONObject("profile").getJSONArray("body")).put("sources",new JSONArray().put(new JSONObject().put("url",c.getJSONObject("profile").getString("source")))).put("imageUrl",c.getString("imageUrl")).put("imageAsset",c.getString("cover")).put("imageRights","licensed").put("imageCredit",c.getString("credit")).put("imageSource",c.getString("sourcePage")).put("imageLicenseUrl",c.getString("licenseUrl")).put("imageCaption",c.getString("caption"));
 }}catch(Exception ignored){}return null;}
 public static TextView credit(Activity a,JSONObject article){TextView t=new TextView(a);String credit=article.optString("imageCredit"),caption=article.optString("imageCaption"),source=article.optString("imageSource"),license=article.optString("imageLicenseUrl");if(!ArticleArtwork.approved(article)&&isGenericMatchCover(article,article.optString("imageUrl"))){
  credit="Veldio · illustratie in de clubkleuren";caption="";source="";license="";
 }String captionText = caption.trim(), creditText = credit.trim();
  boolean creditAlreadyInCaption = !creditText.isEmpty() && captionText.toLowerCase(java.util.Locale.ROOT).contains(creditText.toLowerCase(java.util.Locale.ROOT));
  String text = captionText.isEmpty() ? creditText : (creditText.isEmpty() || creditAlreadyInCaption ? captionText : captionText + " · " + creditText);
  SpannableString linked=new SpannableString(text+(source.startsWith("https://")?" · Bron":"")+(license.startsWith("https://")?" · Licentie":""));
  if(source.startsWith("https://")){int start=text.length()+3;linked.setSpan(new URLSpan(source),start,start+4,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);}
  if(license.startsWith("https://")){int start=linked.length()-8;linked.setSpan(new URLSpan(license),start,linked.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);}
  t.setText(linked);t.setTextSize(10);t.setTextColor(0xFFA8B8AD);t.setLinkTextColor(0xFFA9FFBE);t.setMovementMethod(LinkMovementMethod.getInstance());t.setLineSpacing(3,1.04f);int d=Math.round(8*a.getResources().getDisplayMetrics().density);t.setPadding(0,d/2,0,d*2);return t;
 }
 public static TextView sources(Activity activity, JSONObject article) {
  JSONArray sources = article.optJSONArray("sources");
  if (sources == null || sources.length() == 0) return null;
  android.text.SpannableStringBuilder links = new android.text.SpannableStringBuilder();
  java.util.Set<String> seen = new java.util.HashSet<>();
  for (int i = 0; i < sources.length(); i++) {
   JSONObject entry = sources.optJSONObject(i);
   if (entry == null) continue;
   String url = entry.optString("url");
   android.net.Uri uri = android.net.Uri.parse(url);
   String host = uri.getHost();
   if (!"https".equals(uri.getScheme()) || host == null || !seen.add(host)) continue;
   if (seen.size() > 1) links.append(" · ");
   int start = links.length();
   links.append(host.replaceFirst("^www\\.", ""));
   links.setSpan(new URLSpan(url), start, links.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
  }
  if (seen.isEmpty()) return null;
  TextView text = new TextView(activity);
  text.setText(links);
  text.setTextSize(11);
  text.setTextColor(0xFFA8B8AD);
  text.setLinkTextColor(0xFFA9FFBE);
  text.setMovementMethod(LinkMovementMethod.getInstance());
  return text;
 }

}
