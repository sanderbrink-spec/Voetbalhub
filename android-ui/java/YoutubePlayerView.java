package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Typeface;
import android.net.Uri;
import android.view.Gravity;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Isolated official YouTube embed. This WebView never exposes an app JavaScript bridge. */
public final class YoutubePlayerView extends LinearLayout {
    private final WebView player;
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    public YoutubePlayerView(Activity activity,String id,String title,Runnable close){
        super(activity);if(!id.matches("[A-Za-z0-9_-]{11}"))throw new IllegalArgumentException("Invalid video ID");
        setOrientation(VERTICAL);setBackgroundColor(0xFF000000);setElevation(dp(12));
        LinearLayout toolbar=new LinearLayout(activity);toolbar.setGravity(Gravity.CENTER_VERTICAL);toolbar.setPadding(dp(12),0,dp(4),0);toolbar.setBackgroundColor(0xFF0B1911);
        TextView heading=new TextView(activity);heading.setText("YouTube · "+title);heading.setTextColor(0xFFF3F7F4);heading.setTextSize(12);heading.setSingleLine(true);heading.setEllipsize(android.text.TextUtils.TruncateAt.END);toolbar.addView(heading,new LayoutParams(0,-2,1));
        TextView dismiss=new TextView(activity);dismiss.setText("Sluiten  ×");dismiss.setTextColor(0xFF25F06B);dismiss.setTextSize(13);dismiss.setTypeface(Typeface.DEFAULT,Typeface.BOLD);dismiss.setGravity(Gravity.CENTER);dismiss.setPadding(dp(12),0,dp(12),0);dismiss.setContentDescription("Video sluiten");dismiss.setFocusable(true);dismiss.setOnClickListener(v->close.run());toolbar.addView(dismiss,new LayoutParams(-2,-1));addView(toolbar,new LayoutParams(-1,dp(44)));
        player=new WebView(activity);player.setBackgroundColor(0xFF000000);player.setVerticalScrollBarEnabled(false);player.setHorizontalScrollBarEnabled(false);
        player.getSettings().setJavaScriptEnabled(true);player.getSettings().setDomStorageEnabled(true);player.getSettings().setAllowFileAccess(false);player.getSettings().setAllowContentAccess(false);
        // This view is constructed only after an explicit tap on a video.
        player.getSettings().setMediaPlaybackRequiresUserGesture(false);player.getSettings().setSupportMultipleWindows(false);player.setWebChromeClient(new WebChromeClient());
        player.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return request.isForMainFrame();}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return true;}
        });
        addView(player,new LayoutParams(-1,0,1));
        TextView fallback=new TextView(activity);fallback.setText("Lukt afspelen niet? Open op YouTube  ↗");fallback.setTextColor(PremiumDesign40.GREEN);fallback.setTextSize(12);fallback.setGravity(Gravity.CENTER);fallback.setFocusable(true);fallback.setOnClickListener(v->{try{activity.startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,Uri.parse("https://www.youtube.com/watch?v="+id)));}catch(android.content.ActivityNotFoundException e){android.widget.Toast.makeText(activity,"Geen geschikte app beschikbaar",android.widget.Toast.LENGTH_SHORT).show();}});addView(fallback,new LayoutParams(-1,dp(44)));
        // YouTube requires the embedding app identity as HTTP Referer. A HTTPS base URL
        // supplies it for the iframe; the hostname is the actual Android application ID.
        String origin="https://"+activity.getPackageName().toLowerCase(java.util.Locale.ROOT);
        String src="https://www.youtube.com/embed/"+id+"?autoplay=1&controls=1&playsinline=1&rel=0&fs=0&origin="+Uri.encode(origin);
        String html="<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"referrer\" content=\"strict-origin-when-cross-origin\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; frame-src https://www.youtube.com;\"><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe title=\"YouTube-videospeler\" src=\""+src.replace("&","&amp;")+"\" referrerpolicy=\"strict-origin-when-cross-origin\" allow=\"autoplay; encrypted-media; picture-in-picture\"></iframe></body></html>";
        new android.app.AlertDialog.Builder(activity).setTitle("YouTube-video laden?")
            .setMessage("Bij laden ontvangt Google je IP-adres en apparaatgegevens. YouTube kan cookies of lokale opslag gebruiken voor video, advertenties en meting. Je kunt weigeren en Veldio blijven gebruiken. Sluiten stopt de speler. Zie Privacyverklaring en Juridische informatie via Meer voor Google Privacybeleid en YouTube-voorwaarden. Toestemming geldt alleen voor deze video.")
            .setNegativeButton("Weigeren",(dialog,which)->close.run())
            .setNeutralButton("Privacy",(dialog,which)->{try{activity.startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,Uri.parse("https://voetbalhub-redactie.onrender.com/privacy")));}finally{close.run();}})
            .setPositiveButton("Toestaan",(dialog,which)->{if(isAttachedToWindow())player.loadDataWithBaseURL(origin+"/",html,"text/html","UTF-8",null);})
            .setOnCancelListener(dialog->close.run()).show();
    }
    public void dispose(){player.stopLoading();player.onPause();player.loadUrl("about:blank");removeView(player);player.destroy();}
}
