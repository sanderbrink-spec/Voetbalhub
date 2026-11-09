package nl.voetbalhub.app;

import android.graphics.*;
import android.graphics.drawable.Drawable;
import org.json.JSONObject;

/** Original text-free, club-colour editorial fallback. Never implies an actual match photo. */
public final class TopicArtwork39 extends Drawable {
 private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final String home,away;
 private final int seed;
 private static final String[] CLUBS={"ADO Den Haag","SC Heerenveen","Sparta Rotterdam","FC Groningen","FC Twente","FC Utrecht","Feyenoord","Ajax","PSV","AZ","NEC","PEC Zwolle","Go Ahead Eagles","Heracles Almelo","FC Emmen"};
 public TopicArtwork39(JSONObject article){
  String headline=article.optString("headline","Veldio");
  JSONObject match=article.optJSONObject("match");
  String first=match==null?"":match.optString("homeTeam","");
  String second=match==null?"":match.optString("awayTeam","");
  if(first.isEmpty()||second.isEmpty()){
   for(String club:CLUBS)if(headline.toLowerCase(java.util.Locale.ROOT).contains(club.toLowerCase(java.util.Locale.ROOT))){
    if(first.isEmpty())first=club;else if(second.isEmpty()&&!club.equalsIgnoreCase(first))second=club;
   }
  }
  home=first;away=second;seed=article.optString("id",headline).hashCode();
 }
 private static int[] colours(String name){
  String club=name.toLowerCase(java.util.Locale.ROOT);
  if(club.contains("heerenveen"))return new int[]{0xFF205AA6,0xFFF0F5FC};
  if(club.contains("feyenoord"))return new int[]{0xFFCC2435,0xFFF5F5F0};
  if(club.contains("twente"))return new int[]{0xFFCF2637,0xFFFAF5F0};
  if(club.contains("ajax"))return new int[]{0xFFF7F7F3,0xFFD02538};
  if(club.contains("den haag"))return new int[]{0xFFF2D32E,0xFF22854A};
  if(club.contains("sparta"))return new int[]{0xFFFCFCF7,0xFFCB2437};
  if(club.contains("groningen"))return new int[]{0xFF19894F,0xFFF3F5ED};
  if(club.contains("psv"))return new int[]{0xFFC52236,0xFFF3F2E8};
  if(club.equals("az"))return new int[]{0xFFC82036,0xFF161E24};
  if(club.contains("utrecht"))return new int[]{0xFFD32736,0xFFF3F0E9};
  return new int[]{0xFF66B887,0xFFECF5EB};
 }
 private void scarf(Canvas c,float cx,float cy,float width,float height,int angle,int[] colors){
  c.save();c.rotate(angle,cx,cy);
  p.setStyle(Paint.Style.FILL);p.setShader(null);p.setColor(0xBB000000);
  c.drawRoundRect(cx-width/2+width*.025f,cy-height/2+height*.16f,cx+width/2+width*.025f,cy+height/2+height*.16f,height*.22f,height*.22f,p);
  p.setColor(colors[0]);c.drawRoundRect(cx-width/2,cy-height/2,cx+width/2,cy+height/2,height*.18f,height*.18f,p);
  p.setColor(colors[1]);for(int i=1;i<=4;i++){
   float x=cx-width/2+width*i/5f;
   c.drawRect(x-width*.045f,cy-height/2,x+width*.015f,cy+height/2,p);
  }
  p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(Math.max(1f,height*.045f));p.setColor(0x99E9FFE1);
  c.drawRoundRect(cx-width/2,cy-height/2,cx+width/2,cy+height/2,height*.18f,height*.18f,p);p.setStyle(Paint.Style.FILL);c.restore();
 }
 @Override public void draw(Canvas c){
  Rect b=getBounds();float w=b.width(),h=b.height();if(w<=0||h<=0)return;
  c.save();c.translate(b.left,b.top);
  p.setStyle(Paint.Style.FILL);p.setShader(new LinearGradient(0,0,w,h,0xFF041009,0xFF18372B,Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,p);p.setShader(null);
  p.setStyle(Paint.Style.STROKE);p.setColor(0x345ED398);p.setStrokeWidth(Math.max(1f,w*.004f));
  c.drawOval(-w*.25f,h*.25f,w*.5f,h*.95f,p);c.drawOval(w*.5f,h*.1f,w*1.25f,h*.82f,p);
  c.drawLine(w*.5f,0,w*.5f,h,p);c.drawCircle(w*.5f,h*.5f,h*.25f,p);p.setStyle(Paint.Style.FILL);
  if(home.isEmpty()&&away.isEmpty()){
   p.setColor(0xFFD7EEE0);c.drawCircle(w*.5f,h*.52f,h*.14f,p);
   p.setColor(0xFF3D8E60);c.drawCircle(w*.5f,h*.52f,h*.06f,p);
  }else{
   scarf(c,w*.31f,h*.51f,w*.40f,h*.21f,-16,colours(home));
   scarf(c,w*.69f,h*.51f,w*.40f,h*.21f,16,colours(away.isEmpty()?home:away));
  }
  c.restore();
 }
 @Override public void setAlpha(int alpha){p.setAlpha(alpha);}
 @Override public void setColorFilter(ColorFilter filter){p.setColorFilter(filter);}
 @Override public int getOpacity(){return PixelFormat.OPAQUE;}
 public static Bitmap bitmap(JSONObject article,int width){Bitmap b=Bitmap.createBitmap(width,width*9/16,Bitmap.Config.ARGB_8888);TopicArtwork39 artwork=new TopicArtwork39(article);artwork.setBounds(0,0,b.getWidth(),b.getHeight());artwork.draw(new Canvas(b));return b;}
}
