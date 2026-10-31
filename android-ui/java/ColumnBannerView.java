package nl.voetbalhub.app;
import android.app.Activity;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
/** Veldio editorial banner with the approved upright author portrait. */
public final class ColumnBannerView extends FrameLayout {
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 private TextView text(String value,int size,int color){TextView t=new TextView(getContext());t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);t.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));return t;}
 public ColumnBannerView(Activity activity,Runnable open){this(activity,open,true);}
 public ColumnBannerView(Activity activity,Runnable open,boolean actionable){super(activity);
  GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFF173323,0xFF07100B});bg.setCornerRadius(dp(18));bg.setStroke(dp(1),0xFF45634A);setBackground(bg);setClipToOutline(true);
  BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;Bitmap portrait=BitmapFactory.decodeResource(getResources(),R.drawable.column_sander_brink_clean,options);
  View photo=new View(activity){final Paint paint=new Paint(3);@Override protected void onDraw(Canvas c){super.onDraw(c);float w=getWidth(),h=getHeight();
   paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(dp(1));paint.setColor(0x163AFF7E);c.drawCircle(w*.79f,h*.5f,h*.69f,paint);paint.setStyle(Paint.Style.FILL);
   if(portrait!=null){paint.setColor(Color.WHITE);float ph=Math.min(h,w*.64f),pw=ph*portrait.getWidth()/portrait.getHeight();float left=w*.46f;c.drawBitmap(portrait,null,new RectF(left,0,left+pw,ph),paint);}
   paint.setColor(0xFFA9FF35);c.drawRect(dp(16),dp(15),dp(37),dp(17),paint);
  }};addView(photo,new LayoutParams(-1,-1));
  LinearLayout copy=new LinearLayout(activity);copy.setOrientation(LinearLayout.VERTICAL);copy.setGravity(Gravity.CENTER_VERTICAL);copy.setPadding(dp(17),dp(25),0,dp(16));LayoutParams copyLp=new LayoutParams(-1,-1);copyLp.rightMargin=Math.round(activity.getResources().getDisplayMetrics().widthPixels*.54f);addView(copy,copyLp);
  TextView label=text("VELDIO / COLUMN",9,0xFFA9FF35);label.setLetterSpacing(.13f);copy.addView(label);LinearLayout.LayoutParams titleLp=new LinearLayout.LayoutParams(-1,-2);titleLp.topMargin=dp(9);copy.addView(text("DE DERDE",21,0xFFEEF6F0),titleLp);copy.addView(text("HELFT",36,0xFFA9FF35));
  TextView author=text("Sander Brink",12,0xFFE0EBE3);LinearLayout.LayoutParams authorLp=new LinearLayout.LayoutParams(-1,-2);authorLp.topMargin=dp(5);copy.addView(author,authorLp);
  TextView line=text("Een eigen kijk op voetbal.",10,0xFFACBEB1);line.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));LinearLayout.LayoutParams lineLp=new LinearLayout.LayoutParams(-1,-2);lineLp.topMargin=dp(6);copy.addView(line,lineLp);
  if(actionable){TextView button=text("Lees de column  ↗",11,0xFF08110B);button.setGravity(Gravity.CENTER);button.setPadding(dp(10),dp(7),dp(10),dp(7));GradientDrawable pill=new GradientDrawable();pill.setColor(0xFFA9FF35);pill.setCornerRadius(dp(20));button.setBackground(pill);LinearLayout.LayoutParams action=new LinearLayout.LayoutParams(-2,-2);action.topMargin=dp(10);copy.addView(button,action);button.setOnClickListener(v->open.run());setOnClickListener(v->open.run());}
  setContentDescription("Veldio: De Derde Helft, de column van Sander Brink");setFocusable(actionable);
 }
}
