package nl.voetbalhub.app;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.Drawable;

/** Local, network-independent artwork for columns and missing article images. */
public final class EditorialArtwork extends Drawable {
    private static Bitmap portrait;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final boolean column;
    public EditorialArtwork(Context context,boolean column){this.column=column;if(column&&portrait==null){BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=2;portrait=BitmapFactory.decodeResource(context.getResources(),R.drawable.column_sander_brink_clean,options);}}
    @Override public void draw(Canvas canvas){
        Rect b=getBounds();float w=b.width(),h=b.height();canvas.save();canvas.translate(b.left,b.top);
        paint.setShader(new LinearGradient(0,0,w,h,0xFF1B3828,0xFF07110B,Shader.TileMode.CLAMP));canvas.drawRect(0,0,w,h,paint);paint.setShader(null);
        if(column&&portrait!=null){float ph=h*1.58f,pw=ph*portrait.getWidth()/portrait.getHeight();canvas.drawBitmap(portrait,null,new RectF((w-pw)/2,-h*.035f,(w+pw)/2,ph-h*.035f),paint);paint.setShader(new LinearGradient(0,h*.56f,0,h,0x0008110B,0xD908110B,Shader.TileMode.CLAMP));canvas.drawRect(0,0,w,h,paint);paint.setShader(null);}
        else{paint.setColor(0xFF2C4E36);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(Math.max(1,w*.012f));canvas.drawCircle(w*.63f,h*.48f,h*.37f,paint);paint.setStyle(Paint.Style.FILL);paint.setColor(0xFFA9FF35);Path v=new Path();v.moveTo(w*.22f,h*.2f);v.lineTo(w*.38f,h*.2f);v.lineTo(w*.53f,h*.59f);v.lineTo(w*.74f,h*.2f);v.lineTo(w*.9f,h*.2f);v.lineTo(w*.56f,h*.82f);v.lineTo(w*.43f,h*.82f);v.close();canvas.drawPath(v,paint);}
        canvas.restore();
    }
    @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
    @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
    @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
