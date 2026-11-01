package nl.voetbalhub.app;
public final class AdRequestGateTest {
    private static void check(boolean value){if(!value)throw new AssertionError("Ad privacy gate failed");}
    public static void main(String[] args){
        for(int mask=0;mask<64;mask++){boolean updated=(mask&1)!=0,consent=(mask&2)!=0,audience=(mask&4)!=0,test=(mask&8)!=0,approved=(mask&16)!=0,account=(mask&32)!=0;
            boolean actual=AdRequestGate.canRequest(updated,consent,audience,test,approved,account);
            if(!updated||!consent||!audience)check(!actual);if(!test&&(!approved||!account))check(!actual);if(updated&&consent&&audience&&(test||approved&&account))check(actual);
        }
        check(AdRequestGate.validIds(true,AdSettings.APP_ID,AdSettings.HOME_UNIT,AdSettings.READER_UNIT));
        check(!AdRequestGate.validIds(false,AdSettings.APP_ID,AdSettings.HOME_UNIT,AdSettings.READER_UNIT));
        check(!AdRequestGate.validIds(true,"invalid",AdSettings.HOME_UNIT,AdSettings.READER_UNIT));
        check(AdSettings.TEST_MODE&&!AdSettings.AUDIENCE_CONFIRMED&&!AdSettings.PRODUCTION_APPROVED);
        System.out.println("AdRequestGate: 64 consent/configuration combinations and test-only identifiers passed.");
    }
}
