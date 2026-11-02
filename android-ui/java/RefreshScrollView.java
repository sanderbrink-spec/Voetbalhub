package nl.voetbalhub.app;
import android.content.Context;
import android.view.MotionEvent;
import android.widget.ScrollView;
/** Vertical pull only at the top. Horizontal carousel gestures remain with the child. */
public final class RefreshScrollView extends ScrollView implements FeedRepository.Listener {
 private boolean busy;
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();FeedRepository.subscribe(getContext(),this);}
 @Override protected void onDetachedFromWindow(){FeedRepository.unsubscribe(this);super.onDetachedFromWindow();}
 public void changed(org.json.JSONObject data,boolean loading,boolean failed){busy=loading;invalidate();}
 @Override protected void dispatchDraw(android.graphics.Canvas canvas){super.dispatchDraw(canvas);if(busy){android.graphics.Paint paint=new android.graphics.Paint(3);paint.setColor(0xFF25F06B);paint.setStyle(android.graphics.Paint.Style.STROKE);float d=getResources().getDisplayMetrics().density;paint.setStrokeWidth(3*d);float x=getWidth()/2f,y=getScrollY()+24*d;canvas.drawArc(x-10*d,y-10*d,x+10*d,y+10*d,(android.os.SystemClock.uptimeMillis()%1000)*.36f,270,false,paint);postInvalidateDelayed(30);}}
 private float x,y;private boolean pulling;private final Runnable refresh;
 public RefreshScrollView(Context c,Runnable refresh){super(c);this.refresh=refresh;}
 private boolean pulled(MotionEvent e){return e.getY()-y>72*getResources().getDisplayMetrics().density&&e.getY()-y>Math.abs(e.getX()-x)*1.5f;}
 @Override public boolean onInterceptTouchEvent(MotionEvent e){
  if(e.getActionMasked()==MotionEvent.ACTION_DOWN){x=e.getX();y=e.getY();pulling=false;}
  if(e.getActionMasked()==MotionEvent.ACTION_MOVE&&getScrollY()==0&&pulled(e)){pulling=true;return true;}
  return super.onInterceptTouchEvent(e);
 }
 @Override public boolean onTouchEvent(MotionEvent e){if(e.getActionMasked()==MotionEvent.ACTION_MOVE&&getScrollY()==0&&pulled(e))pulling=true;if(pulling){if(e.getActionMasked()==MotionEvent.ACTION_UP){pulling=false;refresh.run();performClick();}else if(e.getActionMasked()==MotionEvent.ACTION_CANCEL)pulling=false;return true;}return super.onTouchEvent(e);}
 @Override public boolean performClick(){super.performClick();return true;}
}
