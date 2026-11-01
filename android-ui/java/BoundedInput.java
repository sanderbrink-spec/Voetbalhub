package nl.voetbalhub.app;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Enforce the byte limit even when the server omits or lies about Content-Length. */
public final class BoundedInput {
    private BoundedInput(){}
    public static byte[] read(InputStream input,int limit) throws IOException {
        if(limit<1)throw new IllegalArgumentException("Invalid limit");
        ByteArrayOutputStream output=new ByteArrayOutputStream(Math.min(limit,8192));
        byte[] block=new byte[Math.min(limit,8192)];
        int count;
        while((count=input.read(block))!=-1){
            if(count>limit-output.size())throw new IOException("Image exceeds byte limit");
            output.write(block,0,count);
        }
        return output.toByteArray();
    }
}
