package nl.voetbalhub.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.concurrent.Executors;

/** One request and one cached snapshot shared by the home and the native news rows. */
public final class FeedRepository {
 public interface Listener {void changed(JSONObject data,boolean loading,boolean failed);}
 private static final Handler UI=new Handler(Looper.getMainLooper());
 private static final String CACHE_KEY="approved_article_snapshot";
 private static final String CACHE_AT="approved_article_snapshot_at";
 // An offline copy is temporary; publication rights may change.
 private static final long CACHE_MAX_AGE_MS=12L*60*60*1000;
 private static final ArrayList<Listener> listeners=new ArrayList<>();
 private static final java.util.concurrent.ExecutorService NETWORK=Executors.newFixedThreadPool(2);
 private static JSONObject snapshot;
 private static boolean loading,failed;
 private static long lastAttempt;
 private static int generation;
 private static java.util.concurrent.Future<?> pending;
 private static Context context;
 private static String endpoint="https://voetbalhub-redactie.onrender.com/articles";
 private FeedRepository(){}
 public static void configure(Context c,String address){
  context=c.getApplicationContext();
  restoreApprovedSnapshot();
  if(address==null)return;
  String root=address.trim().replaceAll("/+$","");
  if(!root.startsWith("https://"))return;
  endpoint=root.endsWith("/articles")?root:root+"/articles";
 }
 public static void subscribe(Context c,Listener listener){
  if(context==null)context=c.getApplicationContext();
  restoreApprovedSnapshot();
  if(!listeners.contains(listener))listeners.add(listener);listener.changed(snapshot,loading,failed);
 }
 public static void unsubscribe(Listener listener){listeners.remove(listener);}
 static void artworkChanged(){
  for(Listener listener:new ArrayList<>(listeners))if(listener instanceof FeedPanel)((FeedPanel)listener).artworkChanged();
  notifyListeners();
 }
 private static void notifyListeners(){for(Listener listener:new ArrayList<>(listeners))listener.changed(snapshot,loading,failed);}
 // The persisted bytes were already filtered against image rights and publication
 // policy at download time. A bounded age prevents indefinite stale articles.
 private static void restoreApprovedSnapshot(){
  if(snapshot!=null||context==null)return;
  android.content.SharedPreferences prefs=context.getSharedPreferences("voetbalhub_editorial",0);
  long cachedAt=prefs.getLong(CACHE_AT,0),age=System.currentTimeMillis()-cachedAt;
  if(cachedAt<=0||age<0||age>CACHE_MAX_AGE_MS)return;
  try{
   JSONObject stored=new JSONObject(prefs.getString(CACHE_KEY,"{}"));
   if(ArticleArtwork.feedApproved(stored)&&stored.optJSONArray("articles")!=null)
    snapshot=stored;
  }catch(org.json.JSONException ignored){}
 }
 public static void refresh(boolean force){
  if(loading||context==null||!force&&lastAttempt>0&&android.os.SystemClock.elapsedRealtime()-lastAttempt<30000)return;
  lastAttempt=android.os.SystemClock.elapsedRealtime();loading=true;failed=false;notifyListeners();
  final int request=++generation;final String address=endpoint;
  final Runnable expired=()->{if(request!=generation||!loading)return;generation++;loading=false;failed=true;if(pending!=null)pending.cancel(true);notifyListeners();};
  UI.postDelayed(expired,50000);
  pending=NETWORK.submit(()->{
   JSONObject result=null;
   try{
    JSONObject raw=new JSONObject(DeadlineHttp.get(address,45000,3000000));
    if(ArticleArtwork.feedApproved(raw))result=FeedVisibility.filter(PublicationPolicy.articleFeed(raw));
   }catch(Exception error){android.util.Log.w("VeldioFeed",error.getClass().getSimpleName());}
   final JSONObject data=result;
   UI.post(()->{
    if(request!=generation)return;
    UI.removeCallbacks(expired);
    loading=false;
    failed=data==null;
    if(data!=null){
     snapshot=Branding.response(data);
     // Only save validated and visibility-filtered articles, never raw API data.
     context.getSharedPreferences("voetbalhub_editorial",0).edit()
      .putString(CACHE_KEY,snapshot.toString())
      .putLong(CACHE_AT,System.currentTimeMillis())
      .remove("last_articles").putLong("last_fetch_at",System.currentTimeMillis()).apply();
    }
    notifyListeners();
   });
  });
 }
}
