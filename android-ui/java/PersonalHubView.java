package nl.voetbalhub.app;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.JSONArray;
import org.json.JSONObject;

/** Local personal hub. Only published article IDs can cross the reader bridge. */
public final class PersonalHubView extends LinearLayout {
    public interface OpenArticle {void open(JSONObject article);}
    private static final ExecutorService NETWORK=Executors.newFixedThreadPool(2);
    private final Activity activity;
    private final WebView web;
    private final OpenArticle open;
    private final Runnable back;
    private final String mode,query;
    private final WebPageHistory pageHistory;
    private final String restoredState;
    private JSONObject articles=new JSONObject(),stats=new JSONObject();
    private boolean ready,offline;
    private int pending=2;
    public PersonalHubView(Activity activity,String mode,String query,OpenArticle open,Runnable back){
        this(activity,mode,query,open,back,"");
    }
    public PersonalHubView(Activity activity,String mode,String query,OpenArticle open,Runnable back,String restoredState){
        super(activity);this.restoredState=restoredState;this.activity=activity;this.mode=mode;this.query=query;this.open=open;this.back=back;setOrientation(VERTICAL);setBackgroundColor(0xFF050807);
        web=new WebView(activity);web.setBackgroundColor(0xFF050807);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowContentAccess(false);web.getSettings().setAllowFileAccess(true);web.getSettings().setDomStorageEnabled(false);
        pageHistory=new WebPageHistory(web);
        web.addJavascriptInterface(new Bridge(),"PersonalHub");web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){ready=true;pageHistory.restore(restoredState);deliver();}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
        });addView(web,new LayoutParams(-1,-1));
        try{articles=new JSONObject(activity.getSharedPreferences("voetbalhub_editorial",0).getString("last_articles","{}"));}catch(Exception ignored){}
        try{stats=new JSONObject(activity.getSharedPreferences("eredivisie-statistics",0).getString("snapshot","{}"));}catch(Exception ignored){}
        web.loadUrl("file:///android_asset/personal-hub.html");
        fetch("https://voetbalhub-redactie.onrender.com/articles",true);
        fetch("https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json",false);
    }
    public void refreshSaved(){deliver();}
    public boolean handleBack(){return pageHistory.back();}
    public String navigationState(){return pageHistory.snapshot();}
    private void deliver(){if(!ready||activity.isFinishing())return;try{
        JSONObject payload=new JSONObject();payload.put("mode",mode);payload.put("query",query);payload.put("articles",articles.optJSONArray("articles"));payload.put("stats",stats);payload.put("saved",EditorialStore.saved(activity));payload.put("clubs",new JSONArray(activity.getSharedPreferences("voethub",0).getStringSet("clubs",new HashSet<String>())));payload.put("offline",offline);payload.put("loading",pending>0);
        web.evaluateJavascript("window.setData("+JSONObject.quote(payload.toString())+")",null);
    }catch(Exception ignored){}}
    private void fetch(String address,boolean news){NETWORK.execute(()->{HttpURLConnection connection=null;JSONObject result=null;try{
        connection=(HttpURLConnection)new URL(address).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(news?75000:20000);if(connection.getResponseCode()!=200)throw new Exception("No response");
        ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] block=new byte[8192];int n;while((n=in.read(block))!=-1){out.write(block,0,n);if(out.size()>3000000)throw new Exception("Too large");}}
        JSONObject data=new JSONObject(out.toString("UTF-8"));if(news?data.optJSONArray("articles")==null:data.optInt("schemaVersion")!=1||data.getJSONObject("league").optInt("id")!=88||data.getJSONArray("standings").length()==0)throw new Exception("Invalid data");result=data;
    }catch(Exception ignored){}finally{if(connection!=null)connection.disconnect();}
        final JSONObject data=result;activity.runOnUiThread(()->{pending--;if(data!=null){if(news){articles=data;activity.getSharedPreferences("voetbalhub_editorial",0).edit().putString("last_articles",data.toString()).apply();}else{stats=data;activity.getSharedPreferences("eredivisie-statistics",0).edit().putString("snapshot",data.toString()).apply();}}else offline=true;deliver();});
    });}
    private JSONObject find(String id){for(JSONArray rows:new JSONArray[]{articles.optJSONArray("articles"),EditorialStore.saved(activity)}){if(rows==null)continue;for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row!=null&&id.equals(row.optString("id"))&&"published".equals(row.optString("status")))return row;}}return null;}
    private final class Bridge {
        @JavascriptInterface public void back(String unused){activity.runOnUiThread(back);}
        @JavascriptInterface public void openArticle(String id){activity.runOnUiThread(()->{JSONObject row=find(id);if(row!=null&&!activity.isFinishing())open.open(row);});}
        @JavascriptInterface public void saveClubs(String raw){activity.runOnUiThread(()->{try{
            JSONArray requested=new JSONArray(raw),standings=stats.optJSONArray("standings");if(requested.length()>40)return;
            Set<String> valid=new HashSet<>(),existing=activity.getSharedPreferences("voethub",0).getStringSet("clubs",new HashSet<String>()),selected=new HashSet<>();
            valid.addAll(existing);if(standings!=null)for(int i=0;i<standings.length();i++)valid.add(standings.getJSONObject(i).getJSONObject("team").getString("name"));
            for(int i=0;i<requested.length();i++){String name=requested.getString(i);if(valid.contains(name))selected.add(name);}
            activity.getSharedPreferences("voethub",0).edit().putStringSet("clubs",selected).apply();
        }catch(Exception ignored){}});}
        @JavascriptInterface public void removeSaved(String id){activity.runOnUiThread(()->{JSONObject row=find(id);if(row!=null&&EditorialStore.contains(activity,row))EditorialStore.toggle(activity,row);deliver();});}
    }
}
