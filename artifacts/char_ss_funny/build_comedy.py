from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np
import math, json, copy, hashlib

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'original' / 'New folder (8)'
OUT = ROOT / 'images' / 'Comedy'
OUT.mkdir(parents=True, exist_ok=True)
S = 3

def canvas(w, h):
    return Image.new('RGBA', (w*S, h*S))

def curve(points, steps=24):
    out=[]; pos=(0,0); start=pos
    for c in points:
        if c[0]=='M': pos=c[1:]; start=pos; out.append(pos)
        elif c[0]=='L': pos=c[1:]; out.append(pos)
        elif c[0] in ('C','Q'):
            p0=np.array(pos); vs=[np.array(c[i:i+2]) for i in range(1,len(c),2)]
            for t in np.linspace(0,1,steps)[1:]:
                if c[0]=='C': p=(1-t)**3*p0+3*(1-t)**2*t*vs[0]+3*(1-t)*t*t*vs[1]+t**3*vs[2]
                else: p=(1-t)**2*p0+2*(1-t)*t*vs[0]+t*t*vs[1]
                out.append(tuple(p))
            pos=tuple(vs[-1])
        elif c[0]=='Z': out.append(start); pos=start
    return [(round(x*S),round(y*S)) for x,y in out]

def path(im, commands, fill, stroke=None, width=1):
    dr=ImageDraw.Draw(im); pts=curve(commands)
    if fill is not None: dr.polygon(pts, fill=fill)
    if stroke is not None: dr.line(pts,fill=stroke,width=round(width*S),joint='curve')

def line(im, commands, color, width=1): path(im,commands,None,color,width)
def ellipse(im, box, fill, outline=None, width=1):
    ImageDraw.Draw(im).ellipse(tuple(round(v*S) for v in box), fill=fill, outline=outline,width=round(width*S))
def rounded(im, box, r, fill, outline=None, width=1):
    ImageDraw.Draw(im).rounded_rectangle(tuple(round(v*S) for v in box),r*S,fill,outline,width=round(width*S))

def gradient(w,h,color,style='cloth'):
    yy,xx=np.mgrid[0:h*S,0:w*S].astype(float); xx/=S; yy/=S
    if style=='cloth': shade=.73+.28*np.sin(np.pi*np.clip(xx/w,0,1))+.045*np.cos(yy/95)
    else: shade=.68+.34*np.sin(np.pi*np.clip(xx/w,0,1))+.06*(1-yy/h)
    rgba=np.zeros((h*S,w*S,4),dtype=np.uint8)
    for j,k in enumerate(color): rgba[:,:,j]=np.clip(k*shade,0,255)
    rgba[:,:,3]=255
    return Image.fromarray(rgba)

def clipped(base, layer, mask):
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'),mask))
    base.alpha_composite(layer)

def flower(im,x,y,r=16):
    # Cream hibiscus/daisy motif, with a teal pair of leaves.
    path(im,[('M',x+5,y+9),('Q',x+18,y+24,x+30,y+17),('Q',x+22,y+7,x+5,y+9)],'#175b59')
    path(im,[('M',x-5,y+8),('Q',x-23,y+18,x-27,y+4),('Q',x-16,y+0,x-5,y+8)],'#27706b')
    for a in range(5):
        t=2*math.pi*a/5-math.pi/2; cx=x+math.cos(t)*r*.63; cy=y+math.sin(t)*r*.63
        ellipse(im,(cx-r*.53,cy-r*.53,cx+r*.53,cy+r*.53),'#fff0cd')
    ellipse(im,(x-r*.24,y-r*.24,x+r*.24,y+r*.24),'#e9b650')
    ellipse(im,(x-r*.09,y-r*.09,x+r*.09,y+r*.09),'#bd733a')

def save(im,name,size):
    result=im.resize(size,Image.Resampling.LANCZOS)
    if name in ('Pickle_Body','Pickle_Arm','Pickle_Thigh','Pickle_Feet'):
        result.putalpha(Image.open(SRC/(name+'.png')).convert('RGBA').getchannel('A'))
    result.save(OUT/(name+'.png'))

