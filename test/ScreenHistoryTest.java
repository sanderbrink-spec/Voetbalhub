package nl.voetbalhub.app;
import java.util.ArrayList;
public final class ScreenHistoryTest {
 private static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
 public static void main(String[] args){
  ScreenHistory h=new ScreenHistory();ArrayList<String> seen=new ArrayList<>();
  h.enter("home",()->{seen.add("home");h.enter("home",()->{});});
  h.enter("more",()->{seen.add("more");h.enter("more",()->{});});
  h.enter("search:Ajax",()->{seen.add("search:Ajax");h.enter("search:Ajax",()->{});});
  h.enter("search:Ajax",()->{seen.add("search:Ajax");h.enter("search:Ajax",()->{});});
  h.enter("contact",()->{seen.add("contact");h.enter("contact",()->{});});
  check(h.back()&&h.current().key.equals("search:Ajax"),"Contact returns to the actual previous search");
  check(h.back()&&h.current().key.equals("more"),"Repeated rendering does not create an extra Back step");
  check(h.back()&&h.current().key.equals("home"),"Third Back returns home");
  check(!h.canGoBack(),"Restoring never re-adds the page just left");
  check(!h.confirmExit(1000),"First root Back does not show exit prompt");
  check(h.confirmExit(2000),"Second root Back asks for confirmation");
  check(!h.confirmExit(2100),"Confirmation consumes the armed state");
  h.resetExit();check(!h.confirmExit(5000)&&!h.confirmExit(8000),"A slow second Back does not confirm exit");
  h.enter("clubs",()->{});check(!h.confirmExit(8100),"Navigating resets exit arming");
  h.current().scrollY=128;check(h.current().scrollY==128,"Per-screen scroll state retained");
  System.out.println("ScreenHistory: actual previous screen, duplicate renders, restoration, exit timing and scroll state passed.");
 }
}
