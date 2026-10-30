package nl.voetbalhub.app;
import android.app.Activity;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
/** Landscape column identity with a clean author portrait and native, readable typography. */
public final class ColumnBannerView extends FrameLayout {
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 private TextView text(String value,int size,int color){TextView t=new TextView(getContext());t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);t.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));return t;}
 public ColumnBannerView(Activity activity,Runnable open){this(activity,open,true);}
 public ColumnBannerView(Activity activity,Runnable open,boolean actionable){super(activity);GradientDrawable bg=new GradientDrawable();bg.setColor(0xFF09180F);bg.setCornerRadius(dp(15));bg.setStroke(dp(1),0xFF294534);setBackground(bg);setClipToOutline(true);
  BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;Bitmap portrait=BitmapFactory.decodeResource(getResources(),R.drawable.column_sander_brink_clean,options);
  View photo=new View(activity){final Paint paint=new Paint(3);@Override protected void onDraw(Canvas c){super.onDraw(c);float w=getWidth(),h=getHeight();if(portrait!=null){float scale=h*1.28f/portrait.getHeight();float pw=portrait.getWidth()*scale,ph=portrait.getHeight()*scale;float right=w+pw*.12f;c.drawBitmap(portrait,null,new RectF(right-pw,dp(3),right,dp(3)+ph),paint);}paint.setShader(new LinearGradient(w*.25f,0,w*.68f,0,new int[]{0xFF09180F,0xE609180F,0x0009180F},new float[]{0,.45f,1},Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,paint);paint.setShader(null);}};
  addView(photo,new LayoutParams(-1,-1));LinearLayout copy=new LinearLayout(activity);copy.setOrientation(LinearLayout.VERTICAL);copy.setGravity(Gravity.CENTER_VERTICAL);copy.setPadding(dp(15),dp(14),dp(8),dp(14));LayoutParams copyLp=new LayoutParams(-1,-1);copyLp.rightMargin=dp(132);addView(copy,copyLp);
  copy.addView(text("DE DERDE",23,0xFFF5F8F5));copy.addView(text("HELFT",34,0xFF25F06B));TextView author=text("Door Sander Brink",12,0xFF25F06B);copy.addView(author);TextView line=text("Een eigen kijk op voetbal.",11,0xFFD9E3DC);LinearLayout.LayoutParams lineLp=new LinearLayout.LayoutParams(-1,-2);lineLp.topMargin=dp(7);copy.addView(line,lineLp);
  TextView button=text("Lees de column  →",12,0xFF06120B);button.setGravity(Gravity.CENTER);button.setPadding(dp(10),dp(8),dp(10),dp(8));GradientDrawable pill=new GradientDrawable();pill.setColor(0xFF25F06B);pill.setCornerRadius(dp(20));button.setBackground(pill);LinearLayout.LayoutParams action=new LinearLayout.LayoutParams(-2,-2);action.topMargin=dp(11);copy.addView(button,action);if(actionable){button.setOnClickListener(v->open.run());setOnClickListener(v->open.run());}else button.setVisibility(GONE);setContentDescription("De Derde Helft, de column van Sander Brink. Lees de column.");setFocusable(actionable);
 }
}
