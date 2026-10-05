from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import copy, json, hashlib, zipfile

P=Path(__file__).resolve().parent
ANIMATION='Comedy/06_idle_jump_4_ao_hoa'
PROJECT='char_ss_test_dressed_jump4.spine'
SKIN='Comedy/Ao_hoa_quan_short'

def prepare():
    source=json.loads((P/'current_export/Character.json').read_text())
    data=copy.deepcopy(source)
    data['animations'][ANIMATION]=copy.deepcopy(source['animations']['Final/idle_jump_4'])
    data['skeleton']['images']='./images/'
    assert all(data['animations'][k]==v for k,v in source['animations'].items())
    (P/'Character_funny_jump4.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    settings=json.loads((P/'preview_png_settings.json').read_text())
    settings.update(input=str(P/PROJECT),output=str(P/'qa_jump4')+'/',animation=ANIMATION,
                    skinType='single',skin=SKIN,scale=50,fps=30,lastFrame=True)
    (P/'qa_jump4').mkdir(exist_ok=True)
    (P/'qa_jump4_original').mkdir(exist_ok=True)
    (P/'export_jump4.json').write_text(json.dumps(settings,indent=2),encoding='utf-8')
    original={**settings,'animation':'Final/idle_jump_4','output':str(P/'qa_jump4_original')+'/'}
    (P/'export_jump4_original.json').write_text(json.dumps(original,indent=2),encoding='utf-8')
    print('Added',ANIMATION,'as an exact copy of Final/idle_jump_4')

def package():
    source=json.loads((P/'current_export/Character.json').read_text())
    final=json.loads((P/'verified_jump4/Character.json').read_text())
    assert final['animations'][ANIMATION]==source['animations']['Final/idle_jump_4']
    assert all(final['animations'][k]==v for k,v in source['animations'].items())
    assert source['bones']==final['bones'] and source.get('ik')==final.get('ik')
    def canonical_skins(skins):
        skins=copy.deepcopy(skins)
        for s in skins:
            for atts in s.get('attachments',{}).values():
                for att in atts.values():
                    if 'triangles' in att:
                        ts=att['triangles']
                        att['triangles']=sorted(min(tuple(ts[i:i+3][j:]+ts[i:i+3][:j]) for j in range(3))
                                                for i in range(0,len(ts),3))
        return skins
    # The editor may reorder triangles without changing topology or winding.
    assert canonical_skins(source['skins'])==canonical_skins(final['skins'])
    frames=sorted((P/'qa_jump4').glob('*.png'))
    originals=sorted((P/'qa_jump4_original').glob('*.png'))
    assert frames and len(frames)==len(originals)
    for a,b in zip(frames,originals):
        ai=Image.open(a).convert('RGBA'); bi=Image.open(b).convert('RGBA')
        assert ai.size==bi.size and ai.tobytes()==bi.tobytes(),(a.name,b.name)
    bg=(246,239,222); rendered=[]
    for f in frames:
        src=Image.open(f).convert('RGBA'); im=Image.new('RGB',src.size,bg); im.paste(src,(0,0),src)
        rendered.append(im)
    rendered[0].save(P/'preview_06_idle_jump_4_ao_hoa.gif',save_all=True,append_images=rendered[1:],
                     duration=[33 if i%3!=2 else 34 for i in range(len(rendered))],loop=0,optimize=True)
    board=Image.new('RGB',(1440,650),bg); dr=ImageDraw.Draw(board)
    font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',25)
    small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
    dr.text((26,22),'ÁO HOA • DIỄN HOẠT FINAL/IDLE_JUMP_4',font=font,fill=(57,59,65))
    for i,index in enumerate([0,7,15,23,30]):
        im=Image.open(frames[min(index,len(frames)-1)]).convert('RGBA'); im.thumbnail((278,490))
        board.paste(im,(i*288+(288-im.width)//2,90),im)
        dr.text((i*288+24,596),f'{index/30:.2f} s',font=small,fill=(82,83,90))
    board.save(P/'preview_jump4.png')
    report=json.loads((P/'validation.json').read_text())
    report['new_animations']=[k for k in final['animations'] if k.startswith('Comedy/')]
    report['jump4_animation']=ANIMATION
    report['jump4_timelines_identical_to_original']=True
    report['previous_29_animations_identical']=True
    report['jump4_rendered_frames']=len(frames)
    report['jump4_frames_identical_to_original_on_outfit_skin']=True
    report['project_sha256']=hashlib.sha256((P/PROJECT).read_bytes()).hexdigest()
    (P/'validation_jump4.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    previous=(P/'HUONG_DAN.txt').read_text(encoding='utf-8-sig')
    instructions=previous.replace('char_ss_test_dressed.spine',PROJECT)
    instructions=instructions.replace('Comedy/05_doi_bieu_cam    — lần lượt đổi qua bốn biểu cảm',
        'Comedy/05_doi_bieu_cam    — lần lượt đổi qua bốn biểu cảm\n'
        'Comedy/06_idle_jump_4_ao_hoa — giống toàn bộ diễn hoạt Final/idle_jump_4, mặc áo hoa')
    instructions+='\nBản trước khi thêm jump_4: char_ss_test_dressed_before_jump4.spine.\n'
    (P/'HUONG_DAN_jump4.txt').write_text(instructions,encoding='utf-8-sig')
    with zipfile.ZipFile(P/'char_ss_test_dressed_jump4_package.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in [P/PROJECT,P/'HUONG_DAN_jump4.txt',P/'validation_jump4.json',P/'preview.png',
                  P/'preview_jump4.png',*P.glob('preview_*.gif')]: z.write(f,f.name)
        z.write(P/'char_ss_test_dressed.spine','char_ss_test_dressed_before_jump4.spine')
        for folder in ('images','original'):
            for f in (P/folder).rglob('*'):
                if f.is_file(): z.write(f,str(f.relative_to(P)))
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    import sys
    prepare() if len(sys.argv)==1 or sys.argv[1]=='prepare' else package()
