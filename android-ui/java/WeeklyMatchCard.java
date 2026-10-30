package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Typeface;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.ImageView;
import android.util.LruCache;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.json.JSONObject;

/** Compact match feature with a clear title, fixture and separate call to action. */
public final class WeeklyMatchCard extends LinearLayout {
    private static final ExecutorService LOGOS=Executors.newFixedThreadPool(2);
    private static final LruCache<String,Bitmap> LOGO_CACHE=new LruCache<String,Bitmap>(1024){@Override protected int sizeOf(String k,Bitmap v){return Math.max(1,v.getByteCount()/1024);}};
    private final Activity activity;
    private final LinearLayout matchRow;
    private final ImageView homeLogo,awayLogo;
    private final TextView label, title, teams, details, summary, action;
    public interface PreviewAction { void open(String snapshot); }
    private final Runnable openStatistics;
    private final PreviewAction openPreview;
    private final int green=0xFF25F06B, muted=0xFFA5B4AA;
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    private TextView text(String value,int size,int color,boolean bold){TextView t=new TextView(activity);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
    public WeeklyMatchCard(Activity activity,Runnable statistics,PreviewAction preview){
        super(activity);this.activity=activity;this.openStatistics=statistics;this.openPreview=preview;
        setOrientation(VERTICAL);setPadding(dp(14),dp(12),dp(14),dp(8));
        GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFF183227,0xFF0E1C16});
        bg.setCornerRadius(dp(20));bg.setStroke(dp(1),0xFF365C42);setBackground(bg);
        label=text("EREDIVISIE",10,green,true);label.setLetterSpacing(.16f);addView(label);
        title=text("Eredivisie in cijfers",22,0xFFF4F7F3,true);LayoutParams heading=new LayoutParams(-1,-2);heading.topMargin=dp(8);addView(title,heading);
        matchRow=new LinearLayout(activity);matchRow.setGravity(Gravity.CENTER_VERTICAL);matchRow.setVisibility(GONE);
        homeLogo=new ImageView(activity);homeLogo.setScaleType(ImageView.ScaleType.FIT_CENTER);matchRow.addView(homeLogo,new LayoutParams(dp(52),dp(60)));
        teams=text("",23,0xFFFFFFFF,true);teams.setGravity(Gravity.CENTER);teams.setLineSpacing(dp(3),1f);teams.setPadding(dp(8),0,dp(8),0);matchRow.addView(teams,new LayoutParams(0,-2,1));
        awayLogo=new ImageView(activity);awayLogo.setScaleType(ImageView.ScaleType.FIT_CENTER);matchRow.addView(awayLogo,new LayoutParams(dp(52),dp(60)));
        LayoutParams match=new LayoutParams(-1,-2);match.topMargin=dp(12);addView(matchRow,match);
        details=text("Stand, uitslagen en programma",12,muted,false);details.setLineSpacing(dp(3),1f);LayoutParams meta=new LayoutParams(-1,-2);meta.topMargin=dp(8);addView(details,meta);
        summary=text("Alle club- en spelersstatistieken op één plek.",13,muted,false);summary.setLineSpacing(dp(3),1f);LayoutParams sub=new LayoutParams(-1,-2);sub.topMargin=dp(8);addView(summary,sub);
        LinearLayout cta=new LinearLayout(activity);cta.setGravity(Gravity.CENTER_VERTICAL);
        action=text("Bekijk de statistieken",13,green,true);cta.addView(action,new LayoutParams(0,-2,1));
        TextView arrow=text("→",24,green,false);cta.addView(arrow);LayoutParams ctaParams=new LayoutParams(-1,dp(28));ctaParams.topMargin=dp(6);addView(cta,ctaParams);
        setFocusable(true);setOnClickListener(v->openStatistics.run());
        String cached=activity.getSharedPreferences("eredivisie-statistics",0).getString("snapshot",null);if(cached!=null)try{show(new JSONObject(cached));}catch(Exception ignored){}
        new Thread(this::load,"weekly-match-card").start();
    }
    private void show(JSONObject data)throws Exception{
        if(data.optInt("schemaVersion")!=1||data.optJSONObject("league")==null||data.getJSONObject("league").optInt("id")!=88)return;
        JSONObject feature=data.optJSONObject("featured");if(feature==null)return;
        JSONObject p=feature.optJSONObject("preview");if(p==null)return;
        JSONObject fixture=p.optJSONObject("fixture");if(fixture==null)return;
        Instant kickoff=Instant.parse(fixture.getString("date"));if(kickoff.toEpochMilli()<=System.currentTimeMillis())return;
        String home=fixture.getJSONObject("home").getString("name"),away=fixture.getJSONObject("away").getString("name");
        label.setText("WEDSTRIJD VAN DE WEEK");title.setVisibility(GONE);
        teams.setText(home+"  –  "+away);matchRow.setVisibility(VISIBLE);
        loadLogo(homeLogo,fixture.getJSONObject("home").optString("logo",""),home);
        loadLogo(awayLogo,fixture.getJSONObject("away").optString("logo",""),away);
        String when=DateTimeFormatter.ofPattern("EEEE d MMMM · HH:mm",new Locale("nl","NL")).withZone(ZoneId.of("Europe/Amsterdam")).format(kickoff);
        String round=feature.optString("round","");details.setText(when+(round.isEmpty()?"":"  ·  "+round));
        summary.setVisibility(GONE);action.setText("Bekijk de voorbeschouwing");
        setContentDescription("Wedstrijd van de week: "+home+" tegen "+away+". "+when+". Bekijk de voorbeschouwing.");setOnClickListener(v->openPreview.open(data.toString()));
    }
    private void loadLogo(ImageView view,String address,String club){
        view.setTag(address);view.setImageDrawable(null);view.setContentDescription("Clublogo "+club);
        if(!address.startsWith("https://"))return;
        Bitmap cached=LOGO_CACHE.get(address);if(cached!=null){view.setImageBitmap(cached);return;}
        LOGOS.execute(()->{HttpURLConnection connection=null;try{
            connection=(HttpURLConnection)new URL(address).openConnection();connection.setConnectTimeout(8000);connection.setReadTimeout(10000);connection.setInstanceFollowRedirects(false);
            if(connection.getResponseCode()!=200||connection.getContentLength()>2000000)return;
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] block=new byte[4096];int n;while((n=in.read(block))!=-1){bytes.write(block,0,n);if(bytes.size()>2000000)return;}}
            byte[] raw=bytes.toByteArray();BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(raw,0,raw.length,bounds);
            if(bounds.outWidth<=0||bounds.outHeight<=0)return;
            BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;while(Math.max(bounds.outWidth,bounds.outHeight)/options.inSampleSize>384)options.inSampleSize*=2;
            Bitmap bitmap=BitmapFactory.decodeByteArray(raw,0,raw.length,options);if(bitmap==null)return;LOGO_CACHE.put(address,bitmap);
            activity.runOnUiThread(()->{if(!activity.isFinishing()&&address.equals(view.getTag()))view.setImageBitmap(bitmap);});
        }catch(Exception ignored){}finally{if(connection!=null)connection.disconnect();}});
    }
    private void load(){HttpURLConnection conn=null;try{
        conn=(HttpURLConnection)new URL("https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json?v="+System.currentTimeMillis()/60000).openConnection();
        conn.setConnectTimeout(12000);conn.setReadTimeout(15000);conn.setInstanceFollowRedirects(false);if(conn.getResponseCode()!=200)return;
        ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=conn.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>3000000)return;}}
        JSONObject data=new JSONObject(out.toString("UTF-8"));activity.runOnUiThread(()->{if(!activity.isFinishing())try{show(data);}catch(Exception ignored){}});
    }catch(Exception ignored){}finally{if(conn!=null)conn.disconnect();}}
}
