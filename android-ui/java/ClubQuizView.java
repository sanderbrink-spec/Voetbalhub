package nl.voetbalhub.app;
import android.app.Activity;
import android.webkit.*;
import android.widget.FrameLayout;
import org.json.JSONObject;
/** Dedicated long-read and archive; links use the system browser, never a remote JS page. */
public final class ClubQuizView extends FrameLayout {
 private final WebView web;private boolean ready,disposed;private final Activity activity;

 public ClubQuizView(Activity a,Runnable back){super(a);activity=a;web=new WebView(a);web.setBackgroundColor(0xFF050C08);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(true);web.getSettings().setAllowContentAccess(false);web.getSettings().setAllowFileAccessFromFileURLs(false);web.getSettings().setAllowUniversalAccessFromFileURLs(false);web.addJavascriptInterface(new Object(){@JavascriptInterface public void share(String text){if(text==null||text.length()>2000)return;a.runOnUiThread(()->{if(disposed)return;try{android.content.Intent intent=new android.content.Intent(android.content.Intent.ACTION_SEND);intent.setType("text/plain");intent.putExtra(android.content.Intent.EXTRA_TEXT,text);a.startActivity(android.content.Intent.createChooser(intent,"Quizresultaat delen"));}catch(android.content.ActivityNotFoundException ignored){}});}@JavascriptInterface public void close(){a.runOnUiThread(()->{if(!disposed)back.run();});}},"ClubQuizHub");web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView v,String url){if(url.startsWith("file:///android_asset/clubquiz.html")){ready=true;}}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){String url=r.getUrl().toString();if(r.isForMainFrame()&&r.hasGesture()&&url.startsWith("https://"))try{a.startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,r.getUrl()));}catch(Exception ignored){}return true;}});addView(web,new LayoutParams(-1,-1));web.loadUrl("file:///android_asset/clubquiz.html");}
 public boolean back(){if(!ready||disposed)return false;web.evaluateJavascript("if(!window.quizBack || !window.quizBack()) ClubQuizHub.close();",null);return true;}
 @Override protected void onDetachedFromWindow(){disposed=true;web.removeJavascriptInterface("ClubQuizHub");web.stopLoading();web.loadUrl("about:blank");super.onDetachedFromWindow();}
}
