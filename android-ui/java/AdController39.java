package nl.voetbalhub.app;
import android.app.Activity;
import android.view.View;
/** Mixed-age technical test: no advertising SDK or identifiers. Existing scrolling slots collapse. */
public final class AdController {
 private final Activity activity;public AdController(Activity a){activity=a;}
 public View slot(String placement){View v=new View(activity);v.setVisibility(View.GONE);return v;}
 public void privacy(){new android.app.AlertDialog.Builder(activity).setTitle("Advertentieprivacy").setMessage("Deze testversie bevat geen advertentieverzoeken of advertentie-ID. Online quizdeelname staat los van advertenties.").setPositiveButton("Sluiten",null).show();}
 public void pause(){}public void resume(){}public void dispose(){}
}
