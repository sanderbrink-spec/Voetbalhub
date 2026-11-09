"""Smoke-test the non-debuggable Veldio release APK on an Android 16 emulator.

This is separate from the phase49 deep developer test, which requires debug-only
run-as and WebView DevTools interfaces not available in a production release.
"""
from pathlib import Path
import json
import os
import re
import subprocess
import sys
import time

import uiautomator2 as u2

APK = Path(sys.argv[1]).resolve()
PACKAGE = "nl.voetbalhub.app1"
ACTIVITY = "nl.voetbalhub.app.MainActivity"
OUT = Path(".android-smoke")
OUT.mkdir(exist_ok=True)


def adb(*args, timeout=45):
    return subprocess.check_output(
        ["adb", *args], text=True, stderr=subprocess.STDOUT, timeout=timeout
    )


def capture(device, label):
    (OUT / (label + ".xml")).write_text(device.dump_hierarchy(), encoding="utf-8")
    path = OUT / (label + ".png")
    path.write_bytes(subprocess.check_output(["adb", "exec-out", "screencap", "-p"], timeout=30))
    if path.stat().st_size < 6000:
        raise AssertionError("Blank or truncated screenshot: " + label)


def article_reader(device, suffix):
    headline = "Meerveld schiet Heerenveen met hattrick langs Feyenoord"
    if not device(text="Nieuws").wait(timeout=25):
        raise AssertionError("News navigation missing")
    device(text="Nieuws").click()
    if device(text="Laatste").wait(timeout=8):
        device(text="Laatste").click()
    refresh = device(textMatches="(?i)ververs(?:en)?")
    if refresh.wait(timeout=12):
        refresh.click()
    card = device(text=headline)
    for _ in range(8):
        if card.wait(timeout=4):
            break
        device.swipe_ext("up", scale=0.6)
    else:
        raise AssertionError("Corrected live article not visible in Android news")
    capture(device, "news-" + suffix)
    card.click()
    title = device(text=headline)
    back = device(description="Terug naar de vorige pagina")
    if not back.wait(timeout=10) or not title.wait(timeout=10):
        raise AssertionError("Reader header or full article headline missing")
    if title.info["bounds"]["top"] < back.info["bounds"]["bottom"]:
        raise AssertionError("Headline overlaps the fixed back control")
    capture(device, "reader-top-" + suffix)

    paragraphs = device(textStartsWith="Na rust maakte Levi Smans in de 47e minuut gelijk.")
    for _ in range(10):
        if paragraphs.exists and paragraphs.info["bounds"]["top"] >= back.info["bounds"]["bottom"]:
            break
        device.swipe_ext("up", scale=0.50)
    else:
        raise AssertionError("Verified halftime transition not visible below the reader header")
    capture(device, "reader-middle-" + suffix)
    for _ in range(10):
        if device(textStartsWith="VELDIO  /").exists:
            break
        device.swipe_ext("up", scale=0.68)
    else:
        raise AssertionError("Cannot reach end of article")
    capture(device, "reader-bottom-" + suffix)
    back.click()


checks = []
try:
    if not APK.is_file():
        raise AssertionError("Release APK missing")
    if adb("shell", "getprop", "ro.build.version.sdk").strip() != "36":
        raise AssertionError("Not an Android API36 emulator")
    checks.append("Actual Android 16 / API36 runtime")

    sdk = Path(os.environ.get("ANDROID_HOME") or os.environ["ANDROID_SDK_ROOT"])
    aapt = sdk / "build-tools" / "36.0.0" / "aapt"
    manifest = subprocess.check_output(
        [str(aapt), "dump", "badging", str(APK)], text=True
    )
    if not all(token in manifest for token in (
        "package: name='" + PACKAGE + "'",
        "versionCode='97'",
        "versionName='4.57'",
    )):
        raise AssertionError("Unexpected production package or version")
    if "application-debuggable" in manifest:
        raise AssertionError("Production release must not be debuggable")
    checks.append("Correct signed production package, version and non-debuggable build")

    adb("logcat", "-c")
    adb("install", "-r", str(APK), timeout=90)
    try:
        adb("shell", "pm", "grant", PACKAGE, "android.permission.POST_NOTIFICATIONS")
    except subprocess.CalledProcessError:
        pass
    start = adb("shell", "am", "start", "-W", "-n", PACKAGE + "/" + ACTIVITY)
    if "Error" in start or "Exception" in start:
        raise AssertionError("Android failed to launch Veldio: " + start[-500:])

    device = u2.connect()
    activity = None
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        try:
            activity = device.app_current()
            if activity.get("package") == PACKAGE and activity.get("activity", "").endswith("MainActivity"):
                break
        except Exception:
            pass
        time.sleep(1)
    else:
        raise AssertionError("Veldio never reached the foreground: " + repr(activity))
    pid = adb("shell", "pidof", PACKAGE).strip()
    if not pid:
        raise AssertionError("Veldio process not alive")
    checks.append("Release APK installed and main activity running in foreground")

    time.sleep(4)
    hierarchy = device.dump_hierarchy()
    if PACKAGE not in hierarchy or len(hierarchy) < 150:
        raise AssertionError("No observable Veldio UI hierarchy")
    (OUT / "release-ui.xml").write_text(hierarchy, encoding="utf-8")
    screenshot = OUT / "release-ui.png"
    screenshot.write_bytes(subprocess.check_output(
        ["adb", "exec-out", "screencap", "-p"], timeout=30
    ))
    if screenshot.stat().st_size < 6000:
        raise AssertionError("Android screenshot blank or truncated")
    checks.append("Rendered activity UI and saved real emulator screenshot")

    article_reader(device, "normal")
    checks.append("Live corrected report, reader header, body and footer at standard font size")
    adb("shell", "settings", "put", "system", "font_scale", "1.60")
    try:
        adb("shell", "am", "force-stop", PACKAGE)
        adb("shell", "am", "start", "-W", "-n", PACKAGE + "/" + ACTIVITY)
        article_reader(device, "large")
        checks.append("Live article reader and scroll at 160% system font size")
    finally:
        adb("shell", "settings", "put", "system", "font_scale", "1.0")

    log = adb("logcat", "-d", "-t", "2000")
    if re.search(r"FATAL EXCEPTION:[\s\S]{0,600}Process: " + re.escape(PACKAGE), log):
        raise AssertionError("Veldio crashed during the smoke test")
    checks.append("No Veldio fatal exception during launch")

    report = {
        "status": "PASS",
        "apk": str(APK),
        "package": PACKAGE,
        "version": "4.57",
        "androidApi": 36,
        "checks": checks,
        "limits": [
            "Android emulator, not a physical Samsung S23",
            "Reader coverage is limited to the corrected Heerenveen report",
            "Legacy differently signed app cannot be updated in place",
        ],
    }
    (OUT / "release-result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))
except Exception as error:
    (OUT / "release-failure.json").write_text(json.dumps(
        {"status": "FAIL", "error": str(error), "checks": checks}, indent=2
    ) + "\n")
    raise
