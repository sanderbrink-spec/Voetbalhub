package nl.voetbalhub.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.webkit.WebView;

/** Local disclosure, usable without a network connection or a tracking SDK. */
public final class PrivacyInfo {
    private PrivacyInfo() {}
    public static void show(Activity activity) {
        WebView view = new WebView(activity);
        view.getSettings().setJavaScriptEnabled(false);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setBlockNetworkLoads(true);
        view.loadUrl("file:///android_asset/privacy.html");
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle("Privacy en gegevens")
            .setView(view).setPositiveButton("Sluiten", null).create();
        dialog.setOnDismissListener(d -> view.destroy());
        dialog.show();
    }
}
