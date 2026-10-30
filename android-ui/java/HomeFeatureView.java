package nl.voetbalhub.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Home carousel and YouTube rail. All navigation crosses a validated native bridge. */
public final class HomeFeatureView extends WebView {
    public interface OpenArticle {void open(JSONObject article);}
    public interface OpenMatch {void open(String snapshot);}
    private static final ExecutorService NETWORK=Executors.newFixedThreadPool(3);
    private static final String MEDIA="https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/";
    private static final String PREFS="voetbalhub_editorial";
    private final Activity activity;
    private final OpenArticle articleAction;
    private final OpenMatch matchAction;
    private final Runnable columnAction;
    private JSONObject articles=new JSONObject(),stats=new JSONObject(),videos=new JSONObject();
    private boolean ready,disposed,loading=true,videoLoading=true;
    private float startX,startY;
    private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    public HomeFeatureView(Activity activity,OpenArticle article,OpenMatch match,Runnable column){
        super(activity);this.activity=activity;articleAction=article;matchAction=match;columnAction=column;
        setBackgroundColor(0xFF050C08);setVerticalScrollBarEnabled(false);setHorizontalScrollBarEnabled(false);setOverScrollMode(OVER_SCROLL_NEVER);
        getSettings().setJavaScriptEnabled(true);getSettings().setAllowContentAccess(false);getSettings().setAllowFileAccess(true);getSettings().setDomStorageEnabled(false);
        getSettings().setJavaScriptCanOpenWindowsAutomatically(false);getSettings().setSupportMultipleWindows(false);
        addJavascriptInterface(new Bridge(),"HomeHub");
        setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){if("file:///android_asset/home-features.html".equals(url)){ready=true;deliver();}}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return true;}
        });
        try{articles=new JSONObject(activity.getSharedPreferences(PREFS,0).getString("last_articles","{}"));}catch(Exception ignored){}
        try{stats=new JSONObject(activity.getSharedPreferences("eredivisie-statistics",0).getString("snapshot","{}"));}catch(Exception ignored){}
        try{videos=new JSONObject(activity.getSharedPreferences(PREFS,0).getString("youtube_videos","{}"));}catch(Exception ignored){}
        loadUrl("file:///android_asset/home-features.html");
        fetch("https://voetbalhub-redactie.onrender.com/articles",0);
        fetch(MEDIA+"statistics/eredivisie.json?v="+System.currentTimeMillis()/60000,1);
        fetch(MEDIA+"videos/eredivisie.json?v="+System.currentTimeMillis()/60000,2);
    }
    private void deliver(){if(!ready||disposed||activity.isFinishing())return;try{
        JSONObject payload=new JSONObject();payload.put("articles",articles.optJSONArray("articles"));payload.put("stats",stats);payload.put("videos",videos);payload.put("loading",loading);payload.put("videoLoading",videoLoading);
        evaluateJavascript("window.setData("+JSONObject.quote(payload.toString())+")",null);
    }catch(Exception ignored){}}
    private void fetch(String address,int kind){NETWORK.execute(()->{HttpURLConnection conn=null;JSONObject result=null;try{
        conn=(HttpURLConnection)new URL(address).openConnection();conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(kind==0?75000:20000);if(conn.getResponseCode()!=200)throw new Exception("Unavailable");
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=conn.getInputStream()){byte[] block=new byte[8192];int n;while((n=in.read(block))!=-1){bytes.write(block,0,n);if(bytes.size()>3000000)throw new Exception("Too large");}}
        JSONObject data=new JSONObject(bytes.toString("UTF-8"));
        if(kind==0&&data.optJSONArray("articles")==null||kind==1&&(data.optInt("schemaVersion")!=1||data.optJSONObject("league")==null||data.getJSONObject("league").optInt("id")!=88)||kind==2&&(data.optInt("schemaVersion")!=1||data.optJSONArray("videos")==null))throw new Exception("Invalid snapshot");result=data;
    }catch(Exception ignored){}finally{if(conn!=null)conn.disconnect();}
        final JSONObject data=result;activity.runOnUiThread(()->{if(disposed||activity.isFinishing())return;
            if(kind==0)loading=false;if(kind==2)videoLoading=false;
            if(data!=null){if(kind==0){articles=data;activity.getSharedPreferences(PREFS,0).edit().putString("last_articles",data.toString()).apply();}else if(kind==1){stats=data;activity.getSharedPreferences("eredivisie-statistics",0).edit().putString("snapshot",data.toString()).apply();}else{videos=data;activity.getSharedPreferences(PREFS,0).edit().putString("youtube_videos",data.toString()).apply();}}deliver();
        });
    });}
    private JSONObject findArticle(String id){JSONArray rows=articles.optJSONArray("articles");if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject a=rows.optJSONObject(i);if(a!=null&&"published".equals(a.optString("status"))&&id.equals(a.optString("id")))return a;}return null;}
    private boolean isColumn(JSONObject a){return "column".equalsIgnoreCase(a.optString("type"))||"column".equalsIgnoreCase(a.optString("category"))||"de derde helft".equalsIgnoreCase(a.optString("category"));}
    @Override public boolean onTouchEvent(MotionEvent e){if(e.getActionMasked()==MotionEvent.ACTION_DOWN){startX=e.getX();startY=e.getY();}else if(e.getActionMasked()==MotionEvent.ACTION_MOVE){float dx=Math.abs(e.getX()-startX),dy=Math.abs(e.getY()-startY);if(dx>dp(8)&&dx>dy*1.3f)getParent().requestDisallowInterceptTouchEvent(true);}else if(e.getActionMasked()==MotionEvent.ACTION_UP||e.getActionMasked()==MotionEvent.ACTION_CANCEL)getParent().requestDisallowInterceptTouchEvent(false);return super.onTouchEvent(e);}
    @Override protected void onDetachedFromWindow(){disposed=true;ready=false;stopLoading();removeJavascriptInterface("HomeHub");loadUrl("about:blank");super.onDetachedFromWindow();}
    private final class Bridge {
        @JavascriptInterface public void resize(String raw){activity.runOnUiThread(()->{if(disposed)return;try{int height=dp(Math.max(300,Math.min(1800,Float.parseFloat(raw))));if(getLayoutParams()!=null&&Math.abs(getLayoutParams().height-height)>2){getLayoutParams().height=height;requestLayout();}}catch(Exception ignored){}});}
        @JavascriptInterface public void openArticle(String id){activity.runOnUiThread(()->{JSONObject a=findArticle(id);if(a!=null&&!disposed)articleAction.open(a);});}
        @JavascriptInterface public void openColumn(String ignored){activity.runOnUiThread(()->{if(disposed)return;JSONObject latest=null;JSONArray rows=articles.optJSONArray("articles");if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject a=rows.optJSONObject(i);if(a!=null&&"published".equals(a.optString("status"))&&isColumn(a)&&(latest==null||a.optString("publishedAt").compareTo(latest.optString("publishedAt"))>0))latest=a;}if(latest!=null)articleAction.open(latest);else columnAction.run();});}
        @JavascriptInterface public void openMatch(String ignored){activity.runOnUiThread(()->{if(disposed)return;try{JSONObject f=stats.getJSONObject("featured").getJSONObject("preview").getJSONObject("fixture");if(stats.getJSONObject("league").optInt("id")==88&&java.time.Instant.parse(f.getString("date")).toEpochMilli()>System.currentTimeMillis()&&("NS".equals(f.optString("status"))||"TBD".equals(f.optString("status"))))matchAction.open(stats.toString());}catch(Exception ignored){}});}
        @JavascriptInterface public void openVideo(String id){activity.runOnUiThread(()->{if(disposed||!id.matches("[A-Za-z0-9_-]{11}"))return;JSONArray rows=videos.optJSONArray("videos");if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject v=rows.optJSONObject(i);if(v==null||!id.equals(v.optString("id")))continue;try{long age=System.currentTimeMillis()-java.time.Instant.parse(v.getString("publishedAt")).toEpochMilli();if(age<0||age>7L*86400000)return;activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.youtube.com/watch?v="+id)));}catch(Exception ignored){}return;}});}
    }
}
