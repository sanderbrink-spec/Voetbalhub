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
  if(address==null)return;
  String root=address.trim().replaceAll("/+$","");
  if(!root.startsWith("https://"))return;
  endpoint=root.endsWith("/articles")?root:root+"/articles";
 }
 public static void subscribe(Context c,Listener listener){
  if(context==null)context=c.getApplicationContext();
  if(!listeners.contains(listener))listeners.add(listener);listener.changed(snapshot,loading,failed);
 }
 public static void unsubscribe(Listener listener){listeners.remove(listener);}
 static void artworkChanged(){
  for(Listener listener:new ArrayList<>(listeners))if(listener instanceof FeedPanel)((FeedPanel)listener).artworkChanged();
  notifyListeners();
 }
 private static void notifyListeners(){for(Listener listener:new ArrayList<>(listeners))listener.changed(snapshot,loading,failed);}
 public static void refresh(boolean force){
  if(loading||context==null||!force&&lastAttempt>0&&android.os.SystemClock.elapsedRealtime()-lastAttempt<30000)return;
  lastAttempt=android.os.SystemClock.elapsedRealtime();loading=true;failed=false;notifyListeners();
  final int request=++generation;final String address=endpoint;
  final Runnable expired=()->{if(request!=generation||!loading)return;generation++;loading=false;failed=true;snapshot=null;if(pending!=null)pending.cancel(true);notifyListeners();};
  UI.postDelayed(expired,20000);
  pending=NETWORK.submit(()->{
   JSONObject result=null;
   try{
    JSONObject raw=new JSONObject(DeadlineHttp.get(address,11000,3000000));
    if(ArticleArtwork.feedApproved(raw))result=FeedVisibility.filter(PublicationPolicy.articleFeed(raw));
   }catch(Exception error){android.util.Log.w("VeldioFeed",error.getClass().getSimpleName());}
   final JSONObject data=result;
   UI.post(()->{
    if(request!=generation)return;
    UI.removeCallbacks(expired);
    loading=false;
    failed=data==null;
    snapshot=data==null?new JSONObject():Branding.response(data);
    if(data!=null)context.getSharedPreferences("voetbalhub_editorial",0).edit()
      .remove("last_articles").putLong("last_fetch_at",System.currentTimeMillis()).apply();
    notifyListeners();
   });
  });
 }
}