def body():
    original=Image.open(SRC/'Pickle_Body.png').convert('RGBA'); w,h=original.size
    im=original.resize((w*S,h*S),Image.Resampling.LANCZOS)
    shirt_mask=Image.new('L',im.size)
    path(shirt_mask,[('M',-5,360),('Q',65,352,104,378),('L',163,411),('L',222,378),('Q',272,352,334,360),('L',334,652),('Q',165,670,-5,652),('Z',)],255)
    shirt=gradient(w,h,(245,113,80))
    for x,y,r in [(37,410,18),(283,407,18),(84,463,21),(246,477,20),(29,531,17),(117,550,19),(292,553,20),(66,612,20),(237,617,19),(187,452,14)]: flower(shirt,x,y,r)
    # Front placket and a real folded collar rather than a printed neckline.
    path(shirt,[('M',152,418),('L',174,418),('L',178,650),('L',152,650),('Z',)],'#e56b51')
    line(shirt,[('M',156,432),('Q',159,526,156,642)],'#ffc29a',1.6)
    for y in (469,527,586):
        ellipse(shirt,(159,y-5,171,y+7),'#bc5948')
        ellipse(shirt,(158,y-7,170,y+5),'#ffdfaf')
        ellipse(shirt,(163,y-3,165,y-1),'#915346')
    path(shirt,[('M',103,375),('L',163,411),('L',129,444),('L',94,394),('Z',)],'#bd5845')
    path(shirt,[('M',105,368),('L',163,407),('L',131,434),('L',97,387),('Z',)],'#ffc5a0')
    path(shirt,[('M',222,375),('L',164,411),('L',198,444),('L',231,394),('Z',)],'#bd5845')
    path(shirt,[('M',220,368),('L',164,407),('L',196,434),('L',228,387),('Z',)],'#ffc5a0')
    # Small stitched patch pocket.
    path(shirt,[('M',225,506),('L',285,506),('L',282,550),('Q',255,567,228,550),('Z',)],'#e9674e')
    line(shirt,[('M',230,513),('L',280,513),('L',278,545),('Q',254,558,233,545),('L',230,513)],'#ffc099',1.5)
    line(shirt,[('M',224,506),('L',286,506)],'#b95343',3)
    clipped(im,shirt,shirt_mask)
    # Indigo shorts, waistband, orange drawstring, seams and hem.
    shorts_mask=Image.new('L',im.size); ImageDraw.Draw(shorts_mask).rectangle((0,642*S,w*S,h*S),fill=255)
    shorts=gradient(w,h,(76,76,130))
    path(shorts,[('M',0,642),('Q',165,663,329,642),('L',329,669),('Q',165,689,0,669),('Z',)],'#373a6a')
    line(shorts,[('M',5,653),('Q',165,674,325,653)],'#a4a0d0',2)
    line(shorts,[('M',47,686),('Q',35,723,16,736)],'#313760',4)
    line(shorts,[('M',281,686),('Q',294,724,312,736)],'#313760',4)
    line(shorts,[('M',163,684),('L',163,743),('Q',164,761,146,776)],'#363962',5)
    line(shorts,[('M',165,688),('L',167,742)],'#9294bd',1.4)
    for x in (74,254): line(shorts,[('M',x-45,756),('Q',x,773,x+43,760)],'#b2a7d8',3)
    line(shorts,[('M',163,667),('C',130,643,128,680,162,673),('C',192,644,201,680,164,673)],'#f4b95c',4)
    line(shorts,[('M',160,674),('Q',150,700,157,710)],'#f4b95c',4)
    line(shorts,[('M',166,674),('Q',180,697,176,715)],'#f4b95c',4)
    clipped(im,shorts,shorts_mask)
    im.putalpha(original.getchannel('A').resize(im.size,Image.Resampling.LANCZOS))
    save(im,'Pickle_Body',(w,h))

