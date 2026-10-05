from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import copy, hashlib, json, sys, zipfile
import numpy as np
from fix_main_animation import canonical

P = Path(__file__).resolve().parent
REFERENCE = Path('D:/Temp/codex-clipboard-64d98217-d6f4-4afe-a9d6-232567b18ac6.png')
SKIN = 'Comedy/Dua_xanh_bikini_da_bao'
ANIMATION = 'Comedy/06_idle_jump_4_ao_hoa'
FOLDER = 'Comedy_Blue_Bikini'
CANDIDATE = P / 'char_ss_test_dressed_blue_candidate.spine'
MAIN = P / 'char_ss_test_dressed.spine'

def source():
    return json.loads((P / 'blue_saved_source_export/Character.json').read_text(encoding='utf-8'))

def prepare():
    out = P / 'images' / FOLDER
    out.mkdir(exist_ok=True)
    # Extract the actual yellow fabric and brown rosettes from the supplied reference.
    ref = Image.open(REFERENCE).convert('RGB')
    ref.save(P / 'reference_bikini.png')
    a = np.asarray(ref).astype(float)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    warm = (r > 50) & (r > g * 1.05) & (g > b * 1.15) & (r > b * 1.35)
    y = np.arange(a.shape[0])[:, None]
    warm &= ((y >= 278) & (y <= 382)) | ((y >= 440) & (y <= 565))
    garment = ref.convert('RGBA')
    garment.putalpha(Image.fromarray((warm.astype(np.uint8) * 255)))
    body = Image.open(P / 'images/Pickle_Blue/Pickle_Body.png').convert('RGBA')
    garment = garment.crop((18, 3, 241, 565)).resize(body.size, Image.Resampling.LANCZOS)
    body_alpha = body.getchannel('A')
    body.alpha_composite(garment)
    body.putalpha(body_alpha)
    body.save(out / 'Pickle_Body.png')
    garment.save(out / 'Bikini_reference_overlay.png')

    # Change the green eyelids/eyebrows on the comedy eye assets to blue.
    for kind in ('Smug', 'Laugh'):
        for side in ('L', 'R'):
            name = f'Eye_{kind}_{side}'
            im = Image.open(P / 'images/Comedy' / (name + '.png')).convert('RGBA')
            arr = np.asarray(im).copy()
            hsv = np.asarray(im.convert('RGB').convert('HSV')).copy()
            mask = (hsv[:, :, 0] > 40) & (hsv[:, :, 0] < 125) & (hsv[:, :, 1] > 55)
            hsv[:, :, 0][mask] = 144
            rgb = np.asarray(Image.fromarray(hsv, 'HSV').convert('RGB'))
            arr[:, :, :3][mask] = rgb[mask]
            Image.fromarray(arr).save(out / (name + '.png'))

    data = source()
    blue = copy.deepcopy(next(s for s in data['skins'] if s['name'] == 'Pickle/Blue'))
    comedy = next(s for s in data['skins'] if s['name'] == 'Comedy/Ao_hoa_quan_short')
    blue['name'] = SKIN
    for att in blue['attachments']['body'].values():
        att['path'] = FOLDER + '/Pickle_Body'
    blue['attachments']['Mouth'] = copy.deepcopy(comedy['attachments']['Mouth'])
    for slot in ('R_Eye3', 'R_Eye4'):
        for key in ('R_Eye', 'Comedy_Center'):
            blue['attachments'][slot][key] = copy.deepcopy(comedy['attachments'][slot][key])
            blue['attachments'][slot][key]['path'] = 'Pickle_Blue/Pickle_EyeBall'
    for slot, side in (('eyewhite3', 'L'), ('eyewhite4', 'R')):
        for kind in ('Smug', 'Laugh'):
            key = 'Comedy_' + kind
            blue['attachments'][slot][key] = copy.deepcopy(comedy['attachments'][slot][key])
            blue['attachments'][slot][key]['path'] = f'{FOLDER}/Eye_{kind}_{side}'
    assert SKIN not in [s['name'] for s in data['skins']]
    data['skins'].insert(2, blue)
    data['skeleton']['images'] = './images/'
    assert data['animations'][ANIMATION] == data['animations']['Final/idle_jump_4']
    missing = []
    for skin in data['skins']:
        for atts in skin.get('attachments', {}).values():
            for key, att in atts.items():
                if att.get('type', 'region') in ('region', 'mesh', 'linkedmesh'):
                    path = att.get('path', att.get('name', key))
                    if not (P / 'images' / (path + '.png')).is_file():
                        missing.append(path)
    assert not missing, missing
    (P / 'Character_blue_bikini.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    settings = json.loads((P / 'preview_png_settings.json').read_text())
    for suffix, animation, fps in [('jump4', ANIMATION, 30), ('expressions', 'Comedy/05_doi_bieu_cam', 10)]:
        frame_folder = P / ('qa_blue_bikini_' + suffix)
        frame_folder.mkdir(exist_ok=True)
        cfg = {**settings, 'input': str(CANDIDATE), 'output': str(frame_folder) + '/',
               'animation': animation, 'skinType': 'single', 'skin': SKIN,
               'scale': 50, 'fps': fps, 'lastFrame': True}
        (P / ('export_blue_bikini_' + suffix + '.json')).write_text(json.dumps(cfg, indent=2), encoding='utf-8')
    print('Prepared skin:', SKIN)

def verify():
    before = source()
    after = json.loads((P / 'verified_blue_bikini/Character.json').read_text())
    assert before['animations'] == after['animations']
    for key in before:
        if key not in ('skeleton', 'skins'):
            assert canonical(before[key]) == canonical(after[key]), key
    for skin in before['skins']:
        final = next(s for s in after['skins'] if s['name'] == skin['name'])
        assert canonical(skin) == canonical(final), skin['name']
    assert SKIN in [s['name'] for s in after['skins']]
    assert after['skeleton']['images'] == './images/'
    report = {'new_skin': SKIN, 'animation_count': len(after['animations']),
              'all_previous_skins_and_animations_preserved': True,
              'rig_and_constraints_preserved': True,
              'bikini_art_extracted_from_user_reference': True,
              'candidate_sha256': hashlib.sha256(CANDIDATE.read_bytes()).hexdigest(),
              'backup': 'char_ss_test_dressed_before_blue_bikini_saved.spine'}
    (P / 'validation_blue_bikini.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))

def preview():
    frames = sorted((P / 'qa_blue_bikini_jump4').glob('*.png'))
    expressions = sorted((P / 'qa_blue_bikini_expressions').glob('*.png'))
    assert len(frames) == 31 and len(expressions) >= 65, (len(frames), len(expressions))
    bg = (242, 238, 223)
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
    dr.text((26, 22), 'DƯA LEO XANH • BIKINI VÀNG DA BÁO', font=font, fill=(37, 61, 82))
    for i, index in enumerate([0, 16, 32, 48]):
        im = Image.open(expressions[index]).convert('RGBA')
        im.thumbnail((310, 570))
        board.paste(im, (i * 360 + (360 - im.width) // 2, 80), im)
    dr.text((26, 659), 'Skin: ' + SKIN + '   |   Spine 4.2.43', font=small, fill=(50, 70, 80))
    board.save(P / 'preview_blue_bikini.png')
    print('Rendered', len(frames), 'jump frames and', len(expressions), 'expression frames')

def package():
    report = json.loads((P / 'validation_blue_bikini.json').read_text())
    assert hashlib.sha256(MAIN.read_bytes()).hexdigest() == report['candidate_sha256']
    text = (P / 'HUONG_DAN.txt').read_text(encoding='utf-8-sig')
    text += '\nSKIN MỚI: ' + SKIN + '\nDưa leo xanh dương mặc bikini vàng da báo theo mẫu.\n'
    text += 'Chọn skin này rồi chạy Comedy/06_idle_jump_4_ao_hoa hoặc các biểu cảm Comedy/.\n'
    text += 'Backup trước khi thêm skin: char_ss_test_dressed_before_blue_bikini_saved.spine.\n'
    (P / 'HUONG_DAN.txt').write_text(text, encoding='utf-8-sig')
    with zipfile.ZipFile(P / 'char_ss_test_dressed_package.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for f in [MAIN, P / 'HUONG_DAN.txt', P / 'validation_blue_bikini.json',
                  P / 'char_ss_test_dressed_before_blue_bikini_saved.spine',
                  P / 'preview_blue_bikini.png', P / 'preview.png', P / 'preview_jump4.png', *P.glob('preview_*.gif')]:
            z.write(f, f.name)
        for folder in ('images', 'original'):
            for f in (P / folder).rglob('*'):
                if f.is_file():
                    z.write(f, str(f.relative_to(P)))
    print('Updated primary .spine package with blue bikini skin')

if __name__ == '__main__':
    {'prepare': prepare, 'verify': verify, 'preview': preview, 'package': package}[sys.argv[1]]()
