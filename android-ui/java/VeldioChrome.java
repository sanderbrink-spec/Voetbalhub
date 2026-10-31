package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Presentation only: original stadium linework and reusable outline icons. */
public final class VeldioChrome {
 private static final int GREEN=0xFF25F06B;
 private static int dp(Activity a,int n){return Math.round(n*a.getResources().getDisplayMetrics().density);}
 private static GradientDrawable panel(int fill,int stroke,int radius){GradientDrawable d=new GradientDrawable();d.setColor(fill);d.setStroke(1,stroke);d.setCornerRadius(radius);return d;}
 public static void install(Activity a){
  LinearLayout header=a.findViewById(R.id.header);header.setBackground(new Stadium());
  header.getLayoutParams().height=dp(a,86);header.setPadding(dp(a,10),dp(a,4),dp(a,10),dp(a,4));
  ImageView logo=a.findViewById(R.id.logo);logo.getLayoutParams().width=dp(a,60);logo.getLayoutParams().height=dp(a,60);logo.setScaleType(ImageView.ScaleType.FIT_CENTER);logo.setContentDescription("Veldio. Alles voetbal. Eén plek.");
  LinearLayout identity=(LinearLayout)((TextView)a.findViewById(R.id.title)).getParent();identity.setPadding(dp(a,8),0,dp(a,3),0);
  TextView title=a.findViewById(R.id.title);title.setTextSize(23);title.setLetterSpacing(.035f);title.setTextColor(0xFFF4FAF6);
  TextView subtitle=a.findViewById(R.id.subtitle);subtitle.setTextSize(11);subtitle.setTextColor(0xFFCAD7CE);subtitle.setPadding(0,dp(a,3),0,0);
  for(int id:new int[]{R.id.search,R.id.settings}){ImageButton button=a.findViewById(id);button.getLayoutParams().width=dp(a,36);button.getLayoutParams().height=dp(a,40);button.setPadding(dp(a,7),dp(a,8),dp(a,7),dp(a,8));button.setBackground(panel(0xC408130C,0xFF41664C,dp(a,18)));button.setImageTintList(null);button.setImageDrawable(new Icon(id==R.id.search?"search":"settings",0xFFE7F3EB));}
  View chips=a.findViewById(R.id.chipsScroll);chips.getLayoutParams().height=dp(a,46);chips.setBackgroundColor(0xFF050D08);
  LinearLayout nav=a.findViewById(R.id.nav);GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0xFF12271B,0xFF060E09});bg.setCornerRadii(new float[]{dp(a,18),dp(a,18),dp(a,18),dp(a,18),0,0,0,0});bg.setStroke(1,0xFF31523D);nav.setBackground(bg);nav.setPadding(dp(a,3),dp(a,5),dp(a,3),dp(a,4));nav.getLayoutParams().height=dp(a,65);
 }
 public static void chip(Activity a,TextView text,String label,boolean active){
  String icon=label.equals("Voor jou")?"home":label.equals("Laatste nieuws")?"news":label.equals("Transfers")?"transfer":label.equals("Eredivisie")?"trophy":label.equals("Video")?"play":"world";
  Icon d=new Icon(icon,active?0xFF04130A:0xFFDEEBE2);d.setBounds(0,0,dp(a,15),dp(a,15));text.setCompoundDrawables(d,null,null,null);text.setCompoundDrawablePadding(dp(a,6));text.setTextSize(12);text.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));text.setBackground(panel(active?GREEN:0xFF0B1710,active?GREEN:0xFF34563F,dp(a,20)));text.setMinHeight(dp(a,38));text.setPadding(dp(a,12),0,dp(a,12),0);
 }
 public static void navigation(Activity a,LinearLayout box,boolean active){box.setBackground(panel(active?0xFF183C25:0x00000000,active?0xFF2A7040:0x00000000,dp(a,13)));box.setContentDescription(((TextView)box.getChildAt(1)).getText());box.setSelected(active);box.setFocusable(true);}
 private static final class Stadium extends Drawable {
  final Paint p=new Paint(3);
  @Override public void draw(Canvas c){Rect b=getBounds();float w=b.width(),h=b.height();c.save();c.translate(b.left,b.top);p.setShader(new LinearGradient(0,0,w,h,new int[]{0xFF030A06,0xFF0B2113,0xFF0A140C},null,Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,p);p.setShader(null);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1);p.setColor(0x303A9951);
   Path roof=new Path();roof.moveTo(w*.42f,0);roof.quadTo(w*.76f,h*.72f,w,h*.18f);c.drawPath(roof,p);roof.reset();roof.moveTo(w*.4f,0);roof.quadTo(w*.77f,h*.5f,w,h*.03f);c.drawPath(roof,p);
   for(int i=0;i<9;i++){float x=w*(.46f+i*.07f);c.drawLine(x,0,x-w*.055f,h*.29f,p);}p.setColor(0x1C73CE7D);for(int i=0;i<4;i++)c.drawOval(w*.55f,h*(.43f+i*.08f),w*1.2f,h*(1.4f+i*.09f),p);
   p.setStyle(Paint.Style.FILL);p.setShader(new LinearGradient(w*.3f,0,w*.85f,0,0xFF030A06,0x00030A06,Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,p);p.setShader(null);p.setColor(0xFF235C35);c.drawRect(0,h-1,w,h,p);c.restore();
  }
  @Override public void setAlpha(int a){} @Override public void setColorFilter(ColorFilter f){} @Override public int getOpacity(){return PixelFormat.OPAQUE;}
 }
 public static final class Icon extends Drawable {
  private final String name;private final int color;private final Paint p=new Paint(3);
  public Icon(String name,int color){this.name=name;this.color=color;}
  @Override public void draw(Canvas c){Rect b=getBounds();c.save();c.translate(b.left,b.top);c.scale(b.width()/24f,b.height()/24f);p.setColor(color);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.8f);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);Path s=new Path();
   switch(name){
    case "search":c.drawCircle(10,10,6,p);c.drawLine(15,15,21,21,p);break;
    case "settings":c.drawCircle(12,12,6,p);c.drawCircle(12,12,2,p);for(int i=0;i<8;i++){double a=i*Math.PI/4;c.drawLine(12+(float)Math.cos(a)*7,12+(float)Math.sin(a)*7,12+(float)Math.cos(a)*9,12+(float)Math.sin(a)*9,p);}break;
    case "home":s.moveTo(3,10);s.lineTo(12,3);s.lineTo(21,10);s.moveTo(5,9);s.lineTo(5,21);s.lineTo(19,21);s.lineTo(19,9);s.moveTo(10,21);s.lineTo(10,15);s.lineTo(14,15);s.lineTo(14,21);c.drawPath(s,p);break;
    case "transfer":c.drawLine(4,7,20,7,p);c.drawLine(16,3,20,7,p);c.drawLine(16,11,20,7,p);c.drawLine(4,17,20,17,p);c.drawLine(8,13,4,17,p);c.drawLine(8,21,4,17,p);break;
    case "trophy":c.drawRoundRect(7,3,17,14,3,3,p);c.drawLine(12,14,12,20,p);c.drawLine(8,21,16,21,p);c.drawArc(3,4,10,11,90,180,false,p);c.drawArc(14,4,21,11,-90,180,false,p);break;
    case "world":c.drawCircle(12,12,9,p);c.drawOval(8,3,16,21,p);c.drawLine(3,12,21,12,p);break;
    case "play":c.drawCircle(12,12,9,p);s.moveTo(10,7);s.lineTo(17,12);s.lineTo(10,17);s.close();c.drawPath(s,p);break;
    default:c.drawRoundRect(5,3,20,21,2,2,p);c.drawLine(2,7,2,20,p);c.drawLine(9,8,16,8,p);c.drawLine(9,12,16,12,p);c.drawLine(9,16,14,16,p);
   }c.restore();
  }
  @Override public void setAlpha(int a){p.setAlpha(a);}@Override public void setColorFilter(ColorFilter f){p.setColorFilter(f);}@Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
 }
}
