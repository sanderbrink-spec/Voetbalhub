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
        json=null;activity.getSharedPreferences("eredivisie-statistics",0).edit().remove("snapshot").apply();
        web.loadUrl("file:///android_asset/eredivisie.html"); load();
    }
    public boolean handleBack(){return pageHistory.back();}
    public String navigationState(){return pageHistory.snapshot();}
    private void deliver(){if(!ready)return; if(json!=null)web.evaluateJavascript("window.setData("+JSONObject.quote(json)+")",null);}
    private void load(){
        json=null;
        activity.runOnUiThread(()->{if(ready)web.loadDataWithBaseURL(null,"<html lang='nl'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='background:#070d0b;color:#eef5ef;font:16px system-ui;padding:24px'><h2 style='color:#25f06b'>Eredivisie</h2><p>Competitiegegevens en clublogo’s zijn tijdelijk niet beschikbaar. De gebruiksrechten worden gecontroleerd.</p></body></html>","text/html","UTF-8",null);});
    }
}
