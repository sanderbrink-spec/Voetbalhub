"""Scan uncompressed APK entries for recognizable private credential formats.
This detects embedded values, not server-side variable names. It is not a guarantee
against arbitrary, encrypted or previously unknown credential formats.
"""
import re,sys,zipfile,hashlib,json
PATTERNS={
 'Groq':rb'\bgsk_[A-Za-z0-9]{20,}\b',
 'OpenAI':rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b',
 'Resend':rb'\bre_[A-Za-z0-9_-]{24,}\b',
 'GitHub':rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b',
 'private_key':rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
}
def scan(path):
 findings=[]
 with zipfile.ZipFile(path) as apk:
  if apk.testzip():raise ValueError('APK ZIP integrity failure')
  for info in apk.infolist():
   if info.file_size>64*1024*1024:raise ValueError('Unreasonably large APK entry')
   data=apk.read(info)
   for kind,pattern in PATTERNS.items():
    if re.search(pattern,data):findings.append({'file':info.filename,'kind':kind})
 return findings
if __name__=='__main__':
 path=sys.argv[1];findings=scan(path)
 print(json.dumps({'apkSha256':hashlib.sha256(open(path,'rb').read()).hexdigest(),'credentialFindings':findings,'scope':'Known private credential patterns across every decompressed APK entry'}))
 sys.exit(1 if findings else 0)
