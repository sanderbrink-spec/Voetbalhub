package nl.voetbalhub.app;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.IOException;
import java.io.InputStream;

/** Decode a bounded preview instead of allocating the source image's full pixel size. */
public final class EditorialBitmap {
    private EditorialBitmap(){}
    public static Bitmap read(InputStream input,int maxDimension) throws IOException {
        if(maxDimension<1)throw new IllegalArgumentException("Invalid dimension");
        byte[] bytes=BoundedInput.read(input,5000000);
        BitmapFactory.Options options=new BitmapFactory.Options();
        options.inJustDecodeBounds=true;
        BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
        if(options.outWidth<1||options.outHeight<1||options.outWidth>32768||options.outHeight>32768||
            (long)options.outWidth*options.outHeight>100000000L)throw new IOException("Invalid image dimensions");
        options.inJustDecodeBounds=false;
        options.inSampleSize=1;
        while((long)Math.max(options.outWidth,options.outHeight)>((long)maxDimension*options.inSampleSize))options.inSampleSize*=2;
        Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
        if(bitmap==null)throw new IOException("Invalid bitmap");
        return bitmap;
    }
}
