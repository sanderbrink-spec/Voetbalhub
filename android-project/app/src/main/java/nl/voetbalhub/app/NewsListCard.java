package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.json.JSONObject;

/** Quiet photo-led news row with bounded copy and accessible full headline. */
public final class NewsListCard extends LinearLayout {
 private ImageView thumbnail;private LinearLayout articleCopy;private boolean feature40;
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 private TextView text(String value,int size,int color,boolean bold){TextView t=new TextView(getContext());t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
 public NewsListCard(Activity activity,JSONObject article,Runnable open){super(activity);feature40=article.optInt("presentationIndex40",-1)>=0&&article.optInt("presentationIndex40")%4==0&&!"column".equalsIgnoreCase(article.optString("type"))&&!"column".equalsIgnoreCase(article.optString("category"))&&!"de derde helft".equalsIgnoreCase(article.optString("category"));setOrientation(feature40?VERTICAL:HORIZONTAL);setGravity(Gravity.CENTER_VERTICAL);setPadding(dp(8),dp(12),dp(8),dp(12));
  GradientDrawable bg=new GradientDrawable();bg.setColor(0xFF09110C);bg.setCornerRadius(dp(10));setBackground(bg);setClipToOutline(true);PremiumDesign40.card(this,PremiumDesign40.EDGE);PremiumDesign40.touch(this);
  ImageView image=new ImageView(activity);thumbnail=image;image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setBackgroundColor(0xFF08100B);image.setContentDescription((article.optJSONObject("imageReview")!=null&&article.optJSONObject("imageReview").optBoolean("generated")?"AI-illustratie bij ":"Archiefbeeld bij ")+article.optString("headline","voetbalnieuws"));LayoutParams photo=new LayoutParams(dp(132),dp(92));photo.rightMargin=feature40?0:dp(12);photo.bottomMargin=feature40?dp(12):0;addView(image,photo);
  LinearLayout copy=new LinearLayout(activity);articleCopy=copy;copy.setOrientation(VERTICAL);addView(copy,feature40?new LayoutParams(-1,-2):new LayoutParams(0,-2,1));
  LinearLayout meta=new LinearLayout(activity);meta.setGravity(Gravity.CENTER_VERTICAL);TextView category=text(article.optString("category","Voetbal").toUpperCase(new Locale("nl","NL")),9,0xFFA9FF35,true);if(article.optJSONObject("imageReview")!=null&&article.optJSONObject("imageReview").optBoolean("generated"))category.append(" · AI");category.setMaxLines(1);category.setEllipsize(android.text.TextUtils.TruncateAt.END);meta.addView(category,new LayoutParams(0,-2,1));TextView time=text(age(article.optString("publishedAt","")),9,0xFF94A49B,false);time.setPadding(dp(6),0,0,0);meta.addView(time);copy.addView(meta);
  TextView title=text(article.optString("headline","Voetbalnieuws"),feature40?21:16,0xFFF5F8F5,true);title.setLineSpacing(dp(2),1f);LayoutParams headline=new LayoutParams(-1,-2);headline.topMargin=dp(7);copy.addView(title,headline);
  setFocusable(true);setContentDescription(article.optString("headline","Voetbalnieuws"));setOnClickListener(v->open.run());
  EditorialPhotos.bind(activity,image,article,640);
 }
 @Override protected void onMeasure(int widthSpec,int heightSpec){
  if(thumbnail==null||articleCopy==null){super.onMeasure(widthSpec,heightSpec);return;}
  LayoutParams photo=(LayoutParams)thumbnail.getLayoutParams();int available=MeasureSpec.getSize(widthSpec)-getPaddingLeft()-getPaddingRight();photo.width=feature40?available:Math.max(dp(112),Math.min(dp(180),(int)(available*.43f)));photo.height=Math.round(photo.width*9f/16f);
  super.onMeasure(widthSpec,heightSpec);
 }
 private static String age(String date){try{long minutes=(System.currentTimeMillis()-Instant.parse(date).toEpochMilli())/60000;if(minutes<0)return "";if(minutes<60)return minutes<2?"Zojuist":minutes+"m geleden";if(minutes<1440)return minutes/60+"u geleden";if(minutes<10080)return minutes/1440+"d geleden";return DateTimeFormatter.ofPattern("d MMM",new Locale("nl","NL")).withZone(ZoneId.of("Europe/Amsterdam")).format(Instant.parse(date));}catch(Exception ignored){return "";}}
}
