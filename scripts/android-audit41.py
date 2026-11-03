"""Run all phase40 destination, offline and persistence checks against the phase41 APK."""
from pathlib import Path
source=Path('scripts/android-premium40.py').read_text().replace('4.48-premium40','4.49-audit41')
exec(compile(source,'android-audit41-generated.py','exec'))
