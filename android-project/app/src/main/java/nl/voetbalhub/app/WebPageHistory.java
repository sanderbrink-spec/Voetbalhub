package nl.voetbalhub.app;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
/** Only local page state is retained. Article and account data never enter navigation history. */
public final class WebPageHistory {
 private final WebView web;private String state="";private int depth;
 public WebPageHistory(WebView web){this.web=web;web.addJavascriptInterface(this,"PageHistory");}
 @JavascriptInterface public void update(String raw){if(raw==null||raw.length()>30000)return;try{JSONObject parsed=new JSONObject(raw);int count=parsed.getJSONArray("entries").length();if(count>40||parsed.optJSONObject("current")==null)return;web.post(()->{state=raw;depth=count;});}catch(Exception ignored){}}
 public boolean back(){if(depth<1)return false;web.evaluateJavascript("window.pageBack&&window.pageBack()",null);return true;}
 public String snapshot(){try{return new JSONObject(state).put("scrollY",web.getScrollY()/web.getResources().getDisplayMetrics().density).toString();}catch(Exception ignored){return "";}}
 public void restore(String raw){if(raw!=null&&!raw.isEmpty())web.evaluateJavascript("window.restorePageState&&window.restorePageState("+JSONObject.quote(raw)+")",null);}
}
