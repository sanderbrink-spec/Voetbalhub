package nl.voetbalhub.app;
import android.app.Activity;
import android.view.*;
import android.widget.*;
import org.json.*;
/** Checked video catalogue, original preview art and the existing consented official player. */
public final class VideoShelf40 extends FrameLayout {
 private final Activity a;private final LinearLayout list;private YoutubePlayerView player;private boolean attached;private static final java.util.concurrent.ExecutorService IO=java.util.concurrent.Executors.newFixedThreadPool(1);
 private int dp(float n){return PremiumDesign40.dp(a,n);}
 public VideoShelf40(Activity a){super(a);this.a=a;setBackgroundColor(PremiumDesign40.INK);ScrollView scroll=new ScrollView(a);list=new LinearLayout(a);list.setOrientation(1);list.setPadding(dp(12),dp(14),dp(12),dp(28));scroll.addView(list);addView(scroll,new LayoutParams(-1,-1));list.addView(PremiumDesign40.text(a,"Video’s",28,PremiumDesign40.WHITE,true));list.addView(PremiumDesign40.text(a,"Officiële kanalen · Afspelen via YouTube",12,PremiumDesign40.MUTED,false));}
 private void load(){IO.execute(()->{JSONObject data=null;try{JSONObject r=new JSONObject(DeadlineHttp.get("https://voetbalhub-redactie.onrender.com/integrations/videos",12000,500000));if(PublicationPolicy.allows(r))data=r;}catch(Exception ignored){}final JSONObject result=data;a.runOnUiThread(()->{if(attached)render(result);});});}
 private void render(JSONObject data){while(list.getChildCount()>2)list.removeViewAt(2);int n=0;JSONArray rows=data==null?null:data.optJSONArray("videos");if(rows!=null)for(int i=0;i<rows.length()&&n<16;i++){JSONObject v=rows.optJSONObject(i);if(v==null||!v.optString("id").matches("[A-Za-z0-9_-]{11}"))continue;try{long age=System.currentTimeMillis()-java.time.Instant.parse(v.getString("publishedAt")).toEpochMilli();if(age<0||age>7L*86400000)continue;}catch(Exception e){continue;}LinearLayout card=new LinearLayout(a);card.setOrientation(1);PremiumDesign40.card(card,PremiumDesign40.EDGE);PremiumDesign40.touch(card);ImageView art=new ImageView(a);art.setImageBitmap(PremiumDesign40.artwork(a,"videos"));art.setScaleType(ImageView.ScaleType.CENTER_CROP);art.setContentDescription("Decoratieve video-illustratie, geen beeld uit de video");card.addView(art,new LinearLayout.LayoutParams(-1,dp(146)));TextView title=PremiumDesign40.text(a,"▶  "+v.optString("title"),17,PremiumDesign40.WHITE,true);title.setPadding(dp(14),dp(12),dp(14),dp(8));card.addView(title);TextView source=PremiumDesign40.text(a,v.optString("channel")+" · YouTube",12,PremiumDesign40.GREEN,false);source.setPadding(dp(14),0,dp(14),dp(14));card.addView(source);card.setOnClickListener(x->play(v));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(14);list.addView(card,lp);n++;}
  if(n==0){TextView empty=PremiumDesign40.text(a,"Er zijn momenteel geen vrijgegeven video’s beschikbaar. Probeer later opnieuw.",15,PremiumDesign40.MUTED,false);empty.setPadding(dp(14),dp(24),dp(14),dp(20));list.addView(empty);}Button retry=new Button(a);retry.setText("Vernieuwen");PremiumDesign40.polish(retry);retry.setOnClickListener(x->load());list.addView(retry);
 }
 private void play(JSONObject v){closeVideo();player=new YoutubePlayerView(a,v.optString("id"),v.optString("title"),this::closeVideo);addView(player,new LayoutParams(-1,dp(300),Gravity.TOP));}
 public boolean closeVideo(){if(player!=null){YoutubePlayerView old=player;player=null;removeView(old);old.dispose();return true;}return false;}
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();attached=true;render(null);load();}
 @Override protected void onDetachedFromWindow(){attached=false;closeVideo();super.onDetachedFromWindow();}
}