def limbs():
    for name in ('Pickle_Arm','Pickle_Thigh','Pickle_Feet'):
        original=Image.open(SRC/(name+'.png')).convert('RGBA'); w,h=original.size
        im=original.resize((w*S,h*S),Image.Resampling.LANCZOS)
        mask=Image.new('L',im.size)
        if name=='Pickle_Arm':
            path(mask,[('M',0,0),('L',w,0),('L',w,h),('L',91,h),('L',0,47),('Z',)],255)
            fabric=gradient(w,h,(245,113,80)); flower(fabric,91,25,12); flower(fabric,55,71,12)
            line(fabric,[('M',0,47),('L',91,138)],'#b65b4d',7)
            line(fabric,[('M',0,43),('L',95,138)],'#ffd3aa',2)
        elif name=='Pickle_Thigh':
            ImageDraw.Draw(mask).rectangle((0,0,w*S,74*S),fill=255)
            fabric=gradient(w,h,(77,77,133))
            rounded(fabric,(-5,61,w+5,77),3,'#9a92c0')
            line(fabric,[('M',4,63),('L',w-4,63)],'#ddd0e7',1)
            line(fabric,[('M',8,2),('L',8,59)],'#ac9ec8',1)
        else:
            mask=original.getchannel('A').resize(im.size,Image.Resampling.LANCZOS)
            fabric=gradient(w,h,(255,231,192),'shoe')
            path(fabric,[('M',0,32),('Q',46,45,92,31),('L',92,55),('L',0,55),('Z',)],'#f4bf64')
            line(fabric,[('M',2,34),('Q',45,47,90,33)],'#674d50',2.3)
            path(fabric,[('M',2,16),('Q',17,5,27,12),('L',21,31),('L',0,29),('Z',)],'#ed7957')
            for x,y in [(36,18),(45,15),(54,13)]: line(fabric,[('M',x-5,y-4),('L',x+4,y+5)],'#fffbed',3)
            line(fabric,[('M',68,13),('Q',79,17,83,24)],'#fff9df',2)
        clipped(im,fabric,mask)
        im.putalpha(original.getchannel('A').resize(im.size,Image.Resampling.LANCZOS))
        save(im,name,(w,h))

def eyes():
    original=Image.open(SRC/'Pickle_Eye.png').convert('RGBA')
    for side in ('L','R'):
        im=original.resize((184*S,184*S),Image.Resampling.LANCZOS)
        lid=canvas(184,184)
        if side=='L':
            path(lid,[('M',-5,-5),('L',189,-5),('L',189,83),('Q',105,105,-5,48),('Z',)],'#179700')
            line(lid,[('M',9,56),('Q',94,103,177,87)],'#22651e',5)
            line(lid,[('M',29,23),('Q',87,9,144,38)],'#184e26',9)
        else:
            path(lid,[('M',-5,-5),('L',189,-5),('L',189,48),('Q',79,105,-5,83),('Z',)],'#169300')
            line(lid,[('M',7,87),('Q',90,103,177,56)],'#22651e',5)
            line(lid,[('M',33,36),('Q',88,10,150,24)],'#184e26',9)
        lid.putalpha(ImageChops.multiply(lid.getchannel('A'),im.getchannel('A'))); im.alpha_composite(lid)
        save(im,'Eye_Smug_'+side,(184,184))
        im=original.resize((184*S,184*S),Image.Resampling.LANCZOS)
        line(im,[('M',27,105),('Q',88,41,158,109)],'#24472b',10)
        line(im,[('M',40,126),('Q',51,113,62,113)],'#719579',3)
        line(im,[('M',125,115),('Q',139,118,144,133)],'#719579',3)
        save(im,'Eye_Laugh_'+side,(184,184))
    im=canvas(50,50)
    ellipse(im,(1,1,49,49),'#244b32'); ellipse(im,(5,5,43,43),'#31563b')
    ellipse(im,(11,8,20,17),'#dcebc3'); ellipse(im,(29,30,33,34),'#80a16b')
    save(im,'Pupil',(50,50))

