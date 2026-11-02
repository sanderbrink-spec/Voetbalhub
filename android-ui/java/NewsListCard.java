package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.util.LruCache;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** Quiet photo-led news row with bounded copy and accessible full headline. */
public final class NewsListCard extends LinearLayout {
 private static final ExecutorService IMAGES=Executors.newFixedThreadPool(3);
 private static final LruCache<String,Bitmap> CACHE=new LruCache<String,Bitmap>(6144){@Override protected int sizeOf(String key,Bitmap value){return Math.max(1,value.getByteCount()/1024);}};
 private ImageView thumbnail;private LinearLayout articleCopy;
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 private TextView text(String value,int size,int color,boolean bold){TextView t=new TextView(getContext());t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
 public NewsListCard(Activity activity,JSONObject article,Runnable open){this(activity,article,open,new ImageRegistry39.Session());}
 public NewsListCard(Activity activity,JSONObject article,Runnable open,ImageRegistry39.Session registry){super(activity);setOrientation(HORIZONTAL);setGravity(Gravity.CENTER_VERTICAL);setPadding(dp(8),dp(12),dp(8),dp(12));
  GradientDrawable bg=new GradientDrawable();bg.setColor(0xFF09110C);bg.setCornerRadius(dp(10));setBackground(bg);setClipToOutline(true);
  ImageView image=new ImageView(activity);thumbnail=image;image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setBackgroundColor(0xFF08100B);image.setContentDescription((article.optJSONObject("imageReview")!=null&&article.optJSONObject("imageReview").optBoolean("generated")?"AI-illustratie bij ":"Archiefbeeld bij ")+article.optString("headline","voetbalnieuws"));LayoutParams photo=new LayoutParams(dp(132),dp(92));photo.rightMargin=dp(12);addView(image,photo);
  LinearLayout copy=new LinearLayout(activity);articleCopy=copy;copy.setOrientation(VERTICAL);addView(copy,new LayoutParams(0,-2,1));
  LinearLayout meta=new LinearLayout(activity);meta.setGravity(Gravity.CENTER_VERTICAL);TextView category=text(article.optString("category","Voetbal").toUpperCase(new Locale("nl","NL")),9,0xFFA9FF35,true);if(article.optJSONObject("imageReview")!=null&&article.optJSONObject("imageReview").optBoolean("generated"))category.append(" · AI");category.setMaxLines(1);category.setEllipsize(android.text.TextUtils.TruncateAt.END);meta.addView(category,new LayoutParams(0,-2,1));TextView time=text(age(article.optString("publishedAt","")),9,0xFF94A49B,false);time.setPadding(dp(6),0,0,0);meta.addView(time);copy.addView(meta);
  TextView title=text(article.optString("headline","Voetbalnieuws"),16,0xFFF5F8F5,true);title.setMaxLines(3);title.setEllipsize(android.text.TextUtils.TruncateAt.END);title.setLineSpacing(dp(2),1f);LayoutParams headline=new LayoutParams(-1,-2);headline.topMargin=dp(7);copy.addView(title,headline);
  setFocusable(true);setContentDescription(article.optString("headline","Voetbalnieuws"));setOnClickListener(v->open.run());
  boolean column="column".equalsIgnoreCase(article.optString("type"))||"de derde helft".equalsIgnoreCase(article.optString("category"))||"column".equalsIgnoreCase(article.optString("category"));
  image.setImageDrawable(column?new EditorialArtwork(activity,true):new TopicArtwork39(article));
  if(column){image.setContentDescription("Sander Brink, auteur van De Derde Helft");return;}
  if(article.optBoolean("uniqueFallback39"))return;
  Bitmap local=EditorialPhotos.bitmap(activity,article,512);if(local!=null){if(registry.decoded(local))image.setImageBitmap(local);return;}
  String url=article.optString("imageUrl",""),rights=article.optString("imageRights","");if(!url.startsWith("https://")||!("cleared".equals(rights)||"licensed".equals(rights)))return;
  Bitmap cached=CACHE.get(url);if(cached!=null){if(registry.decoded(cached))image.setImageBitmap(cached);return;}
  IMAGES.execute(()->{HttpURLConnection conn=null;try{conn=(HttpURLConnection)new URL(url).openConnection();conn.setConnectTimeout(10000);conn.setReadTimeout(12000);conn.setInstanceFollowRedirects(false);if(conn.getResponseCode()!=200||conn.getContentLength()>5000000||!String.valueOf(conn.getContentType()).startsWith("image/"))return;BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=4;Bitmap bitmap;try(InputStream stream=conn.getInputStream()){bitmap=EditorialBitmap.read(stream,512);}if(bitmap!=null){CACHE.put(url,bitmap);activity.runOnUiThread(()->{if(!activity.isFinishing()&&registry.decoded(bitmap))image.setImageBitmap(bitmap);});}}catch(Exception ignored){}finally{if(conn!=null)conn.disconnect();}});
 }
 @Override protected void onMeasure(int widthSpec,int heightSpec){
  if(thumbnail==null||articleCopy==null){super.onMeasure(widthSpec,heightSpec);return;}
  LayoutParams photo=(LayoutParams)thumbnail.getLayoutParams();int available=MeasureSpec.getSize(widthSpec)-getPaddingLeft()-getPaddingRight();photo.width=Math.max(dp(112),Math.min(dp(180),(int)(available*.43f)));photo.height=Math.round(photo.width*3f/4f);
  super.onMeasure(widthSpec,heightSpec);
 }
 private static String age(String date){try{long minutes=(System.currentTimeMillis()-Instant.parse(date).toEpochMilli())/60000;if(minutes<0)return "";if(minutes<60)return minutes<2?"Zojuist":minutes+"m geleden";if(minutes<1440)return minutes/60+"u geleden";if(minutes<10080)return minutes/1440+"d geleden";return DateTimeFormatter.ofPattern("d MMM",new Locale("nl","NL")).withZone(ZoneId.of("Europe/Amsterdam")).format(Instant.parse(date));}catch(Exception ignored){return "";}}
}
