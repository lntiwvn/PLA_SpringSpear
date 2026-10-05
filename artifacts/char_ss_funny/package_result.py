from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json, zipfile, hashlib

P=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',24)
label_font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
bg=(246,239,222)
groups={}
for f in sorted((P/'qa_frames').glob('*.png')):
    groups.setdefault(f.name.rsplit('_',1)[0],[]).append(f)

board=Image.new('RGB',(1440,670),bg); dr=ImageDraw.Draw(board)
labels=['MẮT LÉ • RĂNG HÔ','CƯỜI ĐỂU','LÈ LƯỠI','CƯỜI BANH NÓC']
dr.text((28,620),'Skin: Comedy/Ao_hoa_quan_short   |   Spine 4.2.43',font=label_font,fill=(82,82,89))
for i,(name,frames) in enumerate(list(groups.items())[:4]):
    text_width=dr.textlength(labels[i],font=font)
    dr.text((i*360+(360-text_width)//2,30),labels[i],font=font,fill=(59,59,67))
    im=Image.open(frames[0]).convert('RGBA')
    im=im.resize((round(im.width*.94),round(im.height*.94)),Image.Resampling.LANCZOS)
    board.paste(im,(i*360+(360-im.width)//2,99),im)
board.save(P/'preview.png')

# A real animated preview made from the frames rendered by Spine.
for name,frames in groups.items():
    suffix=name.split('-Comedy-')[-1]
    destination=P/('preview_'+suffix+'.gif')
    if destination.is_file() and destination.stat().st_size>0:
        continue
    rendered=[]
    for f in frames:
        src=Image.open(f).convert('RGBA')
        im=Image.new('RGB',src.size,bg);im.paste(src,(0,0),src)
        rendered.append(im)
    rendered[0].save(destination,save_all=True,append_images=rendered[1:],duration=83,loop=0,optimize=True)

# Inspect the original animations on the new skin in one contact sheet.
originals=sorted(f for f in (P/'qa_original').glob('*.png') if '-Final-' in f.name)
contact=Image.new('RGB',(1200,max(1,(len(originals)+5)//6)*340),(41,44,53)); draw=ImageDraw.Draw(contact)
for i,f in enumerate(originals):
    x=(i%6)*200;y=(i//6)*340
    title=f.name.split('-Final-')[-1].rsplit('_',1)[0]
    draw.text((x+8,y+8),title,font=label_font,fill='white')
    im=Image.open(f).convert('RGBA');im.thumbnail((186,295))
    contact.paste(im,(x+(200-im.width)//2,y+35),im)
contact.save(P/'qa_original_animations.png')

source=json.loads((P/'source_export/Character.json').read_text())
result=json.loads((P/'verified_export/Character.json').read_text())
report=json.loads((P/'validation.json').read_text())
report['roundtrip_original_animations_identical']=all(result['animations'].get(k)==v for k,v in source['animations'].items())
report['roundtrip_bones_identical']=source['bones']==result['bones']
report['roundtrip_ik_identical']=source.get('ik')==result.get('ik')
report['spine_png_frames_rendered']=sum(len(v) for v in groups.values())
report['original_animation_snapshots_rendered']=len(originals)
report['project_sha256']=hashlib.sha256((P/'char_ss_test_dressed.spine').read_bytes()).hexdigest()
(P/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
readme='''BẢN CHỈNH SỬA NHÂN VẬT DƯA CHUỘT — SPINE 4.2.43

Mở char_ss_test_dressed.spine, chọn skin Comedy/Ao_hoa_quan_short.
Thư mục images phải ở cùng thư mục với file .spine.

Trang phục: áo hoa màu cam có cổ và túi, quần short tím có dây rút,
giày màu kem. Quần áo dùng mesh/bone của nhân vật để chuyển động theo rig.

Animation mới:
Comedy/01_mat_le          — mắt lé, răng hô
Comedy/02_cuoi_deu        — mắt lim dim, cười đểu
Comedy/03_le_luoi         — lè lưỡi, lắc người
Comedy/04_cuoi_ban_no     — cười há miệng, rung người
Comedy/05_doi_bieu_cam    — lần lượt đổi qua bốn biểu cảm

24 animation Final/ và các skin gốc vẫn được giữ lại.
Chọn Pickle/Normal hoặc Pickle/Blue để xem diện mạo cũ.

original/ chứa file char_ss_test.spine và bộ ảnh gốc chưa chỉnh sửa.
File trong Downloads được giữ nguyên; SHA-256 bản gốc và bản backup trùng nhau.
preview.png là bảng biểu cảm. Các preview_*.gif được tạo từ ảnh Spine xuất.
validation.json ghi kiểm tra cấu trúc và kết quả xuất/nhập bằng Spine.
'''
(P/'HUONG_DAN.txt').write_text(readme,encoding='utf-8-sig')
with zipfile.ZipFile(P/'char_ss_test_dressed_package.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in [P/'char_ss_test_dressed.spine',P/'HUONG_DAN.txt',P/'validation.json',P/'preview.png',P/'qa_motion.png',*P.glob('preview_*.gif')]: z.write(f,f.name)
    for folder in ('images','original'):
        for f in (P/folder).rglob('*'):
            if f.is_file():z.write(f,str(f.relative_to(P)))
print(json.dumps(report,indent=2))
print('Package:',(P/'char_ss_test_dressed_package.zip').stat().st_size,'bytes')