def mouths():
    im=canvas(184,108)
    outer=[('M',7,24),('C',11,8,31,11,49,18),('Q',92,34,135,14),('C',152,4,177,11,179,28),('C',181,63,153,92,104,96),('C',52,98,13,78,7,44),('Z',)]
    path(im,outer,'#633628'); path(im,[('M',7,20),('C',11,4,31,7,49,14),('Q',92,30,135,10),('C',152,0,177,7,179,24),('C',181,59,153,88,104,92),('C',52,94,13,74,7,40),('Z',)],'#df5b24')
    inner=[('M',19,25),('Q',55,42,88,39),('Q',133,38,164,21),('C',164,51,148,70,115,78),('C',64,93,25,72,19,25),('Z',)]
    path(im,inner,'#572b38')
    # Big mismatched buck teeth; their shape is the joke.
    path(im,[('M',46,36),('L',85,40),('L',84,68),('Q',63,73,48,66),('Z',)],'#bb9680')
    path(im,[('M',48,34),('L',83,38),('L',81,64),('Q',66,69,50,63),('Z',)],'#fff3d6')
    path(im,[('M',89,39),('L',124,34),('L',122,61),('Q',104,70,90,64),('Z',)],'#bc967f')
    path(im,[('M',91,37),('L',121,33),('L',119,59),('Q',105,65,92,61),('Z',)],'#fff9e0')
    ellipse(im,(118,63,150,83),'#ec7380'); line(im,[('M',130,69),('Q',137,75,137,83)],'#b94d68',2)
    line(im,[('M',18,19),('Q',30,13,44,22)],'#ffad66',3)
    line(im,[('M',143,12),('Q',162,4,171,20)],'#ffad66',3)
    save(im,'Mouth_Grin',(184,108))

    im=canvas(180,164)
    ellipse(im,(7,9,173,159),'#633626'); ellipse(im,(7,3,173,153),'#df5d27')
    ellipse(im,(22,16,158,137),'#572b3b')
    path(im,[('M',33,28),('Q',92,9,146,29),('L',139,51),('Q',86,37,38,50),('Z',)],'#fff1d7')
    line(im,[('M',87,24),('L',87,43)],'#c5ab98',2)
    ellipse(im,(45,94,142,139),'#f47d89'); ellipse(im,(68,96,133,121),'#ff9e9b')
    line(im,[('M',99,101),('Q',103,116,100,133)],'#c6586c',3)
    line(im,[('M',25,26),('Q',36,10,57,10)],'#ffae69',4)
    save(im,'Mouth_Laugh',(180,164))

    im=canvas(182,164)
    path(im,[('M',10,24),('C',22,4,54,9,78,21),('Q',106,28,136,11),('C',160,-1,178,15,174,45),('C',166,83,117,100,77,84),('C',40,85,7,60,10,24),('Z',)],'#653727')
    path(im,[('M',10,19),('C',22,-1,54,4,78,16),('Q',106,23,136,6),('C',160,-6,178,10,174,40),('C',166,78,117,95,77,79),('C',40,80,7,55,10,19),('Z',)],'#e7652b')
    path(im,[('M',23,25),('Q',71,43,111,29),('Q',140,17,160,21),('C',160,50,125,72,84,68),('C',53,69,30,54,23,25),('Z',)],'#5a2c3d')
    path(im,[('M',39,29),('L',67,35),('L',63,58),('Q',49,62,41,54),('Z',)],'#fff5dc')
    path(im,[('M',90,61),('C',111,48,136,54,140,81),('L',146,119),('C',154,160,95,170,84,128),('L',74,95),('C',67,73,72,64,90,61),('Z',)],'#b54764')
    path(im,[('M',90,56),('C',111,43,134,51,138,77),('L',142,117),('C',149,150,99,161,89,125),('L',78,91),('C',72,70,76,60,90,56),('Z',)],'#f0808d')
    line(im,[('M',105,61),('Q',104,94,120,132)],'#c04f70',3)
    line(im,[('M',84,81),('Q',84,105,94,119)],'#ffb7a7',4)
    line(im,[('M',20,16),('Q',38,6,55,15)],'#ffb06c',3)
    save(im,'Mouth_Tongue',(182,164))

