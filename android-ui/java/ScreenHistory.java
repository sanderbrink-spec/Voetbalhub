package nl.voetbalhub.app;
import java.util.ArrayDeque;
/** Actual screen visits. Rendering the same screen never creates another Back step. */
public final class ScreenHistory {
 public static final class Entry {public final String key;public Runnable restore;public int scrollY;Entry(String key,Runnable restore){this.key=key;this.restore=restore;}}
 private final ArrayDeque<Entry> previous=new ArrayDeque<>();private Entry current;private boolean restoring;private long firstRootBack=-1;
 public Entry current(){return current;}public boolean isRestoring(){return restoring;}
 public void enter(String key,Runnable restore){if(restoring)return;resetExit();if(current!=null&&current.key.equals(key)){current.restore=restore;return;}if(current!=null)previous.addLast(current);while(previous.size()>40)previous.removeFirst();current=new Entry(key,restore);}
 public boolean canGoBack(){return !previous.isEmpty();}
 public boolean back(){resetExit();if(previous.isEmpty())return false;current=previous.removeLast();restoring=true;try{current.restore.run();}finally{restoring=false;}return true;}
 public void resetExit(){firstRootBack=-1;}
 public boolean confirmExit(long now){if(firstRootBack>=0&&now>=firstRootBack&&now-firstRootBack<=2200){resetExit();return true;}firstRootBack=now;return false;}
}
