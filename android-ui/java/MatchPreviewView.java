package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Typeface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;

/** A dedicated reader bound to the exact fixture selected on the home screen. */
public final class MatchPreviewView extends LinearLayout {
    public MatchPreviewView(Activity activity,String snapshot,Runnable back){
        super(activity);
        String checked=snapshot;try{if(!PublicationPolicy.allows(new JSONObject(snapshot)))checked="{}";}catch(Exception ignored){checked="{}";}
        final String approvedSnapshot=checked;setOrientation(VERTICAL);setBackgroundColor(0xFF050807);
        int pad=(int)(16*getResources().getDisplayMetrics().density);
        TextView header=new TextView(activity);String heading="‹  Voorbeschouwing";try{if("report".equals(new JSONObject(approvedSnapshot).getJSONObject("featured").optString("phase")))heading="‹  Wedstrijdverslag";}catch(Exception ignored){}header.setText(heading);header.setTextColor(0xFFF4F7F3);header.setTextSize(18);header.setTypeface(Typeface.DEFAULT,Typeface.BOLD);header.setPadding(pad,pad,pad,pad);header.setOnClickListener(v->back.run());addView(header,new LayoutParams(-1,-2));
        WebView reader=new WebView(activity);reader.setBackgroundColor(0xFF050807);reader.getSettings().setJavaScriptEnabled(true);reader.getSettings().setAllowFileAccess(true);reader.getSettings().setAllowContentAccess(false);reader.getSettings().setDomStorageEnabled(false);
        reader.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){view.evaluateJavascript("window.setData("+JSONObject.quote(approvedSnapshot)+")",null);}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
        });
        addView(reader,new LayoutParams(-1,0,1));reader.loadUrl("file:///android_asset/match-preview.html");
    }
}
