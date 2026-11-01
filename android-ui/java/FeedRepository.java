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
 private static final java.util.concurrent.ExecutorService NETWORK=Executors.newSingleThreadExecutor();
 private static JSONObject snapshot;
 private static boolean loading,failed;
 private static long lastAttempt;
 private static Context context;
 private static String endpoint="https://voetbalhub-redactie.onrender.com/articles";
 private FeedRepository(){}
 public static void configure(Context c,String address){context=c.getApplicationContext();endpoint=address;}
 public static void subscribe(Context c,Listener listener){
  if(context==null)context=c.getApplicationContext();
  if(snapshot==null)try{snapshot=Branding.response(FeedVisibility.filter(PublicationPolicy.articleFeed(new JSONObject(context.getSharedPreferences("voetbalhub_editorial",0).getString("last_articles","{}")))));}catch(Exception ignored){}
  if(!listeners.contains(listener))listeners.add(listener);listener.changed(snapshot,loading,failed);
 }
 public static void unsubscribe(Listener listener){listeners.remove(listener);}
 private static void notifyListeners(){for(Listener listener:new ArrayList<>(listeners))listener.changed(snapshot,loading,failed);}
 public static void refresh(boolean force){
  if(loading||context==null||!force&&lastAttempt>0&&android.os.SystemClock.elapsedRealtime()-lastAttempt<30000)return;
  lastAttempt=android.os.SystemClock.elapsedRealtime();loading=true;failed=false;notifyListeners();
  final String address=endpoint;NETWORK.execute(()->{
   JSONObject result=null;HttpURLConnection conn=null;
   try{
    conn=(HttpURLConnection)new URL(address).openConnection();conn.setInstanceFollowRedirects(false);conn.setUseCaches(false);conn.setConnectTimeout(15000);conn.setReadTimeout(75000);conn.setRequestProperty("Accept","application/json");conn.setRequestProperty("Cache-Control","no-cache");
    if(conn.getResponseCode()!=200)throw new Exception("Feed unavailable");
    try(InputStream input=conn.getInputStream()){result=FeedVisibility.filter(PublicationPolicy.articleFeed(new JSONObject(new String(BoundedInput.read(input,3000000),java.nio.charset.StandardCharsets.UTF_8))));}
    if(result==null)throw new Exception("Invalid feed");
   }catch(Exception ignored){}finally{if(conn!=null)conn.disconnect();}
   final JSONObject data=result;UI.post(()->{loading=false;failed=data==null;if(data!=null){snapshot=Branding.response(data);context.getSharedPreferences("voetbalhub_editorial",0).edit().putString("last_articles",snapshot.toString()).putLong("last_fetch_at",System.currentTimeMillis()).apply();}notifyListeners();});
  });
 }
}
