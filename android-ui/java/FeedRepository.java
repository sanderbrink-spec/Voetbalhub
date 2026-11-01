package nl.voetbalhub.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
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
 private static final String MIRROR="https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/news/current.json";
 private static Context context;
 private static String endpoint="https://voetbalhub-redactie.onrender.com/articles";
 private FeedRepository(){}
 public static void configure(Context c,String address){context=c.getApplicationContext();endpoint=address;}
 public static void subscribe(Context c,Listener listener){
  if(context==null)context=c.getApplicationContext();
  if(snapshot==null)try{snapshot=Branding.response(FeedVisibility.filter(PublicationPolicy.articleFeed(new JSONObject(context.getSharedPreferences("voetbalhub_editorial",0).getString("last_articles","{}")))));}catch(Exception ignored){}
  if(snapshot==null||snapshot.optJSONArray("articles")==null||snapshot.optJSONArray("articles").length()==0)try(InputStream in=context.getAssets().open("news-bootstrap.json")){snapshot=Branding.response(FeedVisibility.filter(PublicationPolicy.articleFeed(new JSONObject(new String(BoundedInput.read(in,3000000),java.nio.charset.StandardCharsets.UTF_8)))));}catch(Exception ignored){}
  if(!listeners.contains(listener))listeners.add(listener);listener.changed(snapshot,loading,failed);
 }
 public static void unsubscribe(Listener listener){listeners.remove(listener);}
 private static void notifyListeners(){for(Listener listener:new ArrayList<>(listeners))listener.changed(snapshot,loading,failed);}
 public static void refresh(boolean force){
  if(loading||context==null||!force&&lastAttempt>0&&android.os.SystemClock.elapsedRealtime()-lastAttempt<30000)return;
  lastAttempt=android.os.SystemClock.elapsedRealtime();loading=true;failed=false;notifyListeners();
  final int request=++generation;final String address=endpoint;
  final Runnable expired=()->{if(request!=generation||!loading)return;generation++;loading=false;failed=true;if(pending!=null)pending.cancel(true);notifyListeners();};
  UI.postDelayed(expired,14000);
  pending=NETWORK.submit(()->{
   JSONObject result=null;
   for(String url:new String[]{address,MIRROR}){
    if(Thread.currentThread().isInterrupted())break;
    try{result=FeedVisibility.filter(PublicationPolicy.articleFeed(new JSONObject(DeadlineHttp.get(url,url.equals(address)?8500:3500,3000000))));if(result!=null)break;}catch(Exception ignored){}
   }
   final JSONObject data=result;UI.post(()->{if(request!=generation)return;UI.removeCallbacks(expired);loading=false;failed=data==null;if(data!=null){snapshot=Branding.response(data);context.getSharedPreferences("voetbalhub_editorial",0).edit().putString("last_articles",snapshot.toString()).putLong("last_fetch_at",System.currentTimeMillis()).apply();}notifyListeners();});
  });
 }
}
