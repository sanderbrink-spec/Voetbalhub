"""Check the packaged match timeline in an Android 16 WebView."""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from contextlib import closing

import uiautomator2
import websocket


def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, stderr=subprocess.STDOUT, timeout=90)


def evaluate(socket, expression):
    socket.send(json.dumps({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {"expression": expression, "returnByValue": True},
    }))
    while True:
        response = json.loads(socket.recv())
        if response.get("id") != 1:
            continue
        result = response["result"]
        assert "exceptionDetails" not in result, result
        return result["result"].get("value")


def destinations_socket(package):
    pid = adb("shell", "pidof", package).strip().split()[0]
    adb("forward", "tcp:9222", "localabstract:webview_devtools_remote_" + pid)
    for _ in range(40):
        with urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=3) as response:
            targets = json.load(response)
        for target in targets:
            if "destinations39.html" in target.get("url", ""):
                return websocket.create_connection(target["webSocketDebuggerUrl"], timeout=10, suppress_origin=True)
        time.sleep(0.25)
    raise AssertionError("Wedstrijden WebView ontbreekt")


assert adb("shell", "getprop", "ro.build.version.sdk").strip() == "36"
package = "nl.voetbalhub.app1"
adb("install", "-r", sys.argv[1])
adb("shell", "am", "start", "-W", "-n", package + "/nl.voetbalhub.app.MainActivity")
device = uiautomator2.connect()
matches = device(text="Wedstrijden")
assert matches.wait(timeout=25), "Wedstrijdnavigatie ontbreekt"
matches.click()
with closing(destinations_socket(package)) as socket:
    for _ in range(40):
        if evaluate(socket, "document.readyState === 'complete' && typeof window.setData === 'function'"):
            break
        time.sleep(0.25)
    else:
        raise AssertionError("Wedstrijden WebView is niet klaar")
    result = evaluate(socket, """
    (() => {
      const now = Date.now();
      const fixture = {
        id:'android-timeline', home:{name:'FC Groningen'}, away:{name:'Ajax'},
        date:new Date(now-60000).toISOString(), round:'5.Spieltag', status:'FT',
        goals:{home:1,away:0}, eventCoverage:'sportmonks',
        matchEvents:[
          {kind:'own_goal',minute:45,extra:2,side:'away',player:'Speler Een',score:'1 – 0'},
          {kind:'yellow_card',minute:51,side:'away',player:'Speler Twee'},
          {kind:'second_yellow',minute:67,side:'away',player:'Speler Twee'},
          {kind:'red_card',minute:88,side:'home',player:'Speler Drie'},
          {kind:'substitution',minute:90,extra:3,side:'home',player:'Speler Vier',relatedPlayer:'Speler Vijf'}
        ]
      };
      const sample = {mode:'fixtures',competition:'eredivisie',stats:{
        schemaVersion:1,rightsPolicyVersion:26,rightsExpiresAt:now+86400000,
        updatedAt:new Date(now).toISOString(),league:{id:88,name:'Eredivisie',season:2026},
        fixtures:[fixture],standings:[]
      }};
      setData(JSON.stringify(sample));
      const details = document.querySelector('.fixture-expand88');
      const summary = details.querySelector('summary');
      summary.click();
      const round = document.querySelector('#round50');
      const rendered = {
        open:details.open,
        label:round.selectedOptions[0].textContent,
        value:round.value,
        rows:details.querySelectorAll('.event-line88').length,
        icons:details.querySelectorAll('h3 svg').length,
        minute:details.querySelector('[data-event-kind=substitution] .event-minute88').textContent,
        outgoing:details.querySelector('.event-out88').nextElementSibling.textContent,
        noOverflow:document.documentElement.scrollWidth<=innerWidth,
        target:summary.getBoundingClientRect().height>=44
      };
      setData(JSON.stringify(sample));
      const restored = document.querySelector('.fixture-expand88');
      rendered.restored = restored.open;
      restored.querySelector('summary').click();
      rendered.closed = !restored.open;
      return rendered;
    })()
    """)
    assert result == {
        "open": True, "label": "Speelronde 5", "value": "5.Spieltag", "rows": 5,
        "icons": 3, "minute": "90+3′", "outgoing": "Speler Vijf", "noOverflow": True,
        "target": True, "restored": True, "closed": True,
    }, result

out = Path(".android-smoke")
out.mkdir(exist_ok=True)
(out / "match-events-api36.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print("PASS: packaged Android 16 WebView timeline, round label and expand/collapse")
