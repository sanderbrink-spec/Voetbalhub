package nl.voetbalhub.app;
import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.*;
import android.content.res.ColorStateList;
import android.view.*;
import android.widget.*;
/** Shared native design tokens. Artwork is decorative, never a sporting claim. */
public final class PremiumDesign40 {
 public static final int INK=0xFF020805,SURFACE=0xFF0C2115,GREEN=0xFFA9FF35,WHITE=0xFFF3F8F4,MUTED=0xFFB0C6B7,EDGE=0xFF3C6549;
 public static int dp(Context c,float n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
 public static GradientDrawable panel(Context c,int accent,int radius){GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFF153321,INK});d.setCornerRadius(dp(c,radius));d.setStroke(dp(c,1),accent);return d;}
 public static void card(View v,int accent){v.setBackground(panel(v.getContext(),accent,18));v.setClipToOutline(true);v.setElevation(dp(v.getContext(),3));}
 public static void touch(View v){v.setForeground(new RippleDrawable(ColorStateList.valueOf(0x44A9FF35),null,new ColorDrawable(Color.WHITE)));v.setFocusable(true);}
 public static boolean motion(Context c){return android.provider.Settings.Global.getFloat(c.getContentResolver(),android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,1f)>0;}
 public static TextView text(Context c,String value,int size,int color,boolean bold){TextView t=new TextView(c);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);if(bold)t.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));return t;}
 private static final android.util.LruCache<String,Bitmap> ART=new android.util.LruCache<String,Bitmap>(16*1024*1024){@Override protected int sizeOf(String key,Bitmap bitmap){return bitmap.getByteCount();}};
 public static Bitmap artwork(Context c,String id){
  if(id==null||!id.matches("[a-z]+"))return null;
  Bitmap cached=ART.get(id);if(cached!=null)return cached;
  try(java.io.InputStream in=c.getAssets().open("premium40/"+id+".webp")){Bitmap bitmap=EditorialBitmap.read(in,600);ART.put(id,bitmap);return bitmap;}catch(Exception e){return null;}
 }
 public static void polish(View v){
  if(v instanceof Button){Button b=(Button)v;b.setTextColor(GREEN);b.setAllCaps(false);b.setMinHeight(dp(v.getContext(),48));card(b,EDGE);touch(b);}
  if(v instanceof EditText){v.setBackground(panel(v.getContext(),EDGE,12));v.setPadding(dp(v.getContext(),12),dp(v.getContext(),10),dp(v.getContext(),12),dp(v.getContext(),10));}
  if(v instanceof ScrollView)v.setBackgroundColor(INK);
  if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)polish(g.getChildAt(i));}
 }
}
