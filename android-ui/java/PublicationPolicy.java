package nl.voetbalhub.app;
import org.json.JSONObject;
/** Accept only data delivered under the current server rights policy, including offline caches. */
public final class PublicationPolicy {
    private PublicationPolicy(){}
    public static boolean allows(JSONObject data){return data!=null&&data.optInt("rightsPolicyVersion")==26&&data.optLong("rightsExpiresAt")>System.currentTimeMillis();}
}