def build_skeleton():
    data=json.loads((ROOT/'source_export/Character.json').read_text())
    normal=next(s for s in data['skins'] if s['name']=='Pickle/Normal')
    comedy=copy.deepcopy(normal); comedy['name']='Comedy/Ao_hoa_quan_short'
    for slot,atts in comedy['attachments'].items():
        for key,att in atts.items():
            old=att.get('path',att.get('name',key))
            if old in ('Pickle_Body','Pickle_Arm','Pickle_Thigh','Pickle_Feet'):
                att['path']='Comedy/'+old
    ca=comedy['attachments']
    # These regional offsets use the existing face bones, whose local Y is screen X.
    for slot,x,y in [('R_Eye3',19.5,-58.62),('R_Eye4',-40.57,66.36)]:
        ca[slot]['R_Eye'].update(path='Comedy/Pupil',x=x,y=y)
        ca[slot]['Comedy_Center']=copy.deepcopy(ca[slot]['R_Eye'])
        ca[slot]['Comedy_Center'].update(x=x,y=(-20.62 if slot=='R_Eye3' else 28.36))
    for slot,side in [('eyewhite3','L'),('eyewhite4','R')]:
        for typ in ('Smug','Laugh'):
            ca[slot]['Comedy_'+typ]={'path':'Comedy/Eye_'+typ+'_'+side,'rotation':-90.45,'width':184,'height':184}
    mouth=copy.deepcopy(ca['Mouth']['Mouth'])
    for name,w,h,drop in [('Grin',184,108,0),('Laugh',180,164,-15),('Tongue',182,164,-24)]:
        ca['Mouth']['Comedy_'+name]={**mouth,'path':'Comedy/Mouth_'+name,'width':w,'height':h,'x':mouth.get('x',0)+drop}
    ca['Mouth']['Mouth']=copy.deepcopy(ca['Mouth']['Comedy_Grin'])
    data['skins'].insert(1,comedy)
    # Each expression is a separate looping animation and can be applied on a track.
    def face_slots(mood):
        white={'Grin':'eyewhite3','Laugh':'Comedy_Laugh','Tongue':'eyewhite3','Smug':'Comedy_Smug'}[mood]
        m='Comedy_'+('Grin' if mood=='Smug' else mood)
        pupil=None if mood=='Laugh' else ('R_Eye' if mood in ('Grin','Tongue') else 'Comedy_Center')
        return {k:{'attachment':[{'name':v}]} for k,v in {
            'body':'body','Mouth':m,'Mouth6':None,'EyeWhite':None,
            'Pickle_EyeBall_SD':None,'Pickle_EyeBall_SD2':None,
            'eyewhite3':white,'eyewhite4':white,'R_Eye3':pupil,'R_Eye4':pupil,
            'Pickle_Tounge':None,'Tongue1':None}.items()}
    def anim(mood):
        a={'slots':face_slots(mood),'bones':{}}
        def seq(vals,key='value'):
            return [{**({'time':i*.4} if i else {}),key:v} for i,v in enumerate(vals)]
        a['bones']['body']={'rotate':seq([0,-1.5,1.5,-1.5,0])}
        a['bones']['body2']={'rotate':seq([0,1.3,-1.3,1.3,0])}
        a['bones']['wood']={'rotate':seq([0,-8,5,-8,0])}
        a['bones']['wood2']={'rotate':seq([0,-6,9,-6,0])}
        if mood=='Laugh':
            a['bones']['bone']={'translate':[{'y':0},{'time':.2,'y':10},{'time':.4,'y':0},{'time':.6,'y':10},{'time':.8,'y':0},{'time':1,'y':10},{'time':1.2,'y':0},{'time':1.4,'y':10},{'time':1.6,'y':0}]}
            a['bones']['body5']={'scale':[{'x':1,'y':1},{'time':.2,'x':1.07,'y':.95},{'time':.4,'x':1,'y':1},{'time':.6,'x':1.07,'y':.95},{'time':.8,'x':1,'y':1},{'time':1.2,'x':1.06,'y':.96},{'time':1.6,'x':1,'y':1}]}
        if mood=='Tongue':
            a['bones']['body5']={'rotate':seq([0,5,-5,5,0])}
            a['bones']['L_Arm']={'rotate':seq([0,14,7,14,0])}
            a['bones']['R_Arm']={'rotate':seq([0,-10,-3,-10,0])}
        if mood=='Smug':
            a['bones']['L_EyeWhite']={'scale':[{'x':1,'y':1},{'time':.8,'x':1.03,'y':.97},{'time':1.6,'x':1,'y':1}]}
        return a
    for name,mood in [('01_mat_le','Grin'),('02_cuoi_deu','Smug'),('03_le_luoi','Tongue'),('04_cuoi_ban_no','Laugh')]:
        data['animations']['Comedy/'+name]=anim(mood)
    reel={'slots':{},'bones':copy.deepcopy(anim('Grin')['bones'])}
    for t,mood in [(0,'Grin'),(1.6,'Smug'),(3.2,'Tongue'),(4.8,'Laugh'),(6.4,'Grin')]:
        for slot,timeline in face_slots(mood).items():
            reel['slots'].setdefault(slot,{'attachment':[]})['attachment'].append({'time':t,**timeline['attachment'][0]})
    reel['bones']['wood']={'rotate':[{'value':0},{'time':6.4,'value':0}]}
    data['animations']['Comedy/05_doi_bieu_cam']=reel
    # Spine resolves imported JSON image paths relative to the JSON file.
    data['skeleton']['images']='./images/'
    (ROOT/'Character_funny.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    source=json.loads((ROOT/'source_export/Character.json').read_text())
    assert all(data['animations'][k]==v for k,v in source['animations'].items())
    assert data['bones']==source['bones'] and data.get('ik')==source.get('ik')
    assert all(next(s for s in data['skins'] if s['name']==orig['name'])==orig for orig in source['skins'])
    # Verify every file and preserve the alpha silhouettes of the deforming outfit.
    missing=[]
    for skin in data['skins']:
        for slot,atts in skin.get('attachments',{}).items():
            for key,att in atts.items():
                if att.get('type','region') in ('region','mesh'):
                    name=att.get('path',att.get('name',key))
                    if not (ROOT/'images'/(name+'.png')).is_file(): missing.append(name)
    assert not missing,missing
    for name in ('Pickle_Body','Pickle_Arm','Pickle_Thigh','Pickle_Feet'):
        a=Image.open(SRC/(name+'.png')).convert('RGBA'); b=Image.open(OUT/(name+'.png')).convert('RGBA')
        assert a.size==b.size
        assert np.max(np.abs(np.array(a.getchannel('A')).astype(int)-np.array(b.getchannel('A')).astype(int)))<=1
    report={'source_sha256':hashlib.sha256((ROOT/'original/char_ss_test.spine').read_bytes()).hexdigest(),
        'original_animations_preserved':len(source['animations']), 'new_animations':[k for k in data['animations'] if k.startswith('Comedy/')],
        'original_skins_preserved':[s['name'] for s in source['skins']], 'new_skin':comedy['name'],
        'bones_unchanged':len(data['bones']),'ik_unchanged':len(data.get('ik',[])), 'missing_images':missing}
    (ROOT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    body(); limbs(); eyes(); mouths(); build_skeleton()
