package nl.voetbalhub.app;
import android.app.Activity;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.android.gms.ads.*;
import com.google.android.ump.*;
import java.util.ArrayList;

/** Two small, separately owned slots. No SDK initialization or request before current UMP checks. */
public final class AdController {
    private final Activity activity;
    private final ArrayList<Slot> slots=new ArrayList<>();
    private ConsentInformation consent;
    private boolean updated,initialized,initializing,disposed,ageAllowed,ageChoiceMade;
    private int generation=0;
    private final class Slot {final LinearLayout box;final String unit;AdView ad;Slot(LinearLayout b,String u){box=b;unit=u;}}
    public AdController(Activity a){activity=a;}
    private int dp(int n){return (int)(n*activity.getResources().getDisplayMetrics().density+.5f);}
    public View slot(String position){
        LinearLayout box=new LinearLayout(activity);box.setOrientation(LinearLayout.VERTICAL);box.setGravity(Gravity.CENTER);box.setPadding(0,dp(10),0,dp(10));
        TextView label=new TextView(activity);label.setText(AdSettings.TEST_MODE?"ADVERTENTIE · TESTPOSITIE":"ADVERTENTIE");label.setTextColor(0xFFA3B4A8);label.setTextSize(9);label.setGravity(Gravity.CENTER);box.addView(label,new LinearLayout.LayoutParams(-1,dp(18)));
        Slot slot=new Slot(box,"home".equals(position)?AdSettings.HOME_UNIT:AdSettings.READER_UNIT);slots.add(slot);
        box.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){if(!slots.contains(slot))slots.add(slot);if(ready())load(slot);}public void onViewDetachedFromWindow(View v){destroy(slot);slots.remove(slot);}});
        // Reserve only a compact non-clickable placeholder. No ad request and no artificial impression.
        box.setMinimumHeight(dp(68));return box;
    }
    private boolean ready(){return !disposed&&ageAllowed&&AdRequestGate.validIds(AdSettings.TEST_MODE,AdSettings.APP_ID,AdSettings.HOME_UNIT,AdSettings.READER_UNIT)&&AdRequestGate.canRequest(updated,consent!=null&&consent.canRequestAds(),AdSettings.AUDIENCE_CONFIRMED,AdSettings.TEST_MODE,AdSettings.PRODUCTION_APPROVED,AdSettings.ACCOUNT_VERIFIED);}
    public void privacy(){
        if(disposed)return;
        if(!AdSettings.AUDIENCE_CONFIRMED||(!AdSettings.TEST_MODE&&(!AdSettings.PRODUCTION_APPROVED||!AdSettings.ACCOUNT_VERIFIED))){new android.app.AlertDialog.Builder(activity).setTitle("Advertentieprivacy").setMessage("Advertenties zijn nog niet actief. Doelgroep en AdMob-privacybericht moeten eerst door de uitgever worden bevestigd. Deze testversie vraagt geen advertenties aan.").setPositiveButton("Sluiten",null).show();return;}
        if(!ageAllowed){ageChoiceMade=true;new android.app.AlertDialog.Builder(activity).setTitle("Advertentieprivacy").setMessage("Ben je 16 jaar of ouder? Dit antwoord wordt alleen tijdens deze appsessie gebruikt en niet opgeslagen. Zonder bevestiging blijven advertenties uit.").setPositiveButton("16 jaar of ouder",(dialog,which)->{ageAllowed=true;privacy();}).setNegativeButton("Geen advertenties",(dialog,which)->{ageAllowed=false;failClosed();}).setOnCancelListener(dialog->{ageAllowed=false;failClosed();}).show();return;}
        consent=UserMessagingPlatform.getConsentInformation(activity);
        stopAds();updated=false;final int request=++generation;
        ConsentRequestParameters params=new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(!ageAllowed).build();
        consent.requestConsentInfoUpdate(activity,params,()->{
            if(disposed||request!=generation)return;updated=true;
            if(consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED){
                UserMessagingPlatform.showPrivacyOptionsForm(activity,error->{if(disposed||request!=generation)return;if(error==null)refresh(request);else failClosed();});
            }else UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity,error->{if(disposed||request!=generation)return;if(error==null)refresh(request);else failClosed();});
        },error->{if(request==generation){updated=false;stopAds();}});
    }
    /** Call on launch only in a reviewed, audience-configured build. */
    public void start(){
        if(!AdSettings.AUDIENCE_CONFIRMED||disposed||(!AdSettings.TEST_MODE&&(!AdSettings.PRODUCTION_APPROVED||!AdSettings.ACCOUNT_VERIFIED)))return;
        if(!ageChoiceMade){privacy();return;}if(!ageAllowed)return;
        consent=UserMessagingPlatform.getConsentInformation(activity);updated=false;final int request=++generation;
        consent.requestConsentInfoUpdate(activity,new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(!ageAllowed).build(),()->{if(disposed||request!=generation)return;updated=true;UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity,error->{if(disposed||request!=generation)return;if(error==null)refresh(request);else failClosed();});},error->{if(disposed||request!=generation)return;updated=false;stopAds();});
    }
    private void refresh(int request){if(disposed||request!=generation||!ready()){stopAds();return;}if(initialized){for(Slot s:new ArrayList<>(slots))load(s);return;}if(initializing)return;initializing=true;
        new Thread(()->MobileAds.initialize(activity,status->activity.runOnUiThread(()->{initializing=false;initialized=true;if(ready())for(Slot s:new ArrayList<>(slots))load(s);})),"veldio-ads-init").start();
    }
    private void load(Slot slot){if(!ready()||!initialized||slot.ad!=null||!slot.box.isAttachedToWindow())return;
        slot.box.post(()->{if(!ready()||!initialized||slot.ad!=null||!slot.box.isAttachedToWindow())return;int width=Math.min(360,Math.max(1,(int)(slot.box.getWidth()/activity.getResources().getDisplayMetrics().density)));
            AdView ad=new AdView(activity);slot.ad=ad;ad.setAdUnitId(slot.unit);ad.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity,width));slot.box.addView(ad,new LinearLayout.LayoutParams(dp(width),-2));
            ad.setAdListener(new AdListener(){@Override public void onAdFailedToLoad(LoadAdError error){destroy(slot);}});ad.loadAd(new AdRequest.Builder().build());});
    }
    private void destroy(Slot s){if(s.ad!=null){AdView old=s.ad;s.ad=null;s.box.removeView(old);old.destroy();}}
    private void failClosed(){updated=false;generation++;stopAds();}
    private void stopAds(){for(Slot s:new ArrayList<>(slots))destroy(s);}
    public void pause(){generation++;updated=false;stopAds();}
    public void resume(){if(AdSettings.AUDIENCE_CONFIRMED)start();}
    public void dispose(){disposed=true;generation++;stopAds();slots.clear();}
}
