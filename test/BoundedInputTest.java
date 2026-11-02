package nl.voetbalhub.app;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
public final class BoundedInputTest {
    public static void main(String[] args) throws Exception {
        byte[] source=new byte[10000];Arrays.fill(source,(byte)42);
        if(!Arrays.equals(source,BoundedInput.read(new ByteArrayInputStream(source),10000)))throw new AssertionError();
        if(BoundedInput.read(new ByteArrayInputStream(new byte[0]),1).length!=0)throw new AssertionError();
        // No Content-Length is available on an InputStream. Refuse oversized chunked input.
        try{BoundedInput.read(new ByteArrayInputStream(source),9999);throw new AssertionError("Oversize accepted");}catch(IOException expected){}
        final int[] reads={0};
        InputStream endless=new InputStream(){public int read(){reads[0]++;return 42;}};
        try{BoundedInput.read(endless,8192);throw new AssertionError("Unbounded input accepted");}catch(IOException expected){}
        if(reads[0]>16384)throw new AssertionError("Read continued beyond a bounded block");
        InputStream failed=new InputStream(){public int read() throws IOException{throw new IOException("offline");}};
        try{BoundedInput.read(failed,100);throw new AssertionError("Network error lost");}catch(IOException expected){}
        System.out.println("BoundedInput: exact limit, empty, oversized, endless and failed streams passed.");
    }
}
