import nl.voetbalhub.app.DeadlineHttp;
import com.sun.net.httpserver.*;
import java.net.*;
import java.util.concurrent.*;
public class DeadlineHttpTest {
 public static void main(String[] args)throws Exception{
  HttpServer s=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);ExecutorService workers=Executors.newCachedThreadPool();s.setExecutor(workers);
  s.createContext("/ok",x->{byte[] b="{\"articles\":[]}".getBytes();x.sendResponseHeaders(200,b.length);x.getResponseBody().write(b);x.close();});
  s.createContext("/fail",x->{x.sendResponseHeaders(503,-1);x.close();});
  s.createContext("/redirect",x->{x.getResponseHeaders().add("Location","/ok");x.sendResponseHeaders(302,-1);x.close();});
  s.createContext("/oversize",x->{byte[] b=new byte[1024];x.sendResponseHeaders(200,b.length);try{x.getResponseBody().write(b);}finally{x.close();}});
  s.createContext("/drip",x->{x.sendResponseHeaders(200,0);try{for(int i=0;i<50;i++){x.getResponseBody().write('a');x.getResponseBody().flush();try{Thread.sleep(80);}catch(InterruptedException e){break;}}}catch(Exception ignored){}finally{x.close();}});
  s.start();String base="http://127.0.0.1:"+s.getAddress().getPort();try{
   if(!DeadlineHttp.get(base+"/ok",1000,100).contains("articles"))throw new AssertionError();
   for(String p:new String[]{"fail","redirect","oversize","drip"}){long start=System.nanoTime();boolean rejected=false;try{DeadlineHttp.get(base+"/"+p,350,100);}catch(java.io.IOException expected){rejected=true;}if(!rejected)throw new AssertionError(p+" accepted");if(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)>1500)throw new AssertionError(p+" exceeded total deadline");}
   if(!DeadlineHttp.get(base+"/ok",1000,100).contains("articles"))throw new AssertionError("Retry failed");
   for(String method:new String[]{"POST","DELETE"}){
    HttpURLConnection c=(HttpURLConnection)new URL(base+"/drip").openConnection();c.setRequestMethod(method);c.setReadTimeout(1000);long start=System.nanoTime();boolean timedOut=false;
    try(DeadlineHttp.Guard guard=DeadlineHttp.watch(c,350)){
     if(method.equals("POST")){c.setDoOutput(true);try(java.io.OutputStream out=c.getOutputStream()){out.write("{}".getBytes());}}
     c.getResponseCode();try(java.io.InputStream in=c.getInputStream()){while(in.read()!=-1)guard.check();}
    }catch(java.io.IOException expected){timedOut=true;}
    if(!timedOut||TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)>1500)throw new AssertionError(method+" slow drip exceeded total deadline");
   }
   System.out.println("PASS: success, 503, rejected redirect, bounded bytes, slow drip total deadline successful retry, and authenticated POST/DELETE slow-drip deadlines");
  }finally{s.stop(0);workers.shutdownNow();}
 }
}
