package nl.voetbalhub.app;
import android.content.Context;
import android.os.*;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
/** Published, reviewed stadium archive with a packaged first edition. Never blanks on failure. */
public final class StadiumRepository {
 public interface Listener {void changed(JSONObject snapshot);}
 private static final Handler UI=new Handler(Looper.getMainLooper());
 private static final List<Listener> listeners=new ArrayList<>();
 private static final ExecutorService NETWORK=Executors.newSingleThreadExecutor();
 private static JSONObject snapshot;private static boolean busy;private static long attempted;
 private static final String URL="https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/stadium/current.json";
 private StadiumRepository(){}
 public static JSONObject get(Context c){if(snapshot==null){try{snapshot=checked(new JSONObject(c.getSharedPreferences("stadium",0).getString("snapshot","{}")));}catch(Exception ignored){}if(snapshot==null)try(InputStream in=c.getAssets().open("stadium-bootstrap.json")){snapshot=checked(new JSONObject(new String(BoundedInput.read(in,1500000),java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception ignored){}}return snapshot==null?new JSONObject():snapshot;}
 public static void subscribe(Context c,Listener l){if(!listeners.contains(l))listeners.add(l);l.changed(get(c));refresh(c);}
 public static void unsubscribe(Listener l){listeners.remove(l);}
 public static void refresh(Context c){if(busy||attempted>0&&android.os.SystemClock.elapsedRealtime()-attempted<300000)return;busy=true;attempted=android.os.SystemClock.elapsedRealtime();Context app=c.getApplicationContext();NETWORK.execute(()->{JSONObject result=null;try{result=checked(new JSONObject(DeadlineHttp.get(URL,7000,1500000)));}catch(Exception ignored){}final JSONObject data=result;UI.post(()->{busy=false;if(data!=null){snapshot=data;app.getSharedPreferences("stadium",0).edit().putString("snapshot",data.toString()).apply();for(Listener l:new ArrayList<>(listeners))l.changed(data);}});});}
 static JSONObject checked(JSONObject data) throws Exception {
  if(data.optInt("schemaVersion")!=1)return null;JSONArray rows=data.optJSONArray("articles");if(rows==null||rows.length()==0||rows.length()>300)return null;
  HashSet<String> ids=new HashSet<>();boolean current=false;
  for(int i=0;i<rows.length();i++){
   JSONObject a=rows.getJSONObject(i);String id=a.getString("id");if(!id.matches("[a-z0-9-]{1,80}")||!ids.add(id)||!"published".equals(a.optString("status")))return null;
   if(id.equals(data.optString("current")))current=true;JSONArray sections=a.getJSONArray("sections"),sources=a.getJSONArray("sources"),facts=a.getJSONArray("trivia");if(sections.length()<6||facts.length()<5||sources.length()<3)return null;
   StringBuilder body=new StringBuilder();for(int n=0;n<sections.length();n++){JSONObject s=sections.getJSONObject(n);body.append(s.getString("heading")).append('\n').append(s.getString("text")).append('\n');if(s.getJSONArray("sources").length()==0)return null;}
   JSONObject review=a.getJSONObject("review");byte[] hash=java.security.MessageDigest.getInstance("SHA-256").digest(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));StringBuilder hex=new StringBuilder();for(byte b:hash)hex.append(String.format(java.util.Locale.ROOT,"%02x",b));
   if(!review.optBoolean("approved")||!hex.toString().equals(review.optString("bodyHash"))||a.optInt("wordCount")<800||a.optInt("wordCount")>1200)return null;
   JSONObject image=a.getJSONObject("image");if(!image.optBoolean("approved")||image.optInt("width")<1280||image.optInt("height")<720||!EditorialPhotos.safeAsset("news-photos/"+image.optString("file"))||!image.optString("licenseUrl").startsWith("https://creativecommons.org/"))return null;
  }return current?data:null;
 }
}
