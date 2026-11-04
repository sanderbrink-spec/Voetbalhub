package nl.voetbalhub.app;
import android.content.Context;import android.graphics.*;import android.view.View;
/** Original geometric football emblems, not imitations of competition marks. */
public final class CompetitionEmblem42 extends View {
 private final String code;private final int accent;private final Paint p=new Paint(3);
 public CompetitionEmblem42(Context c,String id,int color){super(c);code=id;accent=color;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
 protected void onDraw(Canvas c){c.save();c.scale(getWidth()/100f,getHeight()/100f);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(3);p.setShader(new LinearGradient(15,10,85,90,new int[]{Color.WHITE,accent,0xFF91AB9C},null,Shader.TileMode.CLAMP));
 if(code.equals("ED")){c.drawRect(12,20,88,80,p);c.drawLine(50,20,50,80,p);c.drawCircle(50,50,15,p);c.drawRect(12,35,26,65,p);c.drawRect(74,35,88,65,p);}
 else if(code.equals("KKD")){for(int i=0;i<3;i++)c.drawRect(20+i*23,65-i*18,37+i*23,87,p);c.drawLine(12,90,88,90,p);}
 else if(code.equals("CL")){c.drawOval(14,27,86,73,p);c.drawOval(29,10,71,90,p);c.drawLine(14,50,86,50,p);c.drawCircle(50,50,35,p);}
 else if(code.equals("EL")){Path t=new Path();t.moveTo(29,14);t.lineTo(71,14);t.lineTo(64,53);t.quadTo(50,70,36,53);t.close();c.drawPath(t,p);c.drawLine(50,62,50,84,p);c.drawLine(30,87,70,87,p);}
 else if(code.equals("CO")){c.drawRect(25,18,75,75,p);c.drawLine(25,37,75,37,p);c.drawLine(25,56,75,56,p);c.drawLine(50,18,50,75,p);c.drawLine(35,86,65,86,p);}
 else {c.drawCircle(50,48,31,p);Path ball=new Path();for(int i=0;i<5;i++){double r=(i*72-90)*Math.PI/180;float x=50+(float)Math.cos(r)*13,y=48+(float)Math.sin(r)*13;if(i==0)ball.moveTo(x,y);else ball.lineTo(x,y);}ball.close();c.drawPath(ball,p);c.drawLine(22,88,78,88,p);}
 p.setShader(null);c.restore();}
}
