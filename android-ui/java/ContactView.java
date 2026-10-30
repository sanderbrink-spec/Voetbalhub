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
/** Session-only form. The user reviews and sends the message in their own mail app. */
public final class ContactView extends LinearLayout {
 private static final String EMAIL="voetbalhub@gmail.com";private final Activity activity;private final WebView web;private volatile String draft;private final Runnable back;
 public ContactView(Activity activity,String draft,Runnable back){super(activity);this.activity=activity;this.draft=draft==null?"{}":draft;this.back=back;setOrientation(VERTICAL);setBackgroundColor(0xFF050C08);web=new WebView(activity);web.setBackgroundColor(0xFF050C08);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowContentAccess(false);web.getSettings().setDomStorageEnabled(false);web.addJavascriptInterface(new Bridge(),"ContactHub");web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView v,String url){if(url.equals("file:///android_asset/contact.html"))web.evaluateJavascript("restoreForm("+JSONObject.quote(ContactView.this.draft)+")",null);}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}});addView(web,new LayoutParams(-1,-1));web.loadUrl("file:///android_asset/contact.html");}
 public String draft(){return draft;}
 private void result(boolean ok,String message){web.evaluateJavascript("showResult("+ok+","+JSONObject.quote(message)+")",null);}
 private static String line(JSONObject d,String key,int max)throws Exception{String s=d.optString(key).trim();if(s.length()>max||s.indexOf('\r')>=0||s.indexOf('\n')>=0)throw new Exception("Invalid field");return s;}
 private String[] message(String raw,boolean validate)throws Exception{JSONObject d=new JSONObject(raw);String name=line(d,"name",80),email=line(d,"email",254),subject=line(d,"subject",140),topic=line(d,"topic",50),body=d.optString("message").trim();if(!java.util.Arrays.asList("Vraag over de app","Tip voor de redactie","Samenwerking","Overige vraag").contains(topic))throw new Exception("Invalid topic");if(body.length()>4000||validate&&(name.isEmpty()||!Patterns.EMAIL_ADDRESS.matcher(email).matches()||subject.isEmpty()||body.length()<20))throw new Exception("Invalid message");return new String[]{"[VoetbalHub] "+topic+" · "+subject,"Naam: "+name+"\nE-mailadres: "+email+"\nOnderwerp: "+topic+"\n\n"+body};}
 private void compose(String[] parts){try{Intent mail=new Intent(Intent.ACTION_SENDTO,Uri.parse("mailto:"+EMAIL+"?subject="+Uri.encode(parts[0])+"&body="+Uri.encode(parts[1])));activity.startActivity(mail);result(true,"Je bericht is geopend in je e-mailapp. Verstuur het daar om contact op te nemen.");}catch(Exception e){result(false,"Er kon geen e-mailapp worden geopend. Kopieer je bericht en mail het naar "+EMAIL+".");}}
 private void copy(String text,String notice){ClipboardManager clipboard=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);if(clipboard!=null){clipboard.setPrimaryClip(ClipData.newPlainText("VoetbalHub contact",text));result(true,notice);}}
 private final class Bridge{
  @JavascriptInterface public void back(String unused){activity.runOnUiThread(back);}
  @JavascriptInterface public void draft(String raw){if(raw!=null&&raw.length()<12000)try{new JSONObject(raw);draft=raw;}catch(Exception ignored){}}
  @JavascriptInterface public void email(String unused){activity.runOnUiThread(()->ContactView.this.compose(new String[]{"Contact met VoetbalHub",""}));}
  @JavascriptInterface public void copyEmail(String unused){activity.runOnUiThread(()->copy(EMAIL,"E-mailadres gekopieerd."));}
  @JavascriptInterface public void compose(String raw){activity.runOnUiThread(()->{try{String[] parts=message(raw,true);ContactView.this.compose(parts);}catch(Exception e){result(false,"Controleer je naam, e-mailadres, onderwerp en bericht van minimaal 20 tekens.");}});}
  @JavascriptInterface public void copyMessage(String raw){activity.runOnUiThread(()->{try{String[] parts=message(raw,false);copy("Aan: "+EMAIL+"\nOnderwerp: "+parts[0]+"\n\n"+parts[1],"Bericht gekopieerd. Je kunt het in je e-mailapp plakken.");}catch(Exception e){result(false,"Het bericht kon niet worden gekopieerd.");}});}
 }
}
