package nl.voetbalhub.app;
/** No persisted consent boolean is ever sufficient to request an advertisement. */
public final class AdRequestGate {
    private AdRequestGate(){}
    public static boolean validIds(boolean test,String app,String home,String reader){
        if(app==null||home==null||reader==null||!app.matches("ca-app-pub-[0-9]{16}~[0-9]{10}")||!home.matches("ca-app-pub-[0-9]{16}/[0-9]{10}")||!reader.matches("ca-app-pub-[0-9]{16}/[0-9]{10}"))return false;
        String publisher=app.substring(0,27);
        if(!home.startsWith(publisher)||!reader.startsWith(publisher))return false;
        return test?app.equals("ca-app-pub-3940256099942544~3347511713")&&home.equals("ca-app-pub-3940256099942544/9214589741")&&reader.equals(home):!app.startsWith("ca-app-pub-3940256099942544~")&&!home.equals(reader);
    }
    public static boolean canRequest(boolean sessionUpdateSucceeded,boolean umpAllows,boolean audienceConfirmed,boolean testMode,boolean productionApproved,boolean accountVerified){
        return sessionUpdateSucceeded&&umpAllows&&audienceConfirmed&&(testMode||(productionApproved&&accountVerified));
    }
}
