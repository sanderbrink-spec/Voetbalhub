package nl.voetbalhub.app;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Patterns;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import org.json.JSONObject;
/** Session-only form with native HTTPS submission to the editorial API. */
public final class ContactView extends LinearLayout {
 private static final String EMAIL="redactie.veldio@gmail.com";private volatile boolean disposed;private volatile java.net.HttpURLConnection activeConnection;private final Activity activity;private final WebView web;private volatile String draft;private final Runnable back;private final String contactUrl;private final java.util.concurrent.atomic.AtomicBoolean sending=new java.util.concurrent.atomic.AtomicBoolean();
 public ContactView(Activity activity,String draft,Runnable back,String apiUrl){super(activity);this.activity=activity;this.draft=draft==null?"{}":draft;this.back=back;this.contactUrl=apiUrl;setOrientation(VERTICAL);setBackgroundColor(0xFF050C08);web=new WebView(activity);web.setBackgroundColor(0xFF050C08);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowContentAccess(false);web.getSettings().setDomStorageEnabled(false);web.addJavascriptInterface(new Bridge(),"ContactHub");web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView v,String url){if(url.equals("file:///android_asset/contact.html"))web.evaluateJavascript("restoreForm("+JSONObject.quote(ContactView.this.draft)+")",null);}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}});addView(web,new LayoutParams(-1,-1));web.loadUrl("file:///android_asset/contact.html");}
 public String draft(){return draft;}
 private void result(boolean ok,String message){if(disposed||activity.isFinishing())return;web.evaluateJavascript("showResult("+ok+","+JSONObject.quote(message)+")",null);}
 private static String line(JSONObject d,String key,int max)throws Exception{String s=d.optString(key).trim();if(s.length()>max||s.indexOf('\r')>=0||s.indexOf('\n')>=0)throw new Exception("Invalid field");return s;}
 private String[] message(String raw,boolean validate)throws Exception{JSONObject d=new JSONObject(raw);String name=line(d,"name",80),email=line(d,"email",254),subject=line(d,"subject",140),topic=line(d,"topic",50),body=d.optString("message").trim();if(!java.util.Arrays.asList("Vraag over de app","Tip voor de redactie","Samenwerking","Overige vraag").contains(topic))throw new Exception("Invalid topic");if(body.length()>4000||validate&&(name.isEmpty()||!Patterns.EMAIL_ADDRESS.matcher(email).matches()||subject.isEmpty()||body.length()<20))throw new Exception("Invalid message");return new String[]{"[Veldio] "+topic+" · "+subject,"Naam: "+name+"\nE-mailadres: "+email+"\nOnderwerp: "+topic+"\n\n"+body};}
 private void submit(String raw){
  if(disposed||!sending.compareAndSet(false,true))return;
  new Thread(()->{
   boolean ok=false;java.net.HttpURLConnection conn=null;
   try{
    if(raw==null||raw.length()>12000)throw new Exception("Invalid payload");
    message(raw,true);JSONObject data=new JSONObject(raw);
    if(!data.has("website")||!data.getString("website").isEmpty()||!data.optString("requestId").matches("[-a-zA-Z0-9]{16,80}"))throw new Exception("Invalid request");
    java.net.URL base=new java.net.URL(contactUrl);
    if(!"https".equals(base.getProtocol())||base.getUserInfo()!=null)throw new Exception("Invalid endpoint");
    java.net.URL endpoint=new java.net.URL(base,"/contact");
    conn=(java.net.HttpURLConnection)endpoint.openConnection();activeConnection=conn;
    try(DeadlineHttp.Guard deadline=DeadlineHttp.watch(conn,40000)){
    if(disposed)throw new Exception("Contact closed");
    conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(20000);
    conn.setRequestMethod("POST");conn.setRequestProperty("Content-Type","application/json; charset=utf-8");conn.setDoOutput(true);
    byte[] bytes=raw.getBytes(java.nio.charset.StandardCharsets.UTF_8);conn.setFixedLengthStreamingMode(bytes.length);
    try(java.io.OutputStream out=conn.getOutputStream()){out.write(bytes);}
    int status=conn.getResponseCode();
    if(status>=200&&status<300){
     java.io.ByteArrayOutputStream body=new java.io.ByteArrayOutputStream();
     try(java.io.InputStream in=conn.getInputStream()){byte[] buffer=new byte[1024];int n;while((n=in.read(buffer))!=-1){if(body.size()+n>16384)throw new Exception("Response too large");body.write(buffer,0,n);}}
     ok=Boolean.TRUE.equals(new JSONObject(body.toString("UTF-8")).opt("accepted"));
    }
    }
   }catch(Exception ignored){}finally{if(conn!=null)conn.disconnect();activeConnection=null;sending.set(false);}
   final boolean accepted=ok;
   activity.runOnUiThread(()->result(accepted,accepted?"Je bericht is verzonden naar de redactie van Veldio. Bedankt voor je reactie.":"Verzenden is niet gelukt. Probeer het opnieuw."));
  },"veldio-contact").start();
 }
 private void compose(String[] parts){try{Intent mail=new Intent(Intent.ACTION_SENDTO,Uri.parse("mailto:"+EMAIL+"?subject="+Uri.encode(parts[0])+"&body="+Uri.encode(parts[1])));activity.startActivity(mail);result(true,"Je bericht is geopend in je e-mailapp. Verstuur het daar om contact op te nemen.");}catch(Exception e){result(false,"Er kon geen e-mailapp worden geopend. Kopieer je bericht en mail het naar "+EMAIL+".");}}
 private void copy(String text,String notice){ClipboardManager clipboard=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);if(clipboard!=null){clipboard.setPrimaryClip(ClipData.newPlainText("Veldio contact",text));if(!disposed)web.evaluateJavascript("showNotice("+JSONObject.quote(notice)+")",null);}}
 private void legalPage(String path){try{java.net.URL base=new java.net.URL(contactUrl);if(!"https".equals(base.getProtocol()))return;activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(new java.net.URL(base,path).toString())));}catch(Exception ignored){}}
 @Override protected void onDetachedFromWindow(){disposed=true;java.net.HttpURLConnection conn=activeConnection;if(conn!=null)conn.disconnect();web.stopLoading();web.removeJavascriptInterface("ContactHub");web.destroy();super.onDetachedFromWindow();}
 private final class Bridge{
  @JavascriptInterface public void privacy(String unused){activity.runOnUiThread(()->legalPage("/privacy"));}
  @JavascriptInterface public void legal(String unused){activity.runOnUiThread(()->legalPage("/legal"));}
  @JavascriptInterface public void submit(String raw){ContactView.this.submit(raw);}
  @JavascriptInterface public void back(String unused){activity.runOnUiThread(back);}
  @JavascriptInterface public void draft(String raw){if(raw!=null&&raw.length()<12000)try{new JSONObject(raw);draft=raw;}catch(Exception ignored){}}
  @JavascriptInterface public void email(String unused){activity.runOnUiThread(()->ContactView.this.compose(new String[]{"Contact met Veldio",""}));}
  @JavascriptInterface public void copyEmail(String unused){activity.runOnUiThread(()->copy(EMAIL,"E-mailadres gekopieerd."));}
  @JavascriptInterface public void compose(String raw){activity.runOnUiThread(()->{try{String[] parts=message(raw,true);ContactView.this.compose(parts);}catch(Exception e){result(false,"Controleer je naam, e-mailadres, onderwerp en bericht van minimaal 20 tekens.");}});}
  @JavascriptInterface public void copyMessage(String raw){activity.runOnUiThread(()->{try{String[] parts=message(raw,false);copy("Aan: "+EMAIL+"\nOnderwerp: "+parts[0]+"\n\n"+parts[1],"Bericht gekopieerd. Je kunt het in je e-mailapp plakken.");}catch(Exception e){result(false,"Het bericht kon niet worden gekopieerd.");}});}
 }
}
