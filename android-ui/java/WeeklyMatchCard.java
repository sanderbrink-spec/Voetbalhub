package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Typeface;
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
    private final Activity activity;
    private final TextView label, title, teams, details, summary, action;
    private final Runnable openStatistics, openPreview;
    private final int green=0xFFADFF2F, muted=0xFFA5B4AA;
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    private TextView text(String value,int size,int color,boolean bold){TextView t=new TextView(activity);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
    public WeeklyMatchCard(Activity activity,Runnable statistics,Runnable preview){
        super(activity);this.activity=activity;this.openStatistics=statistics;this.openPreview=preview;
        setOrientation(VERTICAL);setPadding(dp(18),dp(18),dp(18),dp(16));
        GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFF183227,0xFF0E1C16});
        bg.setCornerRadius(dp(20));bg.setStroke(dp(1),0xFF365C42);setBackground(bg);
        label=text("EREDIVISIE",10,green,true);label.setLetterSpacing(.16f);addView(label);
        title=text("Eredivisie in cijfers",22,0xFFF4F7F3,true);LayoutParams heading=new LayoutParams(-1,-2);heading.topMargin=dp(8);addView(title,heading);
        teams=text("",28,0xFFFFFFFF,true);teams.setLineSpacing(dp(3),1f);teams.setVisibility(GONE);LayoutParams match=new LayoutParams(-1,-2);match.topMargin=dp(12);addView(teams,match);
        details=text("Stand, uitslagen en programma",12,muted,false);details.setLineSpacing(dp(3),1f);LayoutParams meta=new LayoutParams(-1,-2);meta.topMargin=dp(8);addView(details,meta);
        summary=text("Alle club- en spelersstatistieken op één plek.",13,muted,false);summary.setLineSpacing(dp(3),1f);LayoutParams sub=new LayoutParams(-1,-2);sub.topMargin=dp(8);addView(summary,sub);
        LinearLayout cta=new LinearLayout(activity);cta.setGravity(Gravity.CENTER_VERTICAL);
        action=text("Bekijk de statistieken",13,green,true);cta.addView(action,new LayoutParams(0,-2,1));
        TextView arrow=text("→",24,green,false);cta.addView(arrow);LayoutParams ctaParams=new LayoutParams(-1,dp(40));ctaParams.topMargin=dp(10);addView(cta,ctaParams);
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
        label.setText("UITGELICHT · EREDIVISIE");title.setText("Wedstrijd van de week");title.setTextSize(20);
        teams.setText(home+"  –  "+away);teams.setVisibility(VISIBLE);
        String when=DateTimeFormatter.ofPattern("EEEE d MMMM · HH:mm",new Locale("nl","NL")).withZone(ZoneId.of("Europe/Amsterdam")).format(kickoff);
        String round=feature.optString("round","");details.setText(when+(round.isEmpty()?"":"  ·  "+round));
        summary.setText("Vorm, onderlinge duels en doelpuntenmakers.");action.setText("Bekijk de voorbeschouwing");
        setContentDescription("Wedstrijd van de week: "+home+" tegen "+away+". "+when+". Bekijk de voorbeschouwing.");setOnClickListener(v->openPreview.run());
    }
    private void load(){HttpURLConnection conn=null;try{
        conn=(HttpURLConnection)new URL("https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json?v="+System.currentTimeMillis()/60000).openConnection();
        conn.setConnectTimeout(12000);conn.setReadTimeout(15000);conn.setInstanceFollowRedirects(false);if(conn.getResponseCode()!=200)return;
        ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=conn.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>3000000)return;}}
        JSONObject data=new JSONObject(out.toString("UTF-8"));activity.runOnUiThread(()->{if(!activity.isFinishing())try{show(data);}catch(Exception ignored){}});
    }catch(Exception ignored){}finally{if(conn!=null)conn.disconnect();}}
}
