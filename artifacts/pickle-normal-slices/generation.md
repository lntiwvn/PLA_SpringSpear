# Pickle/Normal split sprites

Generated with the built-in ImageGen tool on 2026-10-06. The original images remain in Codex's generated_images directory. The game textures are normalized to 512 × 512 while preserving their transparent alpha and canvas placement.

Saved textures:

- `assets/Asset/PickleNormalSlices/pickle-normal-bottom.png`
- `assets/Asset/PickleNormalSlices/pickle-normal-top.png`
- `assets/Asset/PickleNormalSlices/pickle-normal-left.png`
- `assets/Asset/PickleNormalSlices/pickle-normal-right.png`

Each generation used its corresponding blue slice image as the edit target and `assets/Asset/New folder/Character.png` as the palette/style reference.

Shared prompt (replace `{role}` and `{piece specification}` with the entries below):

> Use case: precise-object-edit. Game sprite asset for Cocos. Image 1 is the edit target; image 2 is the supporting palette/style reference atlas. Create one {role} cut piece for Pickle/Normal. {piece specification} Change only blue skin to bright GREEN using the green Pickle_Body region in image 2, remove ALL yellow/leopard bikini/clothing and fill those regions with matching green striped pickle skin. Preserve original body silhouette, relative eye sizes and expression, orange mouth, pink tongue, smooth cartoon shading, subtle vertical stripes and spots. No arms or legs, no additional objects. Exactly ONE isolated piece on a fully transparent canvas. Preserve the source 512-square full canvas, with piece at the SAME position, same scale and same transparent margins as image 1. Do not enlarge or recenter the sprite. No text, no border, no shadow, no background, no white rectangle, no new character design.

| Role | Edit target | Piece specification |
| --- | --- | --- |
| bottom | `assets/Asset/pickle slice 1.png` | BOTTOM horizontal-cut half only: a rounded green lower pickle body, pale green elliptical exposed cucumber cross-section on TOP, two simple seeds/cucumber sectors matching reference. No face, no eyes, no mouth, no bone. |
| top | `assets/Asset/pickle slice 1.1.png` | TOP horizontal-cut half only: green rounded upper pickle body with curved green tuft on top, two white eyes with dark Xs, orange rimmed open goofy mouth, pink tongue sticking down, and small white/light cyan cartoon bone protruding from its bottom. Match reference. |
| left | `assets/Asset/pickle slice 2.png` | LEFT vertical-cut half only: green rounded left half pickle with one white eye with X, orange rimmed goofy open mouth cropped by cut. Exposed cucumber pale green vertical elliptical cross-section down its RIGHT edge. Match silhouette and cut geometry reference. |
| right | `assets/Asset/pickle slice 2.1.png` | RIGHT vertical-cut half only: green rounded right half pickle with one white eye with X, orange rimmed goofy open mouth and visible pink tongue, no visible cut surface except straight LEFT cut edge. Match reference. |

The `PreviousLevel` prefab uses these sprites for both enemies. Horizontal and vertical split references are wired to their matching pieces; the blue sprites remain available for the current level.
