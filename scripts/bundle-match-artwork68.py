#!/usr/bin/env python3
"""Bundle reviewed source-controlled fixture artwork into the signed Android APK."""
import hashlib
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
rows = json.loads((root / "image-library49.json").read_text(encoding="utf-8"))["assets"]
approved = [a for a in rows if a["approval"] == "approved"
            and a["file"].startswith(("public/match-rotations65/", "public/article-art69/"))
            and a["rights"] == "original-ai"]
if len(approved) < 10 or len(approved) > 120:
    raise SystemExit(f"Expected 10 to 120 reviewed match images, got {len(approved)}")
asset_root = root / "android-project/app/src/main/assets"
for folder in ("match-rotations65", "article-art69"):
    destination = asset_root / folder
    destination.mkdir(parents=True, exist_ok=True)
    for old in destination.glob("*.webp"):
        old.unlink()
for asset in approved:
    source = root / asset["file"]
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != asset["sha256"]:
        raise SystemExit(f"Artwork SHA-256 mismatch: {asset['id']}")
    if len(data) > 2_000_000:
        raise SystemExit(f"Artwork exceeds size limit: {asset['id']}")
    shutil.copyfile(source, asset_root / source.parent.name / source.name)
print(f"Bundled {len(approved)} SHA-256-verified images for offline Android display.")
