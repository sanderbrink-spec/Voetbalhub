package nl.voetbalhub.app;
import android.app.Activity;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.*;
import android.view.*;
import android.widget.*;
import java.io.InputStream;
/** Original cup emblems and generated fictional arena; no third-party logo rights assumed. */
public final class CompetitionTile extends android.widget.FrameLayout {
 private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
 public CompetitionTile(Activity a,String name,String code,int accent,Bitmap arena,Runnable action){
  super(a);setMinimumHeight(dp(162));setFocusable(true);setClickable(true);setContentDescription(name+", openen");
  GradientDrawable edge=new GradientDrawable();edge.setColor(0xFF07150D);edge.setCornerRadius(dp(18));edge.setStroke(dp(1),accent);setBackground(edge);setClipToOutline(true);setElevation(dp(4));
  android.widget.ImageView art=new android.widget.ImageView(a);art.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);String id=code.equals("ED")?"news":code.equals("KKD")?"fixtures":code.equals("CL")?"competitions":code.equals("EL")?"column":code.equals("CO")?"quiz":"predictions";art.setImageBitmap(PremiumDesign40.artwork(a,id));art.setColorFilter(accent,android.graphics.PorterDuff.Mode.MULTIPLY);addView(art,new LayoutParams(-1,-1));
  LinearLayout copy=new LinearLayout(a);copy.setOrientation(LinearLayout.VERTICAL);copy.setGravity(Gravity.CENTER);copy.setPadding(dp(8),dp(14),dp(8),dp(13));
  TextView emblem=new TextView(a);emblem.setText(code);emblem.setGravity(Gravity.CENTER);emblem.setTextSize(18);emblem.setTypeface(null,Typeface.BOLD);emblem.setTextColor(Color.WHITE);
  GradientDrawable badge=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{accent,0xFF06110D});badge.setShape(GradientDrawable.OVAL);badge.setStroke(dp(2),0xFFECF7E7);emblem.setBackground(badge);copy.addView(emblem,new LinearLayout.LayoutParams(dp(57),dp(57)));
  TextView title=new TextView(a);title.setText(name);title.setTextSize(15);title.setTextColor(Color.WHITE);title.setTypeface(null,Typeface.BOLD);title.setGravity(Gravity.CENTER);title.setPadding(0,dp(11),0,dp(5));copy.addView(title,new LinearLayout.LayoutParams(-1,-2));
  TextView sub=new TextView(a);sub.setText(name.equals("Eredivisie")?"Stand · Uitslagen · Meer  ›":"Officiële competitiepagina  ›");sub.setGravity(Gravity.CENTER);sub.setTextColor(0xFFDCEAD9);sub.setTextSize(9);copy.addView(sub,new LinearLayout.LayoutParams(-1,-2));addView(copy,new LayoutParams(-1,-2,Gravity.CENTER));
  setForeground(new RippleDrawable(ColorStateList.valueOf(0x66B6FF32),null,new ColorDrawable(Color.WHITE)));setOnClickListener(v->action.run());
  // Native elevation/ripple follows system animator preferences and keyboard activation.
 }
 public static Bitmap artwork(Activity a){try(InputStream in=a.getAssets().open("veldio-arena.webp")){return EditorialBitmap.read(in,720);}catch(Exception e){return null;}}
 private static final class Arena extends View {
  final Bitmap bitmap;final int accent;final Paint p=new Paint(3);Arena(Activity a,Bitmap b,int c){super(a);bitmap=b;accent=c;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
  protected void onDraw(Canvas c){float w=getWidth(),h=getHeight();if(bitmap!=null){p.setAlpha(185);float scale=Math.max(w/bitmap.getWidth(),h/bitmap.getHeight());float bw=bitmap.getWidth()*scale,bh=bitmap.getHeight()*scale;c.drawBitmap(bitmap,null,new RectF(w-bw,(h-bh)/2,w,(h+bh)/2),p);p.setAlpha(255);}c.drawColor((accent&0x00FFFFFF)|0x48000000);p.setShader(new LinearGradient(0,0,0,h,new int[]{0x22010703,0x66010703,0xF5010703},null,Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,p);p.setShader(null);}
 }
}
