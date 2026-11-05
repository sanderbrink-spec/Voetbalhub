"""Phase 51 UI acceptance on an Android 16 emulator at the S23 display size."""
import json
import re
import subprocess
import sys
from pathlib import Path

import uiautomator2 as u2

output = Path(".android-phase51")
output.mkdir(exist_ok=True)
apk = Path(sys.argv[1])
device = u2.connect()
subprocess.run(["adb", "install", "-r", str(apk)], check=True)
package = next(
    line.split(":", 1)[1].strip()
    for line in subprocess.check_output(
        ["adb", "shell", "pm", "list", "packages"], text=True
    ).splitlines()
    if re.fullmatch(r"package:nl\.voetbalhub\.(preview51|app1)", line.strip())
)
device.app_start(package, activity="nl.voetbalhub.app.MainActivity")
checks = []


def visible(title, timeout=25):
    target = device(text=title)
    assert target.wait(timeout=timeout), f"Missing {title}"
    return target


def tab(title):
    target = device(description=title)
    assert target.wait(timeout=15), f"Missing navigation button {title}"
    bounds = target.info["bounds"]
    assert bounds["right"] - bounds["left"] >= 132, title
    assert bounds["bottom"] - bounds["top"] >= 132, title
    target.click()


def capture(name):
    device.screenshot().save(str(output / (name + ".png")))


try:
    visible("Stadion van de Week")
    assert device(description="Nieuws").wait(timeout=15)
    capture("nieuws")
    tab("Wedstrijden")
    visible("Conference League", timeout=40)
    capture("wedstrijden")
    tab("Voorspellen")
    visible("Profiel verbinden")
    capture("voorspellen")
    tab("Mijn Clubs")
    visible("Mijn favoriete clubs")
    capture("mijn-clubs")
    tab("Meer")
    capture("meer")
    for title in ("Over Veldio", "Bronnen en beeldgebruik", "Advertentieprivacy", "App-instellingen"):
        target = device(scrollable=True)
        if not device(text=title).exists:
            target.scroll.to(text=title)
        visible(title).click()
        visible("Sluiten")
        capture(title.lower().replace(" ", "-"))
        device.press("back")
        assert device(text="Sluiten").wait_gone(timeout=10), title
    if not device(text="Voetbalquiz").exists:
        device(scrollable=True).scroll.to(text="Voetbalquiz")
    visible("Voetbalquiz").click()
    visible("Spelregels")
    capture("quizkeuze")
    device.press("back")
    visible("Bronnen en beeldgebruik")
    assert device(description="Meer").info["selected"]
    device.press("back")
    visible("Mijn favoriete clubs")
    assert device.app_current()["package"] == package
    checks.extend(["five tabs and 48dp targets", "four dialogs and system Back",
                   "quiz through More", "system Back from quiz and More"])
finally:
    capture("laatste-scherm")
    (output / "result.json").write_text(json.dumps({
        "package": package, "checks": checks, "status": "PASS" if checks else "FAIL"
    }, indent=2))
