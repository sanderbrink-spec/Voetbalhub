import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('release_preflight',Path(__file__).resolve().parents[1]/'scripts/release-preflight.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
GOOD='''TEST_MODE=false; AUDIENCE_CONFIRMED=true; PRODUCTION_APPROVED=true; ACCOUNT_VERIFIED=true;
APP_ID="ca-app-pub-1234567890123456~1234567890";
HOME_UNIT="ca-app-pub-1234567890123456/1111111111";
READER_UNIT="ca-app-pub-1234567890123456/2222222222";'''
class ReleasePreflightTest(unittest.TestCase):
 def test_valid_format_does_not_claim_account_approval(self):self.assertEqual(gate.settings_issues(GOOD),[])
 def test_bad_configuration_is_refused(self):
  variants=[GOOD.replace('TEST_MODE=false','TEST_MODE=true'),GOOD.replace('ACCOUNT_VERIFIED=true','ACCOUNT_VERIFIED=false'),GOOD.replace('2222222222','1111111111'),GOOD.replace('~1234567890','/1234567890'),GOOD.replace('1234567890123456/222','9876543210987654/222'),GOOD.replace('1234567890123456','3940256099942544'),GOOD+'\nAPP_ID="extra";']
  for value in variants:
   with self.subTest(value=value):self.assertTrue(gate.settings_issues(value))
if __name__=='__main__':unittest.main()
