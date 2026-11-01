"""Original sport illustrations. Scores require an explicitly reviewed structured match."""
import hashlib,json,re,sys,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
STYLE_VERSION='veldio-editorial-v4'
CLUBS=['FC Midtjylland','PEC Zwolle','FC Groningen','FC Den Bosch','Willem II','Feyenoord','FC Twente','FC Utrecht','sc Heerenveen','Go Ahead Eagles','Fortuna Sittard','Heracles Almelo','NAC Breda','Sparta Rotterdam','Ajax','PSV','AZ','NEC','FC Emmen']
def teams_for(packet):
 headline=packet.get('draft',packet).get('headline','')
 return [c for c in CLUBS if re.search(r'(?<!\w)'+re.escape(c)+r'(?!\w)',headline,re.I)][:2]
def font(n):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',n)
def render(packet,output):
 headline=packet.get('draft',packet).get('headline','');seed=hashlib.sha256((STYLE_VERSION+headline).encode()).digest();im=Image.new('RGB',(1600,900));d=ImageDraw.Draw(im)
 for y in range(900):d.line((0,y,1600,y),fill=(5+int(12*(1-y/900)),12+int(26*(1-y/900)),9+int(17*(1-y/900))))
 theme='community' if re.search(r'maatschapp|beweeg|supporter|jeugd',headline,re.I) else 'transfer' if re.search(r'transfer|contract|tekent|vertrek',headline,re.I) else 'stadium'
 accent='#a9ff35' if theme=='community' else '#25f06b';teams=teams_for(packet);m=packet.get('match') or {};checks=packet.get('editorialChecks') or {}
 score=bool(m and all(checks.get(k) is True for k in ['originalSourceReviewed','claimsIndependentlyChecked','duplicateChecked','languageChecked']) and all(isinstance(m.get(k),int) and not isinstance(m[k],bool) and 0<=m[k]<=99 for k in ['homeScore','awayScore']) and all(m.get(k) for k in ['homeTeam','awayTeam','playedAt']))
 if score:
  teams=[m['homeTeam'],m['awayTeam']];theme='result'
 # An architectural illustration, deliberately no identifiable stadium, shirt or badge.
 for i in range(9):
  y=210+i*36;d.arc((-200,y-250,1800,y+420),0,180,fill=(25+i*2,55+i*2,36+i*2),width=20)
 for i in range(38):
  x=i*47-100;d.line((x,0,800+(x-800)*.6,500),fill=(30,65,43),width=2)
 d.polygon([(230,600),(1370,600),(1690,900),(-90,900)],fill='#0d3021');d.line((0,860,1600,860),fill='#397650',width=3);d.ellipse((510,605,1090,835),outline='#397650',width=3)
 if theme=='community':
  for i in range(7):
   x=400+i*135;y=400+(i%2)*60;d.ellipse((x-26,y-95,x+26,y-43),fill=accent if i%2 else '#dbece0');d.line((x,y-35,x,y+75),fill='#dbece0',width=22);d.line((x-55,y+5,x+55,y-10),fill=accent,width=16);d.line((x,y+65,x-40,y+145),fill='#dbece0',width=18);d.line((x,y+65,x+40,y+145),fill='#dbece0',width=18)
 elif theme=='transfer':
  d.rounded_rectangle((550,260,1050,650),30,fill='#10281d',outline=accent,width=4)
  for y in [360,420,480]:d.line((620,y,970,y),fill='#a1b5a8',width=8)
  d.line((620,570,950,570),fill=accent,width=14);d.polygon([(950,535),(1000,570),(950,605)],fill=accent)
 elif not score:
  d.ellipse((620,300,980,660),fill='#dbece0',outline='#557b65',width=10);cx,cy=800,480
  pts=[(cx+80*math.sin(i*math.pi*2/5),cy-80*math.cos(i*math.pi*2/5)) for i in range(5)];d.polygon(pts,fill='#0b2418')
  for x,y in pts:d.line((x,y,cx+(x-cx)*2.15,cy+(y-cy)*2.15),fill='#0b2418',width=8)
 d.text((90,65),'VELDIO',font=font(50),fill='white');d.text((1510,85),'EIGEN ILLUSTRATIE',font=font(22),fill='#b4c9bb',anchor='rm')
 if score:
  # Team labels and score occupy the centre safe area; no tiny embedded captions.
  for label,y in [(teams[0],280),(teams[1],630)]:
   size=84
   while d.textlength(label,font=font(size))>1360 and size>32:size-=2
   if d.textlength(label,font=font(size))>1360:raise ValueError('Clubnaam past niet binnen veilige beeldmarges')
   d.text((800,y),label,font=font(size),anchor='mm',fill='white',stroke_width=3,stroke_fill='#07180f')
  d.text((800,455),str(m['homeScore'])+' – '+str(m['awayScore']),font=font(220),anchor='mm',fill=accent,stroke_width=3,stroke_fill='#07180f')
 else:
  label='VOETBAL & BEWEGING' if theme=='community' else 'TRANSFER & CONTRACT' if theme=='transfer' else 'VOETBALNIEUWS'
  d.rounded_rectangle((80,725,1520,850),20,fill='#06150f');d.text((800,790),label,font=font(62),anchor='mm',fill=accent)
 Path(output).parent.mkdir(parents=True,exist_ok=True);im.save(output,'WEBP',quality=92,method=6)
 return hashlib.sha256(Path(output).read_bytes()).hexdigest()
if __name__=='__main__':print(render(json.load(sys.stdin),sys.argv[1]))
