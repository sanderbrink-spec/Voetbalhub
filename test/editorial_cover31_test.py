import unittest,importlib.util,tempfile
from pathlib import Path
from PIL import Image
spec=importlib.util.spec_from_file_location('cover',Path(__file__).parents[1]/'scripts/render-editorial-cover.py');cover=importlib.util.module_from_spec(spec);spec.loader.exec_module(cover)
class Covers(unittest.TestCase):
 def test_subject_variation_and_safe_geometry(self):
  with tempfile.TemporaryDirectory() as tmp:
   outputs=[]
   for name in ['PSV wint van Willem II','FC Groningen koppelt duel met Sparta aan maatschappelijk programma','Ajax wint van AZ']:
    p=Path(tmp)/(str(len(outputs))+'.webp');cover.render({'headline':name},p)
    with Image.open(p) as im:self.assertGreaterEqual(im.width,1280);self.assertGreaterEqual(im.height,720);self.assertAlmostEqual(im.width/im.height,16/9,places=2);self.assertEqual(im.format,'WEBP')
    outputs.append(p.read_bytes())
   self.assertEqual(len(set(outputs)),3)
 def test_unreviewed_score_is_never_rendered(self):
  with tempfile.TemporaryDirectory() as tmp:
   p,q=Path(tmp)/'a.webp',Path(tmp)/'b.webp';packet={'headline':'Ajax wint','match':{'homeTeam':'Ajax','awayTeam':'AZ','homeScore':9,'awayScore':9,'playedAt':'2026-11-01'}}
   cover.render(packet,p);packet.pop('match');cover.render(packet,q);self.assertEqual(p.read_bytes(),q.read_bytes())
