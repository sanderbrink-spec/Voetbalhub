"""Verify the versioned recovery source and the assets inside its compiled APK."""
from pathlib import Path
import hashlib,json,os,sys,zipfile
root=Path('android-project')
p=json.loads((root/'source-provenance.json').read_text())
def digest(data):return hashlib.sha256(data).hexdigest()
expected=set(p['files'])
actual={str(f.relative_to(root)) for f in root.rglob('*') if f.is_file() and not any(x in f.relative_to(root).parts for x in ('build','.gradle')) and f.name not in ('source-provenance.json','local.properties')}
assert actual==expected, f'Android source file set changed: {actual ^ expected}'
for name,sha in p['files'].items():
 assert digest((root/name).read_bytes())==sha, f'Android source differs from approved recovery: {name}'
assert p['asset_count']==len(p['assets'])
for name,sha in p.get('phase45_assets',{}).items():
 if name not in p.get('phase46_changed_assets',[]):assert p['assets'].get(name)==sha, f'Unplanned premium asset change: {name}'
for name,sha in p['assets'].items():
 assert digest((root/'app/src/main'/name).read_bytes())==sha, f'Phase43 asset mismatch: {name}'
main=(root/'app/src/main/java/nl/voetbalhub/app/MainActivity.java').read_text()
assert 'VeldioChrome.install(this)' in main
assert 'PremiumDesign40.polish' in main
if len(sys.argv)>1:
 apk=Path(sys.argv[1])
 with zipfile.ZipFile(apk) as z:
  assert set(n for n in z.namelist() if n.startswith('assets/') and not n.endswith('/'))==set(p['assets']), 'APK asset set changed'
  for name,sha in p['assets'].items():assert digest(z.read(name))==sha, f'APK asset mismatch: {name}'
 p.update(source_commit=os.environ.get('GITHUB_SHA','local'),apk_sha256=digest(apk.read_bytes()),legacy_archive_fallback=False)
 Path('Veldio-build-provenance.json').write_text(json.dumps(p,indent=2)+'\n')
print('PASS: versioned premium Android source and all versioned premium assets' + ('; compiled APK verified' if len(sys.argv)>1 else ''))
