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
import urllib.request
import xml.etree.ElementTree as ET

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


def artwork_rotation(device):
    headline = "Van Mieghem beslist duel met Sparta voor ADO"
    device(text="Nieuws").click()
    card = device(text=headline)
    for _ in range(8):
        if card.wait(timeout=5):
            break
        device.swipe_ext("up", scale=0.55)
    else:
        raise AssertionError("ADO–Sparta ontbreekt in het nieuws")
    hierarchy = device.dump_hierarchy()
    if "Nieuwe Veldio wedstrijdbeelden" in hierarchy or "BEKIJK ALLE 10" in hierarchy:
        raise AssertionError("De losse beeldgalerij is nog zichtbaar")
    capture(device, "ado-sparta-kaart")
    observed = []
    for i in range(3):
        if i == 2:
            adb("shell", "am", "force-stop", PACKAGE)
            adb("shell", "am", "start", "-W", "-n", PACKAGE + "/" + ACTIVITY)
            if not card.wait(timeout=35):
                raise AssertionError("ADO–Sparta ontbreekt na app-herstart")
        card.click()
        cover = device(description="AI-illustratie bij " + headline)
        if not cover.wait(timeout=10):
            raise AssertionError("Goedgekeurd ADO–Sparta-beeld ontbreekt")
        capture(device, "ado-sparta-artikel-" + str(i + 1))
        entries = [line for line in adb("logcat", "-d", "-s", "VeldioArtwork:I").splitlines()
                   if "2cb1e3f7-fa9c-5615-a76d-65a1b0f2eb07" in line]
        if not entries:
            raise AssertionError("Geen artikelbeeldselectie gelogd")
        observed.append(entries[-1].split("2cb1e3f7-fa9c-5615-a76d-65a1b0f2eb07 ", 1)[1].split()[0])
        device(description="Terug naar de vorige pagina").click()
    if len(set(observed)) != len(observed):
        raise AssertionError("Heropening of herstart koos opnieuw hetzelfde beeld: " + str(observed))
    return observed


def news_cover_inventory(device):
    url = "https://voetbalhub-redactie.onrender.com/articles"
    with urllib.request.urlopen(url, timeout=25) as response:
        articles = json.load(response)["articles"]
    def cover_descriptions(rows):
        return {("AI-illustratie bij " if row["imageReview"].get("generated") else "Afbeelding bij ")
                + row["headline"] for row in rows}

    def verify_visible(required):
        observed = set()
        for _ in range(24):
            tree = ET.fromstring(device.dump_hierarchy())
            observed.update(node.get("content-desc") for node in tree.iter("node"))
            if required <= observed:
                return
            device.swipe_ext("up", scale=0.56)
        raise AssertionError("Published articles missing rendered Android images: " + repr(required - observed))

    news = cover_descriptions(row for row in articles if row.get("type") != "column")
    columns = cover_descriptions(row for row in articles if row.get("type") == "column")
    if not news:
        raise AssertionError("No published news to verify on Android")
    device(text="Nieuws").click()
    verify_visible(news)
    if columns:
        column_entry = device(text="De Derde Helft")
        for _ in range(8):
            if column_entry.wait(timeout=1):
                break
            device.swipe_ext("up", scale=0.6)
        else:
            raise AssertionError("Column navigation missing")
        column_entry.click()
        verify_visible(columns)
    return len(news) + len(columns)

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
        "versionCode='100'",
        "versionName='4.60'",
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

    variants = artwork_rotation(device)
    checks.append("ADO–Sparta article-card and reader screenshots; three distinct variants across reopen and app restart")
    rendered_news = news_cover_inventory(device)
    checks.append(f"Rendered Android covers for all {rendered_news} current articles and columns")

    log = adb("logcat", "-d", "-t", "2000")
    if re.search(r"FATAL EXCEPTION:[\s\S]{0,600}Process: " + re.escape(PACKAGE), log):
        raise AssertionError("Veldio crashed during the smoke test")
    checks.append("No Veldio fatal exception during launch")

    report = {
        "status": "PASS",
        "apk": str(APK),
        "package": PACKAGE,
        "version": "4.60",
        "androidApi": 36,
        "checks": checks,
        "adoVariants": variants,
        "renderedNewsCovers": rendered_news,
        "limits": [
            "Android emulator, not a physical Samsung S23",
            "Reader coverage includes Heerenveen–Feyenoord and ADO–Sparta",
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
