"""Draw a precise editorial fixture graphic, without a baked-in headline or AI photo."""
import hashlib
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

STYLE_VERSION = 'fixture-graphic-v2'
CLUBS = ['FC Midtjylland', 'PEC Zwolle', 'FC Groningen', 'FC Den Bosch', 'Willem II',
         'Feyenoord', 'FC Twente', 'FC Utrecht', 'SC Heerenveen', 'Go Ahead Eagles',
         'Fortuna Sittard', 'Heracles Almelo', 'NAC Breda', 'Sparta Rotterdam',
         'Ajax', 'PSV', 'AZ', 'NEC', 'FC Emmen']

def teams_for(packet):
    headline = packet.get('draft', packet).get('headline', '')
    # Only names actually present in the checked headline. Their placement is not home/away.
    return [c for c in CLUBS if re.search(r'(?<!\w)' + re.escape(c) + r'(?!\w)', headline, re.I)][:2]

def render(packet, output):
    headline = packet.get('draft', packet).get('headline', '')
    seed = hashlib.sha256((STYLE_VERSION + headline).encode()).digest()
    base = (8 + seed[0] % 14, 22 + seed[1] % 16, 24 + seed[2] % 25)
    im = Image.new('RGB', (1600, 900), base)
    d = ImageDraw.Draw(im)
    # Topic-specific geometry and colour, with safe margins for feed thumbnails.
    accent = (100 + seed[3] % 100, 180 + seed[4] % 76, 65 + seed[5] % 120)
    for x in range(-900, 1800, 180):
        d.polygon([(x, 900), (x + 45, 900), (x + 945, 0), (x + 900, 0)], fill=tuple(v + 7 for v in base))
    d.ellipse((520, 170, 1080, 730), outline=tuple(v + 22 for v in base), width=3)
    d.line((800, 0, 800, 900), fill=tuple(v + 22 for v in base), width=3)
    fonts = Path('/usr/share/fonts/truetype/dejavu')
    def font(size): return ImageFont.truetype(str(fonts / 'DejaVuSans-Bold.ttf'), size)
    clubs = teams_for(packet)
    labels = clubs or [packet.get('category', 'Voetbal')]
    centers = [470, 1130] if len(labels) == 2 else [800]
    for label, cx in zip(labels, centers):
        # Editorial medallions, deliberately no fabricated club badges or kits.
        d.rounded_rectangle((cx-235, 270, cx+235, 610), radius=48, fill=base, outline=accent, width=3)
        words = label.split()
        initials = ''.join(w[0] for w in words if w.lower() not in ('fc', 'sc'))[:3].upper()
        f = font(112)
        d.text((cx, 410), initials, font=f, anchor='mm', fill='white')
        size = 42
        while d.textlength(label, font=font(size)) > 420 and size > 20: size -= 2
        d.text((cx, 540), label, font=font(size), anchor='mm', fill=accent)
    if len(labels) == 2:
        d.text((800, 440), '·', font=font(80), anchor='mm', fill=accent)
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    im.save(output, 'WEBP', quality=90, method=6)
    return hashlib.sha256(Path(output).read_bytes()).hexdigest()

if __name__ == '__main__':
    print(render(json.load(sys.stdin), sys.argv[1]))
