package nl.voetbalhub.app;

import android.app.Activity;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Home carousel and YouTube rail. All navigation crosses a validated native bridge. */
public final class HomeFeatureView extends FrameLayout {
    public interface OpenArticle {void open(JSONObject article);}
    public interface OpenMatch {void open(String snapshot);}
    private static final ExecutorService NETWORK=Executors.newFixedThreadPool(3);
    private static final String MEDIA="https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/";
    private static final String PREFS="voetbalhub_editorial";
    private final Activity activity;
    private final WebView web;
    private YoutubePlayerView videoPlayer;
    private final OpenArticle articleAction;
    private final OpenMatch matchAction;
    private final Runnable columnAction;
    private JSONObject articles=new JSONObject(),stats=new JSONObject(),videos=new JSONObject();
    private boolean ready,disposed,loading=true,videoLoading=true;
    private float startX,startY;
    private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    public HomeFeatureView(Activity activity,OpenArticle article,OpenMatch match,Runnable column){
        super(activity);this.activity=activity;articleAction=article;matchAction=match;columnAction=column;
        setBackgroundColor(0xFF050C08);
        web=new WebView(activity){
            @Override public boolean onTouchEvent(MotionEvent e){
                if(e.getActionMasked()==MotionEvent.ACTION_DOWN){startX=e.getX();startY=e.getY();}
                else if(e.getActionMasked()==MotionEvent.ACTION_MOVE){float dx=Math.abs(e.getX()-startX),dy=Math.abs(e.getY()-startY);if(dx>dp(8)&&dx>dy*1.3f)getParent().requestDisallowInterceptTouchEvent(true);}
                else if(e.getActionMasked()==MotionEvent.ACTION_UP||e.getActionMasked()==MotionEvent.ACTION_CANCEL)getParent().requestDisallowInterceptTouchEvent(false);
                return super.onTouchEvent(e);
            }
        };
        web.setBackgroundColor(0xFF050C08);web.setVerticalScrollBarEnabled(false);web.setHorizontalScrollBarEnabled(false);web.setOverScrollMode(OVER_SCROLL_NEVER);
        web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowContentAccess(false);web.getSettings().setAllowFileAccess(true);web.getSettings().setDomStorageEnabled(false);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);web.getSettings().setSupportMultipleWindows(false);
        web.addJavascriptInterface(new Bridge(),"HomeHub");
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){if("file:///android_asset/home-features.html".equals(url)){ready=true;deliver();}}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return true;}
        });
        addView(web,new FrameLayout.LayoutParams(-1,-1));
        try{articles=new JSONObject(activity.getSharedPreferences(PREFS,0).getString("last_articles","{}"));}catch(Exception ignored){}
        try{stats=new JSONObject(activity.getSharedPreferences("eredivisie-statistics",0).getString("snapshot","{}"));}catch(Exception ignored){}
        try{videos=new JSONObject(activity.getSharedPreferences(PREFS,0).getString("youtube_videos","{}"));}catch(Exception ignored){}
        if(videos.optJSONArray("videos")==null)try(InputStream in=activity.getAssets().open("youtube-seed.json")){
            ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>200000)throw new Exception("Seed too large");}videos=new JSONObject(out.toString("UTF-8"));
        }catch(Exception ignored){}
        web.loadUrl("file:///android_asset/home-features.html");
        fetch("https://voetbalhub-redactie.onrender.com/articles",0);
        fetch(MEDIA+"statistics/eredivisie.json?v="+System.currentTimeMillis()/60000,1);
        fetch(MEDIA+"videos/eredivisie.json?v="+System.currentTimeMillis()/60000,2);
    }
    private void deliver(){if(!ready||disposed||videoPlayer!=null||activity.isFinishing())return;try{
        JSONObject payload=new JSONObject();Branding.response(articles);Branding.response(stats);payload.put("articles",articles.optJSONArray("articles"));payload.put("stats",stats);payload.put("videos",videos);payload.put("loading",loading);payload.put("videoLoading",videoLoading);
        web.evaluateJavascript("window.setData("+JSONObject.quote(payload.toString())+")",null);
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
    public boolean closeVideo(){
        if(videoPlayer==null)return false;
        YoutubePlayerView old=videoPlayer;videoPlayer=null;removeView(old);old.dispose();
        if(!disposed&&ready){web.evaluateJavascript("window.setVideoPlaying(false)",null);deliver();}
        return true;
    }
    @Override protected void onDetachedFromWindow(){disposed=true;ready=false;closeVideo();web.stopLoading();web.removeJavascriptInterface("HomeHub");web.loadUrl("about:blank");super.onDetachedFromWindow();}
    private final class Bridge {
        @JavascriptInterface public void resize(String raw){activity.runOnUiThread(()->{if(disposed)return;try{int height=dp(Math.max(300,Math.min(1800,Float.parseFloat(raw))));if(getLayoutParams()!=null&&Math.abs(getLayoutParams().height-height)>2){getLayoutParams().height=height;requestLayout();}}catch(Exception ignored){}});}
        @JavascriptInterface public void openArticle(String id){activity.runOnUiThread(()->{JSONObject a=findArticle(id);if(a!=null&&!disposed)articleAction.open(a);});}
        @JavascriptInterface public void openColumn(String ignored){activity.runOnUiThread(()->{if(disposed)return;JSONObject latest=null;JSONArray rows=articles.optJSONArray("articles");if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject a=rows.optJSONObject(i);if(a!=null&&"published".equals(a.optString("status"))&&isColumn(a)&&(latest==null||a.optString("publishedAt").compareTo(latest.optString("publishedAt"))>0))latest=a;}if(latest!=null)articleAction.open(latest);else columnAction.run();});}
        @JavascriptInterface public void openMatch(String unused){activity.runOnUiThread(()->{if(disposed)return;try{JSONObject f=stats.getJSONObject("featured").getJSONObject("preview").getJSONObject("fixture");if(stats.getJSONObject("league").optInt("id")==88&&java.time.Instant.parse(f.getString("date")).toEpochMilli()>System.currentTimeMillis()&&("NS".equals(f.optString("status"))||"TBD".equals(f.optString("status"))))matchAction.open(stats.toString());}catch(Exception ignored){}});}
        @JavascriptInterface public void openVideo(String raw){activity.runOnUiThread(()->{
            if(disposed||activity.isFinishing())return;
            try{
                JSONObject request=new JSONObject(raw);String id=request.optString("id");if(!id.matches("[A-Za-z0-9_-]{11}"))return;
                JSONArray rows=videos.optJSONArray("videos");if(rows==null)return;
                JSONObject chosen=null;for(int i=0;i<rows.length();i++){JSONObject v=rows.optJSONObject(i);if(v!=null&&id.equals(v.optString("id"))){chosen=v;break;}}
                if(chosen==null)return;long age=System.currentTimeMillis()-java.time.Instant.parse(chosen.getString("publishedAt")).toEpochMilli();if(age<0||age>7L*86400000)return;
                float top=(float)request.optDouble("top",-1),height=(float)request.optDouble("height",0);
                if(!Float.isFinite(top)||!Float.isFinite(height)||top<0||height<244||top+height>getHeight()/getResources().getDisplayMetrics().density+3)return;
                closeVideo();videoPlayer=new YoutubePlayerView(activity,id,chosen.optString("title"),()->closeVideo());
                FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(-1,dp(height));lp.topMargin=dp(top);addView(videoPlayer,lp);
                web.evaluateJavascript("window.setVideoPlaying(true)",null);
            }catch(Exception ignored){}
        });}

    }
}
