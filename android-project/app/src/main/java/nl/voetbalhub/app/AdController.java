package nl.voetbalhub.app;
import android.app.Activity;
import android.view.View;
/** Mixed-age technical test: no advertising SDK or identifiers. Existing scrolling slots collapse. */
public final class AdController {
 private final Activity activity;public AdController(Activity a){activity=a;}
 public View slot(String placement){View v=new View(activity);v.setVisibility(View.GONE);return v;}
 public void privacy() {
  PremiumDesign40.infoDialog(activity, "Advertentieprivacy", "Advertenties en quizdeelname",
   new String[][] {
    {"Info", "Geen advertenties", "Deze testversie laadt geen advertenties."},
    {"Info", "Geen advertentie-ID", "Deze testversie gebruikt geen advertentie-ID."},
    {"Clubquiz", "Quiz blijft onafhankelijk", "Online quizdeelname staat los van advertenties."}
   });
 }
 public void pause(){}public void resume(){}public void dispose(){}
}
