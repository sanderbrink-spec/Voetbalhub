#!/usr/bin/env python3
"""Assert every reviewed match image is present with unchanged bytes in the built APK."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-apk-match-artwork68.py <apk>")
root = Path(__file__).resolve().parents[1]
rows = json.loads((root / "image-library49.json").read_text(encoding="utf-8"))["assets"]
approved = [a for a in rows if a["approval"] == "approved"
            and a["file"].startswith("public/match-rotations65/")
            and len(a["clubs"]) == 2
            and a["rights"] == "original-ai"]
if len(approved) < 10:
    raise SystemExit(f"Not enough reviewed original images: {len(approved)}")
with zipfile.ZipFile(sys.argv[1]) as apk:
    for asset in approved:
        name = "assets/match-rotations65/" + Path(asset["file"]).name
        try:
            content = apk.read(name)
        except KeyError as exc:
            raise SystemExit(f"Missing offline image in APK: {name}") from exc
        if hashlib.sha256(content).hexdigest() != asset["sha256"]:
            raise SystemExit(f"Incorrect APK image digest: {name}")
print(f"PASS: {len(approved)} reviewed match images packaged byte-for-byte in APK.")
