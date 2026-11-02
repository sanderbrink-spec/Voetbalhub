import importlib.util,tempfile,unittest,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('scan',Path(__file__).resolve().parents[1]/'scripts/apk-secret-scan.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ApkScanTest(unittest.TestCase):
 def test_nested_asset_and_dex_credentials_are_detected_without_printing_values(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'test.apk'
   with zipfile.ZipFile(p,'w') as z:
    z.writestr('classes.dex',b'prefix gsk_'+b'A'*48+b' suffix')
    z.writestr('assets/settings.json',b'RESEND_API_KEY re_'+b'B'*32)
   self.assertEqual(m.scan(p),[{'file':'classes.dex','kind':'Groq'},{'file':'assets/settings.json','kind':'Resend'}])
 def test_server_setting_names_and_public_admob_ids_are_not_private_credentials(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'test.apk'
   with zipfile.ZipFile(p,'w') as z:z.writestr('classes.dex','GROQ_API_KEY RESEND_API_KEY ca-app-pub-3940256099942544/6300978111')
   self.assertEqual(m.scan(p),[])
