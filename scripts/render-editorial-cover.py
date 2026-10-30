"""Render exact article typography over the original AI football backdrop."""
import json,sys,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

def render(packet,output):
    root=Path(__file__).resolve().parents[1]
    im=Image.open(root/'public/editorial/football-background.webp').convert('RGB').resize((1600,900))
    shade=Image.new('RGBA',im.size)
    d=ImageDraw.Draw(shade)
    for x in range(1600):
        alpha=int(180*max(0,1-x/1500))
        d.line((x,0,x,900),fill=(3,9,10,alpha))
    im=Image.alpha_composite(im.convert('RGBA'),shade).convert('RGB')
    d=ImageDraw.Draw(im)
    fontroot=Path('/usr/share/fonts/truetype/dejavu')
    def font(size,bold=False):return ImageFont.truetype(str(fontroot/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')),size)
    d.text((80,58),'VOETBAL',font=font(46,True),fill='white')
    offset=d.textlength('VOETBAL',font=font(46,True))
    d.text((80+offset,58),'HUB',font=font(46,True),fill='#a6ff00')
    d.rectangle((80,130,160,138),fill='#a6ff00')
    category=packet.get('category','Voetbal').upper()[:45]
    d.text((80,200),category,font=font(25,True),fill='#a6ff00')
    headline=packet['draft']['headline']
    for size in range(76,45,-2):
        f=font(size,True);lines=[];line=''
        for word in headline.split():
            candidate=(line+' '+word).strip()
            if d.textlength(candidate,font=f)>1120 and line:lines.append(line);line=word
            else:line=candidate
        if line:lines.append(line)
        if len(lines)<=4:break
    if len(lines)>4 or any(d.textlength(line,font=f)>1120 for line in lines):raise ValueError('Headline does not fit')
    y=270
    for line in lines:d.text((80,y),line,font=f,fill='white',stroke_width=1);y+=size+15
    d.text((80,805),'EIGEN REDACTIE · AI-ILLUSTRATIE',font=font(23,True),fill='#d3dbd7')
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    im.save(output,'WEBP',quality=88,method=6)
    return hashlib.sha256(Path(output).read_bytes()).hexdigest()

if __name__=='__main__':
    print(render(json.load(sys.stdin),sys.argv[1]))
