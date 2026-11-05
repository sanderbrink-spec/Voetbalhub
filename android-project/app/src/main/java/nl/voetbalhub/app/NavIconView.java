package nl.voetbalhub.app;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;
/** Consistent outline navigation icons, independent of the phone's emoji font. */
public final class NavIconView extends View {
 private final String name;private final int color;private final Paint p=new Paint(3);
 public NavIconView(Context c,String name,boolean active){super(c);this.name=name;color=active?PremiumDesign40.GREEN:PremiumDesign40.MUTED;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}

 private android.graphics.Path customPath(){String d=null;
if("Home".equals(name))d="M2 11L12 3L22 11 M5 9V21H19V9 M10 21V15H14V21";
if("Nieuws".equals(name))d="M5 3H19V21H5Z M8 6H16V10H8Z M8 13H16 M8 16H16 M8 19H13 M2 6V19Q2 21 5 21";
if("Wedstrijden".equals(name))d="M4 5H20V21H4Z M4 10H20 M8 2V7 M16 2V7 M8 14H9 M12 14H13 M16 14H17 M8 18H9 M12 18H13";
if("Competities".equals(name))d="M7 3H17V9Q17 15 12 15Q7 15 7 9Z M7 5H3V8Q3 12 8 12 M17 5H21V8Q21 12 16 12 M12 15V20 M8 21H16";
if("Voorspellen".equals(name))d="M13 4A8 8 0 1 0 20 13 M11 8L14 10L13 14H9L8 10Z M8 10L5 8 M9 14L7 18 M13 14L16 17 M15 6L19 2 M16 2H20V6";
if("Club Quiz".equals(name))d="M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3 M9 9Q9 6 12 6Q15 6 15 9Q15 11 12 12V14 M12 17H12.01";
if("Clubquiz".equals(name))d="M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3 M9 9Q9 6 12 6Q15 6 15 9Q15 11 12 12V14 M12 17H12.01";
if("Stadions".equals(name))d="M2 10Q12 2 22 10V17Q12 23 2 17Z M2 10Q12 16 22 10 M7 13V20 M17 13V20 M3 7V3 M21 7V3 M8 7V4 M16 7V4 M9 16H15V19H9Z";
if("Stadion van de Week".equals(name))d="M2 10Q12 2 22 10V17Q12 23 2 17Z M2 10Q12 16 22 10 M7 13V20 M17 13V20 M3 7V3 M21 7V3 M8 7V4 M16 7V4 M9 16H15V19H9Z";
if("Column".equals(name))d="M13 4H4V21H20V12 M8 8H11 M8 12H10 M8 17H13 M13 13L14 9L20 3L23 6L17 12Z M18 5L21 8";
if("De Derde Helft".equals(name))d="M13 4H4V21H20V12 M8 8H11 M8 12H10 M8 17H13 M13 13L14 9L20 3L23 6L17 12Z M18 5L21 8";
if("Video's".equals(name))d="M3 5H21V19H3Z M10 8L16 12L10 16Z";
if("Video’s".equals(name))d="M3 5H21V19H3Z M10 8L16 12L10 16Z";
if("Standen".equals(name))d="M3 21H22 M5 17H8V21H5Z M11 11H14V21H11Z M17 4H20V21H17Z M4 10L10 6L14 8L20 2";
if("Clubs".equals(name)||"Mijn Club".equals(name))d="M8 3Q12 6 16 3L22 7L19 12L17 11V21H7V11L5 12L2 7Z M10 9H14";
if("Mijn Clubs".equals(name))d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8Z";
if("Meldingen".equals(name))d="M5 17H19L17 14V9Q17 4 12 4Q7 4 7 9V14Z M10 20Q12 23 14 20 M12 2V4";
return d==null?null:androidx.core.graphics.PathParser.createPathFromPathData(d);}
 @Override protected void onDraw(Canvas c){super.onDraw(c);float size=Math.min(getWidth(),getHeight())*.83f;c.save();c.translate((getWidth()-size)/2,(getHeight()-size)/2);c.scale(size/24f,size/24f);p.setColor(color);p.setStrokeWidth(1.8f);p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);Path s=new Path();Path custom=customPath();if(custom!=null){p.setStrokeWidth(1.65f);c.drawPath(custom,p);c.restore();return;}
  if("Zoeken".equals(name)){c.drawCircle(10,10,6,p);c.drawLine(14.5f,14.5f,21,21,p);}
  else if("Instellingen".equals(name)){c.drawCircle(12,12,6,p);c.drawCircle(12,12,2,p);for(int i=0;i<8;i++){double a=i*Math.PI/4;c.drawLine(12+(float)Math.cos(a)*7,12+(float)Math.sin(a)*7,12+(float)Math.cos(a)*10,12+(float)Math.sin(a)*10,p);}}
  else if("Info".equals(name)){c.drawCircle(12,12,9,p);c.drawPoint(12,7,p);c.drawLine(12,11,12,17,p);}
  else if("Contact".equals(name)){c.drawRoundRect(3,5,21,19,2,2,p);s.moveTo(3,6);s.lineTo(12,13);s.lineTo(21,6);c.drawPath(s,p);}
  else if("Nieuws".equals(name)){s.moveTo(3,10);s.lineTo(12,3);s.lineTo(21,10);s.moveTo(5,9);s.lineTo(5,21);s.lineTo(19,21);s.lineTo(19,9);s.moveTo(10,21);s.lineTo(10,15);s.lineTo(14,15);s.lineTo(14,21);c.drawPath(s,p);}
  else if("Column".equals(name)){c.drawRoundRect(4,3,20,21,2,2,p);c.drawLine(8,7,16,7,p);c.drawLine(8,11,16,11,p);c.drawLine(8,15,14,15,p);}
  else if("Competities".equals(name)){c.drawCircle(12,12,9,p);for(int i=0;i<5;i++){double a=(-90+i*72)*Math.PI/180;float x=12+(float)Math.cos(a)*4,y=12+(float)Math.sin(a)*4;if(i==0)s.moveTo(x,y);else s.lineTo(x,y);c.drawLine(x,y,12+(float)Math.cos(a)*8.5f,12+(float)Math.sin(a)*8.5f,p);}s.close();c.drawPath(s,p);}
  else if("Clubquiz".equals(name)){c.drawRoundRect(7,3,17,13,2,2,p);c.drawLine(12,14,12,20,p);c.drawLine(7,21,17,21,p);s.moveTo(7,5);s.lineTo(3,5);s.lineTo(3,9);s.lineTo(8,12);s.moveTo(17,5);s.lineTo(21,5);s.lineTo(21,9);s.lineTo(16,12);c.drawPath(s,p);}
  else if("Stadions".equals(name)){c.drawOval(2,5,22,13,p);c.drawArc(2,10,22,21,0,180,false,p);c.drawLine(2,9,2,16,p);c.drawLine(22,9,22,16,p);c.drawLine(7,12,7,20,p);c.drawLine(17,12,17,20,p);}
  else if("Video's".equals(name)||"Video’s".equals(name)){c.drawCircle(12,12,10,p);s.moveTo(10,7);s.lineTo(17,12);s.lineTo(10,17);s.close();c.drawPath(s,p);}
  else if("Mijn Clubs".equals(name)){for(int i=0;i<10;i++){double a=(-90+i*36)*Math.PI/180;float r=i%2==0?9:4,x=12+(float)Math.cos(a)*r,y=12+(float)Math.sin(a)*r;if(i==0)s.moveTo(x,y);else s.lineTo(x,y);}s.close();c.drawPath(s,p);}
  else {c.drawLine(4,6,20,6,p);c.drawLine(4,12,20,12,p);c.drawLine(4,18,20,18,p);}c.restore();
 }
}
