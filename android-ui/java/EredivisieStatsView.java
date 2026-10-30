package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Color;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Native subpage with an internal statistical view. No API keys or external match links. */
public final class EredivisieStatsView extends LinearLayout {
    private static final String FEED = "https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json";
    private final Activity activity;
    private final WebView web;
    private final WebPageHistory pageHistory;
    private final String restoredState;
    private String json;
    private boolean ready;
    public EredivisieStatsView(Activity activity, Runnable back, boolean feature) {
        this(activity,back,feature,"");
    }
    public EredivisieStatsView(Activity activity,Runnable back,boolean feature,String restoredState){
        super(activity);this.restoredState=restoredState; this.activity = activity;
        setOrientation(VERTICAL); setBackgroundColor(0xFF070D0B);
        TextView header = new TextView(activity); header.setText("‹  Eredivisie");
        header.setTextColor(Color.WHITE); header.setTextSize(22); header.setPadding(20,18,20,18);
        header.setOnClickListener(v -> back.run()); addView(header,new LayoutParams(-1,-2));
        web = new WebView(activity); web.setBackgroundColor(0xFF070D0B);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setAllowFileAccess(true);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setDomStorageEnabled(false);
        pageHistory=new WebPageHistory(web);
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){ready=true;pageHistory.restore(restoredState); deliver(); if(feature&&restoredState.isEmpty())web.evaluateJavascript("window.showFeatured&&window.showFeatured()",null);}
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){if("app".equals(req.getUrl().getScheme())&&"retry".equals(req.getUrl().getHost()))load();return true;}
        });
        addView(web,new LayoutParams(-1,0,1));
        json=activity.getSharedPreferences("eredivisie-statistics",0).getString("snapshot",null);
        web.loadUrl("file:///android_asset/eredivisie.html"); load();
    }
    public boolean handleBack(){return pageHistory.back();}
    public String navigationState(){return pageHistory.snapshot();}
    private void deliver(){if(!ready)return; if(json!=null)web.evaluateJavascript("window.setData("+JSONObject.quote(json)+")",null);}
    private void load(){new Thread(()->{
        HttpURLConnection conn=null;
        try{
            conn=(HttpURLConnection)new URL(FEED+"?v="+System.currentTimeMillis()/60000).openConnection();
            conn.setConnectTimeout(15000);conn.setReadTimeout(20000);conn.setInstanceFollowRedirects(false);
            if(conn.getResponseCode()!=200)throw new Exception("Geen statistieken beschikbaar");
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            try(InputStream in=conn.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){out.write(buffer,0,n);if(out.size()>3000000)throw new Exception("Gegevens te groot");}}
            String text=out.toString("UTF-8");JSONObject data=new JSONObject(text);
            if(data.optInt("schemaVersion")!=1||data.getJSONObject("league").optInt("id")!=88||data.getJSONArray("standings").length()==0)throw new Exception("Onvolledige gegevens");
            activity.getSharedPreferences("eredivisie-statistics",0).edit().putString("snapshot",text).apply();
            activity.runOnUiThread(()->{json=text;deliver();});
        }catch(Exception e){activity.runOnUiThread(()->{if(ready)web.evaluateJavascript("window.loadFailed&&window.loadFailed()",null);});}
        finally{if(conn!=null)conn.disconnect();}
    },"eredivisie-statistics").start();}
}
