"""Compatibility entry point. Standard article covers are registered photographs, never scoreboards."""
import json, subprocess, sys
from pathlib import Path
STYLE_VERSION='licensed-editorial-photo-v1'
def render(packet,output):
    root=Path(__file__).resolve().parents[1]
    result=subprocess.run(['node',str(root/'scripts/render-news-photo.js'),str(Path(output).resolve())],input=json.dumps(packet),text=True,capture_output=True,cwd=root)
    if result.returncode:raise ValueError(result.stderr.strip() or 'Geen vrijgegeven nieuwsbeeld')
    return result.stdout.strip()
if __name__=='__main__':print(render(json.load(sys.stdin),sys.argv[1]))
