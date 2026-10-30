package nl.voetbalhub.app;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;
/** Consistent outline navigation icons, independent of the phone's emoji font. */
public final class NavIconView extends View {
 private final String name;private final int color;private final Paint p=new Paint(3);
 public NavIconView(Context c,String name,boolean active){super(c);this.name=name;color=active?0xFF25F06B:0xFF93A198;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
 @Override protected void onDraw(Canvas c){super.onDraw(c);float size=Math.min(getWidth(),getHeight())*.83f;c.save();c.translate((getWidth()-size)/2,(getHeight()-size)/2);c.scale(size/24f,size/24f);p.setColor(color);p.setStrokeWidth(1.8f);p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);Path s=new Path();
  if("Zoeken".equals(name)){c.drawCircle(10,10,6,p);c.drawLine(14.5f,14.5f,21,21,p);}
  else if("Instellingen".equals(name)){c.drawCircle(12,12,6,p);c.drawCircle(12,12,2,p);for(int i=0;i<8;i++){double a=i*Math.PI/4;c.drawLine(12+(float)Math.cos(a)*7,12+(float)Math.sin(a)*7,12+(float)Math.cos(a)*10,12+(float)Math.sin(a)*10,p);}}
  else if("Info".equals(name)){c.drawCircle(12,12,9,p);c.drawPoint(12,7,p);c.drawLine(12,11,12,17,p);}
  else if("Contact".equals(name)){c.drawRoundRect(3,5,21,19,2,2,p);s.moveTo(3,6);s.lineTo(12,13);s.lineTo(21,6);c.drawPath(s,p);}
  else if("Nieuws".equals(name)){s.moveTo(3,10);s.lineTo(12,3);s.lineTo(21,10);s.moveTo(5,9);s.lineTo(5,21);s.lineTo(19,21);s.lineTo(19,9);s.moveTo(10,21);s.lineTo(10,15);s.lineTo(14,15);s.lineTo(14,21);c.drawPath(s,p);}
  else if("Column".equals(name)){c.drawRoundRect(4,3,20,21,2,2,p);c.drawLine(8,7,16,7,p);c.drawLine(8,11,16,11,p);c.drawLine(8,15,14,15,p);}
  else if("Competities".equals(name)){c.drawCircle(12,12,9,p);for(int i=0;i<5;i++){double a=(-90+i*72)*Math.PI/180;float x=12+(float)Math.cos(a)*4,y=12+(float)Math.sin(a)*4;if(i==0)s.moveTo(x,y);else s.lineTo(x,y);c.drawLine(x,y,12+(float)Math.cos(a)*8.5f,12+(float)Math.sin(a)*8.5f,p);}s.close();c.drawPath(s,p);}
  else if("Favorieten".equals(name)){for(int i=0;i<10;i++){double a=(-90+i*36)*Math.PI/180;float r=i%2==0?9:4,x=12+(float)Math.cos(a)*r,y=12+(float)Math.sin(a)*r;if(i==0)s.moveTo(x,y);else s.lineTo(x,y);}s.close();c.drawPath(s,p);}
  else {c.drawLine(4,6,20,6,p);c.drawLine(4,12,20,12,p);c.drawLine(4,18,20,18,p);}c.restore();
 }
}
