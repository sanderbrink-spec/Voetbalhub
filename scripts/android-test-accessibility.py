"""Keep Android accessibility enabled throughout UIAutomator's separate dump processes.

The empty service runs only on the CI emulator; it is never included in Veldio.
"""
from pathlib import Path
import os, subprocess, tempfile

def run(*args):
    subprocess.run([str(x) for x in args],check=True,stdout=subprocess.DEVNULL)

sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
tools=sorted(sdk.glob('build-tools/*/aapt'))[-1].parent
android=sorted(sdk.glob('platforms/android-*/android.jar'))[-1]
with tempfile.TemporaryDirectory(prefix='veldio-accessibility-') as directory:
    root=Path(directory);(root/'res/xml').mkdir(parents=True);(root/'classes').mkdir()
    (root/'AndroidManifest.xml').write_text('''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="nl.veldio.testaccess"><uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35"/><application android:label="Veldio CI accessibility"><service android:name=".TestService" android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE" android:exported="true"><intent-filter><action android:name="android.accessibilityservice.AccessibilityService"/></intent-filter><meta-data android:name="android.accessibilityservice" android:resource="@xml/service"/></service></application></manifest>''')
    (root/'res/xml/service.xml').write_text('''<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android" android:accessibilityEventTypes="typeAllMask" android:accessibilityFeedbackType="feedbackGeneric" android:canRetrieveWindowContent="true" android:accessibilityFlags="flagReportViewIds" android:notificationTimeout="100"/>''')
    (root/'TestService.java').write_text('''package nl.veldio.testaccess; public final class TestService extends android.accessibilityservice.AccessibilityService {public void onAccessibilityEvent(android.view.accessibility.AccessibilityEvent event){} public void onInterrupt(){}}''')
    run('javac','-source','8','-target','8','-classpath',android,'-d',root/'classes',root/'TestService.java')
    run(tools/'d8','--lib',android,'--output',root,root/'classes/nl/veldio/testaccess/TestService.class')
    run(tools/'aapt','package','-f','-M',root/'AndroidManifest.xml','-S',root/'res','-I',android,'-F',root/'unsigned.apk')
    import zipfile
    with zipfile.ZipFile(root/'unsigned.apk','a') as archive:archive.write(root/'classes.dex','classes.dex')
    run('keytool','-genkeypair','-keystore',root/'test.jks','-alias','test','-storepass','android','-keypass','android','-dname','CN=Veldio CI only','-keyalg','RSA','-validity','2')
    run(tools/'apksigner','sign','--ks',root/'test.jks','--ks-pass','pass:android','--key-pass','pass:android','--out',root/'service.apk',root/'unsigned.apk')
    run('adb','install','-r',root/'service.apk')
    run('adb','shell','settings','put','secure','enabled_accessibility_services','nl.veldio.testaccess/.TestService')
    run('adb','shell','settings','put','secure','accessibility_enabled','1')
print('Persistent empty CI accessibility service installed; no production APK changed.')
