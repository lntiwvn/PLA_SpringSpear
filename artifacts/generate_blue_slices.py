"""Rebuild death pieces from the current Spine artwork, retaining sprite bounds."""
from pathlib import Path
import json
import shutil
import uuid
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/Asset'
OUT = ROOT / 'artifacts/blue_bikini_slices'
OUT.mkdir(exist_ok=True)
NAMES = ['pickle slice 1.png', 'pickle slice 1.1.png', 'pickle slice 2.png', 'pickle slice 2.1.png']
SOURCE = ROOT / 'artifacts/char_ss_funny/images'
BODY = Image.open(SOURCE / 'Comedy_Blue_Bikini/Pickle_Body.png').convert('RGBA')
EYE = Image.open(SOURCE / 'Pickle_Eye.png').convert('RGBA')
MOUTH = Image.open(SOURCE / 'Comedy/Mouth_Tongue.png').convert('RGBA')

def character(width, height):
    # Straight cylinder, like the original slice sprites; preserve the source fabric.
    canvas = Image.new('RGBA', (width, height), (0, 155, 235, 255))
    canvas.alpha_composite(BODY.resize((width, height), Image.Resampling.LANCZOS))
    eye_size = round(width * .29)
    eye_y = round(height * .20)
    for center in (width * .30, width * .70):
        eye = EYE.resize((eye_size, eye_size), Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(eye)
        lo, hi = round(eye_size * .28), round(eye_size * .72)
        stroke = max(3, round(eye_size * .10))
        draw.line((lo, lo, hi, hi), fill=(24, 67, 89, 255), width=stroke)
        draw.line((lo, hi, hi, lo), fill=(24, 67, 89, 255), width=stroke)
        canvas.alpha_composite(eye, (round(center-eye_size/2), eye_y))
    mouth_w = round(width * .76)
    mouth = MOUTH.resize((mouth_w, round(mouth_w*MOUTH.height/MOUTH.width)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mouth, ((width-mouth_w)//2, round(height*.36)))
    return canvas

horizontal = character(166, 509)
vertical = character(183, 377)
new_ids = {}
previews = []
for index, name in enumerate(NAMES):
    backup = OUT / ('original_' + name)
    if not backup.exists():
        shutil.copy2(ASSET / name, backup)
        shutil.copy2(ASSET / (name+'.meta'), OUT / ('original_'+name+'.meta'))
    original = Image.open(backup).convert('RGBA')
    bbox = original.getchannel('A').getbbox()
    x, y, right, bottom = bbox
    width, height = right-x, bottom-y
    old = original.crop(bbox)
    if index == 0:
        art = horizontal.crop((6, 354, 160, 509))
    elif index == 1:
        art = horizontal.crop((0, 0, 166, 354))
    elif index == 2:
        art = vertical.crop((0, 0, 121, 377))
    else:
        art = vertical.crop((78, 0, 183, 376))
    pixels = np.asarray(old)
    # Copy the original light-green cucumber cross-section (ellipse + seed pattern).
    cap_mask = (pixels[:,:,0] > 135) & (pixels[:,:,1] > 170) & (pixels[:,:,2] < 185)
    if index == 0:
        cap_mask &= np.indices((height,width))[0] < 45
    elif index == 2:
        cap_mask &= np.indices((height,width))[1] > 65
    else:
        cap_mask[:] = False
    cap = old.copy()
    cap.putalpha(Image.fromarray((cap_mask * pixels[:,:,3]).astype('uint8')))
    art.alpha_composite(cap)
    if index == 1:
        # Retain the original cartoon bone protruding from the horizontal cut.
        bone_mask = (np.indices((height,width))[0] >= 300) & (pixels[:,:,2] > 180) & (pixels[:,:,1] > 140) & (pixels[:,:,2] > pixels[:,:,0])
        bone = old.copy()
        bone.putalpha(Image.fromarray((bone_mask * pixels[:,:,3]).astype('uint8')))
        art.alpha_composite(bone)
    art.putalpha(old.getchannel('A'))
    result = Image.new('RGBA', (512, 512))
    result.alpha_composite(art, (x,y))
    assert result.getchannel('A').getbbox() == bbox
    assert np.array_equal(np.asarray(result.getchannel('A')), np.asarray(original.getchannel('A')))
    result.save(ASSET / name)
    result.save(OUT / name)
    # Preserve the green character's original pieces under independent Cocos UUIDs.
    green_name = name.replace('pickle slice', 'pickle original slice')
    shutil.copy2(backup, ASSET / green_name)
    meta_text = (OUT / ('original_'+name+'.meta')).read_text(encoding='utf-8')
    old_uuid = json.loads(meta_text)['uuid']
    new_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'SpringSpearPLA/'+green_name))
    new_ids[old_uuid] = new_uuid
    # Mechanical copy of Cocos import metadata; dimensions and alpha are identical.
    meta_text = meta_text.replace(old_uuid, new_uuid).replace(name[:-4], green_name[:-4])
    (ASSET / (green_name+'.meta')).write_text(meta_text, encoding='utf-8')
    previews.append((name, old, art))

sheet = Image.new('RGB', (1024, 600), (237, 240, 246))
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
draw.text((20, 14), 'OLD / NEW - BLUE BIKINI DEATH SLICES', fill=(30,52,73), font=font)
for i,(name,old,new) in enumerate(previews):
    tile_x = i * 256
    draw.text((tile_x+12, 53), name, fill=(30,52,73), font=font)
    for row,im in enumerate((old,new)):
        thumb = im.copy()
        thumb.thumbnail((210,220), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (tile_x+(256-thumb.width)//2, 91+row*245), thumb)
sheet.save(OUT / 'preview_before_after.png')
(OUT / 'original_uuid_map.json').write_text(json.dumps(new_ids, indent=2), encoding='utf-8')
print(json.dumps({'replaced': NAMES, 'original_uuid_map':new_ids, 'alpha_and_bounds_preserved':True}, indent=2))
