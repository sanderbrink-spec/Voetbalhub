package nl.voetbalhub.app;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

/** Total wall-clock deadline also covers slow-drip bodies, redirects are rejected. */
public final class DeadlineHttp {
 private static final ScheduledExecutorService CLOCK=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"veldio-deadlines");t.setDaemon(true);return t;});
 private DeadlineHttp(){}
 /** Shared total deadline for authenticated GET/POST/DELETE requests, including slow-drip responses. */
 public static final class Guard implements AutoCloseable {
  private final HttpURLConnection connection;private final long deadline;private final ScheduledFuture<?> alarm;
  private Guard(HttpURLConnection c,int timeoutMs){connection=c;deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(timeoutMs);alarm=CLOCK.schedule(c::disconnect,timeoutMs,TimeUnit.MILLISECONDS);}
  public void check() throws SocketTimeoutException {if(System.nanoTime()>=deadline||Thread.currentThread().isInterrupted())throw new SocketTimeoutException("Total deadline");}
  @Override public void close(){alarm.cancel(false);connection.disconnect();}
 }
 public static Guard watch(HttpURLConnection c,int timeoutMs) throws SocketTimeoutException {if(timeoutMs<=0)throw new SocketTimeoutException("Total deadline");return new Guard(c,timeoutMs);}

 public static String get(String address,int timeoutMs,int limit) throws IOException {
  HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();
  c.setInstanceFollowRedirects(false);c.setUseCaches(false);c.setConnectTimeout(Math.min(timeoutMs,7000));c.setReadTimeout(Math.min(timeoutMs,7000));
  c.setRequestProperty("Accept","application/json");c.setRequestProperty("Cache-Control","no-cache");
  long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(timeoutMs);
  ScheduledFuture<?> alarm=CLOCK.schedule(c::disconnect,timeoutMs,TimeUnit.MILLISECONDS);
  try {
   if(c.getResponseCode()!=200)throw new IOException("HTTP unavailable");
   try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] b=new byte[8192];int n;
    while((n=in.read(b))!=-1){if(System.nanoTime()>=deadline||Thread.currentThread().isInterrupted())throw new SocketTimeoutException("Total deadline");if(out.size()+n>limit)throw new IOException("Response too large");out.write(b,0,n);}
    if(System.nanoTime()>=deadline)throw new SocketTimeoutException("Total deadline");return out.toString(StandardCharsets.UTF_8.name());
   }
  } finally {alarm.cancel(false);c.disconnect();}
 }
}
