package nl.voetbalhub.app;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;

/** All reviewed fixture illustrations are accessible without needing a matching news article. */
public final class MatchArtworkGallery68 {
 private MatchArtworkGallery68() {}
 private static final String ORIGIN = "https://voetbalhub-redactie.onrender.com/match-rotations65/";
 private static final String[][] COVERS = {
  {"FC Groningen – Ajax", "veldio-fc-groningen-ajax-01.webp"},
  {"PSV – FC Twente", "veldio-psv-fc-twente-01.webp"},
  {"Feyenoord – AZ", "veldio-feyenoord-az-01.webp"},
  {"FC Utrecht – sc Heerenveen", "veldio-fc-utrecht-sc-heerenveen-01.webp"},
  {"Go Ahead Eagles – NEC", "veldio-go-ahead-eagles-nec-01.webp"},
  {"Ajax – PSV", "veldio-ajax-psv-01.webp"},
  {"AZ – FC Groningen", "veldio-az-fc-groningen-01.webp"},
  {"FC Twente – Feyenoord", "veldio-fc-twente-feyenoord-01.webp"},
  {"sc Heerenveen – PEC Zwolle", "veldio-sc-heerenveen-pec-zwolle-01.webp"},
  {"NEC – FC Utrecht", "veldio-nec-fc-utrecht-01.webp"}
 };
 private static int dp(Activity a, int value) {
  return Math.round(value * a.getResources().getDisplayMetrics().density);
 }
 private static TextView label(Activity a, String value, int size, int color, boolean bold) {
  TextView text = new TextView(a);
  text.setText(value);
  text.setTextSize(size);
  text.setTextColor(color);
  if (bold) text.setTypeface(null, android.graphics.Typeface.BOLD);
  return text;
 }
 private static void bind(Activity a, ImageView image, String[] cover) {
  image.setContentDescription("Originele Veldio AI-illustratie: " + cover[0]);
  try {
   JSONObject record = new JSONObject()
    .put("headline", cover[0])
    .put("imageRights", "cleared")
    .put("imageUrl", ORIGIN + cover[1])
    .put("imageReview", new JSONObject().put("generated", true).put("method", "approved-library49"));
   EditorialPhotos.bind(a, image, record, 850);
  } catch (Exception ignored) {
   image.setContentDescription("Beeld tijdelijk niet beschikbaar: " + cover[0]);
  }
 }
 private static LinearLayout tile(Activity a, String[] cover, boolean wide, Runnable click) {
  LinearLayout tile = new LinearLayout(a);
  tile.setOrientation(LinearLayout.VERTICAL);
  tile.setPadding(dp(a, 5), dp(a, 5), dp(a, 5), dp(a, 8));
  ImageView image = new ImageView(a);
  image.setScaleType(ImageView.ScaleType.CENTER_CROP);
  image.setBackgroundColor(0xFF132219);
  int width = wide ? 290 : 228, height = wide ? 163 : 128;
  tile.addView(image, new LinearLayout.LayoutParams(dp(a, width), dp(a, height)));
  bind(a, image, cover);
  TextView name = label(a, cover[0], 14, 0xFFF2F7F2, true);
  name.setPadding(dp(a, 3), dp(a, 8), 0, dp(a, 3));
  tile.addView(name);
  TextView disclaimer = label(a, "AI-illustratie, geen wedstrijdfoto", 11, 0xFFACC2B4, false);
  disclaimer.setPadding(dp(a, 3), 0, 0, 0);
  tile.addView(disclaimer);
  if (click != null) {
   tile.setContentDescription("Bekijk alle 10 Veldio wedstrijdbeelden, vanaf " + cover[0]);
   tile.setOnClickListener(v -> click.run());
   tile.setFocusable(true);
  }
  return tile;
 }
 public static View preview(Activity a, boolean heading) {
  LinearLayout root = new LinearLayout(a);
  root.setOrientation(LinearLayout.VERTICAL);
  root.setPadding(dp(a, 5), dp(a, 8), dp(a, 5), dp(a, 14));
  if (heading) {
   LinearLayout header = new LinearLayout(a);
   header.setGravity(Gravity.CENTER_VERTICAL);
   TextView title = label(a, "Nieuwe Veldio wedstrijdbeelden", 19, 0xFFF2F7F2, true);
   header.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
   TextView action = label(a, "ALLE 10", 12, 0xFFA9FF35, true);
   action.setGravity(Gravity.CENTER);
   action.setMinWidth(dp(a, 68));
   action.setMinHeight(dp(a, 48));
   action.setOnClickListener(v -> open(a));
   header.addView(action);
   root.addView(header);
  }
  TextView note = label(a, "Originele illustraties. Wedstrijdbeelden worden alleen gebruikt bij passend nieuws.", 11, 0xFFACC2B4, false);
  note.setPadding(dp(a, 3), dp(a, 3), 0, dp(a, 6));
  root.addView(note);
  HorizontalScrollView scroll = new HorizontalScrollView(a);
  scroll.setHorizontalScrollBarEnabled(false);
  LinearLayout strip = new LinearLayout(a);
  strip.setOrientation(LinearLayout.HORIZONTAL);
  for (String[] cover : COVERS) strip.addView(tile(a, cover, false, () -> open(a)));
  scroll.addView(strip);
  root.addView(scroll);
  return root;
 }
 public static void open(Activity a) {
  if (a.isFinishing()) return;
  final Dialog dialog = new Dialog(a);
  LinearLayout page = new LinearLayout(a);
  page.setOrientation(LinearLayout.VERTICAL);
  page.setBackgroundColor(0xFF07100B);
  page.setPadding(dp(a, 12), dp(a, 10), dp(a, 12), dp(a, 10));
  LinearLayout header = new LinearLayout(a);
  header.setGravity(Gravity.CENTER_VERTICAL);
  TextView title = label(a, "Veldio · 10 wedstrijdbeelden", 19, 0xFFF2F7F2, true);
  header.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
  TextView close = label(a, "SLUITEN", 12, 0xFFA9FF35, true);
  close.setGravity(Gravity.CENTER);
  close.setMinWidth(dp(a, 75));
  close.setMinHeight(dp(a, 48));
  close.setOnClickListener(v -> dialog.dismiss());
  header.addView(close);
  page.addView(header);
  TextView note = label(a, "Originele AI-illustraties, geen foto's van gespeelde wedstrijden.", 12, 0xFFACC2B4, false);
  note.setPadding(0, 0, 0, dp(a, 10));
  page.addView(note);
  ScrollView scroll = new ScrollView(a);
  LinearLayout list = new LinearLayout(a);
  list.setOrientation(LinearLayout.VERTICAL);
  for (String[] cover : COVERS) {
   LinearLayout entry = tile(a, cover, true, null);
   list.addView(entry, new LinearLayout.LayoutParams(-1, -2));
  }
  scroll.addView(list);
  page.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
  dialog.setContentView(page);
  dialog.show();
  Window w = dialog.getWindow();
  if (w != null) {
   w.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
   w.setBackgroundDrawableResource(android.R.color.transparent);
  }
 }
}
