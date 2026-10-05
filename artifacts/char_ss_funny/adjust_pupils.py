from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import copy, hashlib, json, sys, zipfile
from fix_main_animation import canonical

P = Path(__file__).resolve().parent
SKIN = 'Comedy/Dua_xanh_bikini_da_bao'
MAIN = P / 'char_ss_test_dressed.spine'
CANDIDATE = P / 'char_ss_test_dressed_pupils_candidate.spine'

def source():
    return json.loads((P / 'pupil_source_export/Character.json').read_text(encoding='utf-8'))

def expected():
    data = source()
    blue = next(s for s in data['skins'] if s['name'] == 'Pickle/Blue')
    outfit = next(s for s in data['skins'] if s['name'] == SKIN)
    for slot in ('R_Eye3', 'R_Eye4'):
        for key in ('R_Eye', 'Comedy_Center'):
            outfit['attachments'][slot][key] = copy.deepcopy(blue['attachments'][slot]['R_Eye'])
    return data

def prepare():
    (P / 'Character_pupils_fixed.json').write_text(json.dumps(expected(), ensure_ascii=False, indent=2), encoding='utf-8')
    for suffix in ('jump4', 'expressions'):
        cfg = json.loads((P / ('export_blue_bikini_' + suffix + '.json')).read_text())
        folder = P / ('qa_pupil_' + suffix)
        folder.mkdir(exist_ok=True)
        cfg.update(input=str(CANDIDATE), output=str(folder) + '/')
        (P / ('export_pupil_' + suffix + '.json')).write_text(json.dumps(cfg, indent=2), encoding='utf-8')
    print('Restored original blue pupil placement for both normal and smug attachments')

def verify():
    final = json.loads((P / 'verified_pupils/Character.json').read_text())
    wanted = expected()
    for key, value in wanted.items():
        if key != 'skeleton':
            assert canonical(value) == canonical(final[key]), key
    assert final['skeleton']['images'] == './images/'
    report = {'skin': SKIN, 'pupils_match_original_Pickle_Blue': True,
              'screen_left_pupil_lower_screen_right_pupil_upper': True,
              'all_30_animations_preserved': True, 'other_skins_and_rig_preserved': True,
              'backup': 'char_ss_test_dressed_before_pupil_fix.spine',
              'candidate_sha256': hashlib.sha256(CANDIDATE.read_bytes()).hexdigest()}
    (P / 'validation_pupils.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))

def preview():
    bg = (242, 238, 223)
    frames = sorted((P / 'qa_pupil_jump4').glob('*.png'))
    expressions = sorted((P / 'qa_pupil_expressions').glob('*.png'))
    assert len(frames) == 31 and len(expressions) == 65
    rendered = []
    for f in frames:
        src = Image.open(f).convert('RGBA')
        im = Image.new('RGB', src.size, bg)
        im.paste(src, (0, 0), src)
        rendered.append(im)
    rendered[0].save(P / 'preview_blue_bikini_jump4.gif', save_all=True, append_images=rendered[1:],
                     duration=[33 if i % 3 != 2 else 34 for i in range(len(rendered))], loop=0, optimize=True)
    board = Image.new('RGB', (1440, 700), bg)
    dr = ImageDraw.Draw(board)
    font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 27)
    small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
    dr.text((26, 22), 'DƯA LEO XANH • MẮT LỆCH TRÊN / DƯỚI', font=font, fill=(37, 61, 82))
    for i, index in enumerate((0, 16, 32, 48)):
        im = Image.open(expressions[index]).convert('RGBA')
        im.thumbnail((310, 570))
        board.paste(im, (i * 360 + (360 - im.width) // 2, 80), im)
    dr.text((26, 659), 'Skin: ' + SKIN + '   |   Spine 4.2.43', font=small, fill=(50, 70, 80))
    board.save(P / 'preview_blue_bikini.png')
    # Save a close-up, with the old eye placement next to the restored placement.
    old_frames = sorted((P / 'qa_blue_bikini_expressions').glob('*.png'))
    pair = Image.new('RGB', (1000, 540), bg)
    pd = ImageDraw.Draw(pair)
    for i, (f, label) in enumerate(((old_frames[0], 'TRƯỚC'), (expressions[0], 'SAU: GIỐNG BẢN GỐC'))):
        im = Image.open(f).convert('RGBA')
        # The exported animation bounds are the same before and after this skin-only edit.
        im = im.crop((im.width * .18, im.height * .05, im.width * .90, im.height * .45))
        scale = min(450 / im.width, 400 / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
        pair.paste(im, (i * 500 + (500 - im.width) // 2, 90), im)
        pd.text((i * 500 + 28, 25), label, font=font, fill=(37, 61, 82))
    pair.save(P / 'preview_pupils_before_after.png')
    print('Rendered 31 jump frames and 65 expression frames with restored pupil positions')

def package():
    report = json.loads((P / 'validation_pupils.json').read_text())
    assert hashlib.sha256(MAIN.read_bytes()).hexdigest() == report['candidate_sha256']
    readme = (P / 'HUONG_DAN.txt').read_text(encoding='utf-8-sig')
    readme += '\nĐã chỉnh con ngươi skin bikini giống skin Pickle/Blue gốc: mắt trái lệch xuống, mắt phải lệch lên.\n'
    readme += 'Backup trước sửa mắt: char_ss_test_dressed_before_pupil_fix.spine.\n'
    (P / 'HUONG_DAN.txt').write_text(readme, encoding='utf-8-sig')
    with zipfile.ZipFile(P / 'char_ss_test_dressed_package.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for f in [MAIN, P / 'HUONG_DAN.txt', P / 'validation_pupils.json',
                  P / 'char_ss_test_dressed_before_pupil_fix.spine',
                  P / 'char_ss_test_dressed_before_blue_bikini_saved.spine',
                  P / 'preview_blue_bikini.png', P / 'preview_pupils_before_after.png',
                  P / 'preview.png', P / 'preview_jump4.png', *P.glob('preview_*.gif')]:
            z.write(f, f.name)
        for folder in ('images', 'original'):
            for f in (P / folder).rglob('*'):
                if f.is_file():
                    z.write(f, str(f.relative_to(P)))
    print('Updated main package with original pupil positions')

if __name__ == '__main__':
    {'prepare': prepare, 'verify': verify, 'preview': preview, 'package': package}[sys.argv[1]]()
