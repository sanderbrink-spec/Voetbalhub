package nl.voetbalhub.app;
import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.*;
import android.content.res.ColorStateList;
import android.view.*;
import android.widget.*;
/** Shared native design tokens. Artwork is decorative, never a sporting claim. */
public final class PremiumDesign40 {
 public static final int INK=0xFF050907,SURFACE=0xFF0E2016,GREEN=0xFFA9FF35,WHITE=0xFFF3F8F4,MUTED=0xFFBAC8BE,EDGE=0xFF31523D;
 public static final int TOUCH=48, SPACING=8, RADIUS=16, TITLE=24, BODY=15;
 public static int dp(Context c,float n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
 public static GradientDrawable panel(Context c,int accent,int radius){GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{SURFACE,INK});d.setCornerRadius(dp(c,radius));d.setStroke(dp(c,1),accent);return d;}
 public static void card(View v,int accent){v.setBackground(panel(v.getContext(),accent,RADIUS));v.setClipToOutline(true);v.setElevation(dp(v.getContext(),1));}
 public static void touch(View v){v.setForeground(new RippleDrawable(ColorStateList.valueOf(0x22A9FF35),null,new ColorDrawable(Color.WHITE)));v.setFocusable(true);}
 public static boolean motion(Context c){return android.provider.Settings.Global.getFloat(c.getContentResolver(),android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,1f)>0;}
 public static TextView text(Context c,String value,int size,int color,boolean bold){TextView t=new TextView(c);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);if(bold)t.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));return t;}
 private static final android.util.LruCache<String,Bitmap> ART=new android.util.LruCache<String,Bitmap>(16*1024*1024){@Override protected int sizeOf(String key,Bitmap bitmap){return bitmap.getByteCount();}};
 public static Bitmap artwork(Context c,String id){
  if(id==null||!id.matches("[a-z]+"))return null;
  Bitmap cached=ART.get(id);if(cached!=null)return cached;
  try(java.io.InputStream in=c.getAssets().open("premium40/"+id+".webp")){Bitmap bitmap=EditorialBitmap.read(in,600);ART.put(id,bitmap);return bitmap;}catch(Exception e){return null;}
 }
 public static void menuRow(LinearLayout list, String icon, String title, String detail, Runnable action) {
  Context c = list.getContext();
  LinearLayout row = new LinearLayout(c);
  row.setGravity(Gravity.CENTER_VERTICAL);
  row.setMinimumHeight(dp(c, TOUCH));
  row.setPadding(dp(c, 12), dp(c, SPACING), dp(c, 12), dp(c, SPACING));
  row.setBackground(panel(c, EDGE, RADIUS));
  row.addView(new NavIconView(c, icon, true), new LinearLayout.LayoutParams(dp(c, 24), dp(c, 24)));
  LinearLayout labels = new LinearLayout(c);
  labels.setOrientation(LinearLayout.VERTICAL);
  labels.setPadding(dp(c, 12), 0, dp(c, SPACING), 0);
  labels.addView(text(c, title, BODY, WHITE, true));
  TextView description = text(c, detail, 12, MUTED, false);
  description.setPadding(0, dp(c, 4), 0, 0);
  labels.addView(description);
  row.addView(labels, new LinearLayout.LayoutParams(0, -2, 1));
  if (action != null) {
   row.addView(text(c, "›", 22, GREEN, false));
   touch(row);
   row.setOnClickListener(view -> action.run());
  }
  LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
  params.bottomMargin = dp(c, SPACING);
  list.addView(row, params);
 }

 public static LinearLayout dialogPanel(Context c, String title, String detail) {
  LinearLayout panel = new LinearLayout(c);
  panel.setOrientation(LinearLayout.VERTICAL);
  panel.setPadding(dp(c, 16), dp(c, 16), dp(c, 16), dp(c, 12));
  ImageView logo = new ImageView(c);
  logo.setImageResource(R.drawable.veldio_logo);
  logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
  LinearLayout.LayoutParams logoSize = new LinearLayout.LayoutParams(dp(c, 56), dp(c, 56));
  logoSize.gravity = Gravity.CENTER_HORIZONTAL;
  panel.addView(logo, logoSize);
  TextView heading = text(c, title, TITLE, WHITE, true);
  heading.setGravity(Gravity.CENTER);
  androidx.core.view.ViewCompat.setAccessibilityHeading(heading, true);
  heading.setPadding(0, dp(c, SPACING), 0, dp(c, detail == null ? 16 : SPACING));
  panel.addView(heading, new LinearLayout.LayoutParams(-1, -2));
  if (detail != null) {
   TextView subtitle = text(c, detail, BODY, MUTED, false);
   subtitle.setGravity(Gravity.CENTER);
   subtitle.setPadding(0, 0, 0, dp(c, 16));
   panel.addView(subtitle, new LinearLayout.LayoutParams(-1, -2));
  }
  return panel;
 }

 public static void infoDialog(android.app.Activity activity, String title, String detail, String[][] rows) {
  android.app.Dialog dialog = new android.app.Dialog(activity);
  LinearLayout panel = dialogPanel(activity, title, detail);
  for (String[] row : rows) menuRow(panel, row[0], row[1], row[2], null);
  showDialog(dialog, panel);
 }

 public static void showDialog(android.app.Dialog dialog, LinearLayout panel) {
  Context c = panel.getContext();
  TextView close = text(c, "Sluiten", BODY, INK, true);
  close.setGravity(Gravity.CENTER);
  close.setMinimumHeight(dp(c, TOUCH));
  GradientDrawable fill = new GradientDrawable();
  fill.setColor(GREEN);
  fill.setCornerRadius(dp(c, RADIUS));
  close.setBackground(fill);
  touch(close);
  close.setOnClickListener(view -> dialog.dismiss());
  panel.addView(close, new LinearLayout.LayoutParams(-1, -2));
  ScrollView scroll = new ScrollView(c);
  scroll.setBackground(panel(c, EDGE, RADIUS));
  scroll.setClipToOutline(true);
  scroll.addView(panel);
  dialog.setContentView(scroll);
  dialog.show();
  Window window = dialog.getWindow();
  if (window != null) {
   int width = Math.min(c.getResources().getDisplayMetrics().widthPixels - dp(c, 32), dp(c, 440));
   window.setBackgroundDrawableResource(android.R.color.transparent);
   window.setLayout(width, -2);
  }
 }
 public static void polish(View v){
  if(v instanceof Button){Button b=(Button)v;b.setTextColor(GREEN);b.setAllCaps(false);b.setMinHeight(dp(v.getContext(),TOUCH));card(b,EDGE);touch(b);}
  if(v instanceof EditText){v.setBackground(panel(v.getContext(),EDGE,12));v.setPadding(dp(v.getContext(),12),dp(v.getContext(),10),dp(v.getContext(),12),dp(v.getContext(),10));}
  if(v instanceof ScrollView)v.setBackgroundColor(INK);
  if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)polish(g.getChildAt(i));}
 }
}
