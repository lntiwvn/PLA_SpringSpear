from pathlib import Path
import copy, hashlib, json, sys, zipfile

P = Path(__file__).resolve().parent
NAME = 'Comedy/06_idle_jump_4_ao_hoa'
OLD = 'Final/06_idle_jump_4_ao_hoa'
MAIN = P / 'char_ss_test_dressed.spine'
CANDIDATE = P / 'char_ss_test_dressed_fixed_candidate.spine'

def read(folder):
    return json.loads((P / folder / 'Character.json').read_text(encoding='utf-8'))

def canonical(value):
    value = copy.deepcopy(value)
    def walk(obj):
        if isinstance(obj, dict):
            if 'triangles' in obj:
                ts = obj['triangles']
                obj['triangles'] = sorted(
                    min(tuple(ts[i:i+3][j:] + ts[i:i+3][:j]) for j in range(3))
                    for i in range(0, len(ts), 3))
            for child in obj.values():
                walk(child)
        elif isinstance(obj, list):
            for child in obj:
                walk(child)
    walk(value)
    return value

def prepare():
    data = read('saved_main_fix_export')
    assert NAME not in data['animations']
    assert data['animations'][OLD] == data['animations']['Final/idle_jump_4']
    data['animations'][NAME] = data['animations'].pop(OLD)
    data['skeleton']['images'] = './images/'
    (P / 'Character_main_fixed.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Prepared correct animation name:', NAME)

def verify():
    source = read('saved_main_fix_export')
    final = read('verified_main_fix_export')
    previous = read('before_animation_fix_export')
    expected = copy.deepcopy(source)
    expected['animations'][NAME] = expected['animations'].pop(OLD)
    assert final['animations'] == expected['animations'], 'Animation timelines changed'
    assert all(final['animations'].get(k) == v for k, v in previous['animations'].items()), 'Prior animation changed'
    assert OLD not in final['animations']
    assert final['animations'][NAME] == final['animations']['Final/idle_jump_4']
    for key, value in expected.items():
        if key != 'skeleton':
            assert canonical(value) == canonical(final[key]), 'Content changed: ' + key
    assert final['skeleton']['images'] == './images/'
    report = {
        'project': str(MAIN),
        'animation': NAME,
        'animation_count': len(final['animations']),
        'motion_identical_to_Final_idle_jump_4': True,
        'all_previous_animations_preserved': True,
        'rig_slots_skins_constraints_preserved': True,
        'backup': str(P / 'char_ss_test_dressed_before_animation_fix.spine'),
        'candidate_sha256': hashlib.sha256(CANDIDATE.read_bytes()).hexdigest(),
    }
    (P / 'validation_main_fix.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

def package():
    report = json.loads((P / 'validation_main_fix.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(MAIN.read_bytes()).hexdigest() == report['candidate_sha256']
    instructions = (P / 'HUONG_DAN.txt').read_text(encoding='utf-8-sig')
    if NAME not in instructions:
        instructions = instructions.replace(
            'Comedy/05_doi_bieu_cam    — lần lượt đổi qua bốn biểu cảm',
            'Comedy/05_doi_bieu_cam    — lần lượt đổi qua bốn biểu cảm\n'
            + NAME + ' — toàn bộ chuyển động giống Final/idle_jump_4, dùng skin áo hoa')
        instructions += '\nBackup trước sửa animation: char_ss_test_dressed_before_animation_fix.spine.\n'
    (P / 'HUONG_DAN.txt').write_text(instructions, encoding='utf-8-sig')
    with zipfile.ZipFile(P / 'char_ss_test_dressed_package.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        files = [MAIN, P / 'HUONG_DAN.txt', P / 'validation_main_fix.json',
                 P / 'char_ss_test_dressed_before_animation_fix.spine',
                 P / 'preview.png', P / 'preview_jump4.png', *P.glob('preview_*.gif')]
        for f in files:
            z.write(f, f.name)
        for folder in ('images', 'original'):
            for f in (P / folder).rglob('*'):
                if f.is_file():
                    z.write(f, str(f.relative_to(P)))
    print('Updated primary package with', NAME)

if __name__ == '__main__':
    {'prepare': prepare, 'verify': verify, 'package': package}[sys.argv[1]]()
