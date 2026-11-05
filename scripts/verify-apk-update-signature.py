"""Require the baseline Android signing identity before offering an in-place APK update."""
import re,sys
from pathlib import Path

def certificate(filename):
 text=Path(filename).read_text()
 values=re.findall(r'Signer #\d+ certificate SHA-256 digest: ([0-9a-f]{64})',text)
 if not values:raise ValueError('No verified signer digest in '+filename)
 return set(values)

if __name__=='__main__':
 try:
  before,after=certificate(sys.argv[1]),certificate(sys.argv[2])
  if before!=after:raise ValueError('BLOCKED: signing certificate differs from the installed baseline. Preserve the existing app and recover its original signing key. A fresh-install test does not prove upgrade compatibility.')
  print('PASS: identical baseline and update signing certificates')
 except (ValueError,IndexError,OSError) as error:
  print(str(error),file=sys.stderr);sys.exit(1)
