package nl.voetbalhub.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** One persistent cursor per article. Views receive a copy of the selected variant. */
final class ArticleArtwork {
    private static final String ORIGIN = "https://voetbalhub-redactie.onrender.com/";
    private static final String METHOD = "approved-article-v69";

    static boolean approved(JSONObject article) {
        if (article == null) return false;
        JSONObject rotation = article.optJSONObject("imageRotation");
        JSONArray variants = article.optJSONArray("imageVariants");
        return rotation != null && METHOD.equals(rotation.optString("method"))
            && variants != null && variants.length() > 0 && variants.length() <= 6
            && article.optString("imageUrl").startsWith(ORIGIN);
    }

    static boolean feedApproved(JSONObject data) {
        return data != null && data.optInt("imagePolicyVersion") == 69 && data.optJSONArray("articles") != null;
    }

    private static SharedPreferences cursors(Context context) {
        return context.getSharedPreferences("veldio_article_artwork", Context.MODE_PRIVATE);
    }

    static JSONObject selected(Context context, JSONObject article) {
        if (!approved(article)) return article;
        JSONArray variants = article.optJSONArray("imageVariants");
        String last = cursors(context).getString(article.optString("id"), "");
        int next = 0;
        for (int i = 0; i < variants.length(); i++) {
            JSONObject candidate = variants.optJSONObject(i);
            if (candidate != null && last.equals(candidate.optString("id"))) {
                next = (i + 1) % variants.length();
                break;
            }
        }
        JSONObject variant = variants.optJSONObject(next);
        if (variant == null || !variant.optString("url").startsWith(ORIGIN)) return article;
        try {
            JSONObject copy = new JSONObject(article.toString());
            copy.put("imageAssetId", variant.getString("id"));
            copy.put("imageUrl", variant.getString("url"));
            copy.put("imageCaption", variant.optString("caption"));
            copy.put("imageCredit", variant.optString("credit"));
            copy.put("imageSource", variant.optString("source"));
            copy.put("imageRights", variant.getString("rights"));
            copy.put("imageLicenseUrl", variant.optString("licenseUrl"));
            copy.put("imageReview", variant.getJSONObject("review"));
            copy.getJSONObject("imageRotation").put("selectedId", variant.getString("id"));
            return copy;
        } catch (JSONException invalid) {
            return article;
        }
    }

    static void recordOpen(Context context, JSONObject article) {
        if (!approved(article)) return;
        String id = article.optString("id");
        String asset = article.optString("imageAssetId");
        cursors(context).edit().putString(id, asset).apply();
        JSONObject rotation = article.optJSONObject("imageRotation");
        Log.i("VeldioArtwork", id + " " + asset + " " + rotation.optString("reason")
            + " " + rotation.optJSONObject("context"));
    }
}
