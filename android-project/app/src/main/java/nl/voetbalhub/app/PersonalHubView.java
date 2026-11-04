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
    private JSONArray directory=new JSONArray();
    private boolean ready,offline,disposed;
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
        try(InputStream in=activity.getAssets().open("club-directory.json")){directory=new JSONObject(new String(BoundedInput.read(in,100000),java.nio.charset.StandardCharsets.UTF_8)).getJSONArray("clubs");}catch(Exception ignored){}
        web.loadUrl("file:///android_asset/personal-hub.html");
        try{JSONObject feed=PublicationPolicy.articleFeed(articles);articles=feed==null?new JSONObject():feed;}catch(Exception ignored){articles=new JSONObject();}
        if(!PublicationPolicy.allows(stats))stats=new JSONObject();
        fetch("https://voetbalhub-redactie.onrender.com/articles",true);
        fetch("https://voetbalhub-redactie.onrender.com/integrations/statistics",false);
    }
    public void refreshSaved(){deliver();}
    public boolean handleBack(){return pageHistory.back();}
    public String navigationState(){return pageHistory.snapshot();}
    private void deliver(){if(!ready||disposed||activity.isFinishing())return;try{
        JSONObject payload=new JSONObject();Branding.response(articles);Branding.response(stats);payload.put("primaryClub",activity.getSharedPreferences("voethub",0).getString("primaryClub",""));payload.put("directory",directory);payload.put("mode",mode);payload.put("query",query);payload.put("articles",articles.optJSONArray("articles"));payload.put("stats",stats);payload.put("saved",EditorialStore.saved(activity));payload.put("clubs",new JSONArray(activity.getSharedPreferences("voethub",0).getStringSet("clubs",new HashSet<String>())));payload.put("offline",offline);payload.put("loading",pending>0);
        web.evaluateJavascript("window.setData("+JSONObject.quote(payload.toString())+")",null);
    }catch(Exception ignored){}}
    private void fetch(String address,boolean news){NETWORK.execute(()->{HttpURLConnection connection=null;JSONObject result=null;try{
        String response=DeadlineHttp.get(address,18000,3000000);
        JSONObject data=new JSONObject(response);if(news){data=PublicationPolicy.articleFeed(data);if(data==null)throw new Exception("Feed unavailable");}else if(!PublicationPolicy.allows(data))throw new Exception("Rights approval missing");if(news?data.optJSONArray("articles")==null:data.optInt("schemaVersion")!=1||data.getJSONObject("league").optInt("id")!=88||data.getJSONArray("standings").length()==0)throw new Exception("Invalid data");result=data;
    }catch(Exception ignored){}finally{if(connection!=null)connection.disconnect();}
        final JSONObject data=result;activity.runOnUiThread(()->{if(disposed)return;pending--;if(data!=null){if(news){articles=data;activity.getSharedPreferences("voetbalhub_editorial",0).edit().putString("last_articles",data.toString()).apply();}else{stats=data;activity.getSharedPreferences("eredivisie-statistics",0).edit().putString("snapshot",data.toString()).apply();}}else offline=true;deliver();});
    });}
    private JSONObject find(String id){for(JSONArray rows:new JSONArray[]{articles.optJSONArray("articles"),EditorialStore.saved(activity)}){if(rows==null)continue;for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row!=null&&id.equals(row.optString("id"))&&"published".equals(row.optString("status")))return row;}}return null;}
    @Override protected void onDetachedFromWindow(){disposed=true;ready=false;web.stopLoading();web.removeJavascriptInterface("PersonalHub");web.destroy();super.onDetachedFromWindow();}
    private final class Bridge {
        @JavascriptInterface public void external(String address){if(address==null||address.length()>1000)return;try{android.net.Uri u=android.net.Uri.parse(address);String host=u.getHost();if(!"https".equals(u.getScheme())||u.getUserInfo()!=null)return;boolean allowed=false;for(String h:new String[]{"ajax.nl","www.ajax.nl","www.psv.nl","www.feyenoord.com","fctwente.nl","az.nl","www.az.nl","www.fcgroningen.nl","commons.wikimedia.org","creativecommons.org","eredivisie.nl"})if(h.equals(host))allowed=true;if(!allowed)return;activity.runOnUiThread(()->{if(disposed)return;try{activity.startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,u));}catch(Exception ignored){android.widget.Toast.makeText(activity,"Geen browser beschikbaar",android.widget.Toast.LENGTH_SHORT).show();}});}catch(Exception ignored){}}

        @JavascriptInterface public void back(String unused){activity.runOnUiThread(back);}
        @JavascriptInterface public void openArticle(String id){activity.runOnUiThread(()->{JSONObject row=find(id);if(row!=null&&!activity.isFinishing())open.open(row);});}
        @JavascriptInterface public void saveClubs(String raw){NETWORK.execute(()->{boolean saved=false;try{
            JSONArray requested=new JSONArray(raw);if(requested.length()>40)throw new Exception("Too many clubs");
            Set<String> valid=new HashSet<>(),selected=new HashSet<>(),previous=new HashSet<>(activity.getSharedPreferences("voethub",0).getStringSet("clubs",new HashSet<String>()));
            valid.addAll(previous);
            for(int i=0;i<directory.length();i++)valid.add(directory.getJSONObject(i).getString("name"));
            JSONArray rows=stats.optJSONArray("standings");if(rows!=null)for(int i=0;i<rows.length();i++)valid.add(rows.getJSONObject(i).getJSONObject("team").getString("name"));
            for(int i=0;i<requested.length();i++){String name=requested.getString(i);if(!valid.contains(name))throw new Exception("Unknown club");selected.add(name);}
            saved=activity.getSharedPreferences("voethub",0).edit().putStringSet("clubs",selected).commit();
            if(saved){String primary=activity.getSharedPreferences("voethub",0).getString("primaryClub","");if(!selected.contains(primary))activity.getSharedPreferences("voethub",0).edit().putString("primaryClub",selected.isEmpty()?"":new java.util.TreeSet<String>(selected).first()).commit();}
            if(!saved)activity.getSharedPreferences("voethub",0).edit().putStringSet("clubs",previous).commit();
        }catch(Exception ignored){}final boolean ok=saved;activity.runOnUiThread(()->{if(!ready||disposed||activity.isFinishing())return;web.evaluateJavascript("window.clubsSaved("+ok+")",null);if(ok)deliver();});});}
        @JavascriptInterface public void savePrimary(String name){activity.runOnUiThread(()->{java.util.Set<String> names=activity.getSharedPreferences("voethub",0).getStringSet("clubs",new HashSet<String>());if(names.contains(name)){activity.getSharedPreferences("voethub",0).edit().putString("primaryClub",name).apply();deliver();}});}
        @JavascriptInterface public void removeSaved(String id){activity.runOnUiThread(()->{JSONObject row=find(id);if(row!=null&&EditorialStore.contains(activity,row))EditorialStore.toggle(activity,row);deliver();});}
    }
}
