"""Reuse full Android 16 navigation and persistence audit against phase42."""
from pathlib import Path
source=Path('scripts/android-audit41.py').read_text().replace('4.49-audit41','4.50-phase42')
source=source.replace("source=Path('scripts/android-premium40.py').read_text().replace('4.48-premium40','4.50-phase42')", "source=Path('scripts/android-premium40.py').read_text().replace('4.48-premium40','4.50-phase42').replace(\"Video's\",\"Samenvattingen\")")
exec(compile(source,'android-phase42-generated.py','exec'))
