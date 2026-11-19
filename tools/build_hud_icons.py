#!/usr/bin/env python3
"""Build the combat-HUD button icons.

Skill icons are REAL ART cropped from each skill pack's own apex frame
(spec §7: icon = the pack's peak frame, F5/F6 of the front row), squared
with padding. The four utility icons (basic sword, dodge, defend,
interact) are drawn vector-style in the same gold-frame language — no
emoji, no text glyphs anywhere.
"""
import math
from PIL import Image, ImageDraw, ImageFilter

ROOT = "/home/hatch/workspace/game-tien-lo-agy1"
OUT = ROOT + "/assets/hud"
SIZE = 216

PACKS = {
    "sk_thaicuc_chuong": "thaicuc_atlas.png",
    "sk_kimcang_quyen": "kimcang_atlas.png",
    "sk_philong_cuoc": "philong_atlas.png",
    "sk_batquai_chuong": "batquai_atlas.png",
    "ult_nguhanh_quyen": "nguhanhquyen_atlas.png",
}

def pack_icon(atlas_file, out_name):
    im = Image.open(f"{ROOT}/assets/skills/{atlas_file}").convert("RGBA")
    # Front row (S) = row index 4; apex = F5 (col 4). Union F5+F6 alpha so
    # the crop frames the burst, then centre on F5's bbox.
    cell5 = im.crop((4 * 512, 4 * 512, 5 * 512, 5 * 512))
    bb = cell5.split()[3].getbbox()
    if not bb:
        raise SystemExit("empty apex frame in " + atlas_file)
    pad = 26
    x0 = max(0, bb[0] - pad); y0 = max(0, bb[1] - pad)
    x1 = min(512, bb[2] + pad); y1 = min(512, bb[3] + pad)
    # square the crop around the bbox centre
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    x0 = int(max(0, min(512 - side, cx - side / 2))); y0 = int(max(0, min(512 - side, cy - side / 2)))
    crop = cell5.crop((x0, y0, x0 + side, y0 + side)).resize((SIZE, SIZE), Image.LANCZOS)
    crop.save(f"{OUT}/{out_name}")
    print("icon", out_name, "from", atlas_file, "bbox", bb)

for skill_id, atlas in PACKS.items():
    pack_icon(atlas, f"icon_{skill_id}.png")

# ---------------------------------------------------------------- drawn icons
SS = 4  # supersample
W = SIZE * SS

def canvas():
    return Image.new("RGBA", (W, W), (0, 0, 0, 0))

def finish(im, name):
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    im.save(f"{OUT}/{name}")
    print("icon", name, "(drawn)")

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))

# --- basic attack: a long sword with red tassel (the character's weapon)
im = canvas(); d = ImageDraw.Draw(im)
cx, cy = W / 2, W / 2
# blade: from upper-right tip to lower-left guard, drawn as a tapered polygon
tip = (cx + 300, cy - 320); base_r = (cx - 66, cy + 40); base_l = (cx - 128, cy - 26)
d.polygon([tip, base_r, base_l], fill=(216, 228, 238, 255))
# blade centre ridge
d.line([tip, (cx - 97, cy + 7)], fill=(140, 158, 175, 255), width=int(7 * SS))
# fuller highlight
d.line([(cx + 210, cy - 232), (cx - 84, cy + 2)], fill=(245, 250, 255, 255), width=int(4 * SS))
# guard (gold bar perpendicular to blade axis)
gx, gy = cx - 97, cy + 7
ux, uy = -0.7071, 0.7071  # perpendicular unit of the blade direction
gl = 120
d.line([(gx - ux * gl, gy - uy * gl), (gx + ux * gl, gy + uy * gl)], fill=(212, 175, 55, 255), width=int(17 * SS))
d.ellipse([gx - 20 * SS, gy - 20 * SS, gx + 20 * SS, gy + 20 * SS], fill=(255, 215, 90, 255))
# grip
hx, hy = gx - 62, gy + 62
d.line([(gx, gy), (hx, hy)], fill=(70, 44, 26, 255), width=int(26 * SS))
for i in range(3):
    t = i / 2
    px, py = gx + (hx - gx) * t, gy + (hy - gy) * t
    d.line([(px - 16 * SS, py + 10 * SS), (px + 10 * SS, py - 16 * SS)], fill=(120, 84, 46, 255), width=int(5 * SS))
# pommel
d.ellipse([hx - 17 * SS, hy - 17 * SS, hx + 17 * SS, hy + 17 * SS], fill=(212, 175, 55, 255))
# red tassel hanging from the pommel
for k, sway in enumerate((-14, 0, 14)):
    x0 = hx + sway * SS * 0.4
    pts = [(x0 + math.sin(s / 28) * 6 * SS, hy + 14 * SS + s * SS) for s in range(0, 30)]
    d.line(pts, fill=(196, 30, 44, 255), width=int(7 * SS))
finish(im, "icon_basic.png")

# --- dodge: three blue speed arcs + a swift chevron figure
im = canvas(); d = ImageDraw.Draw(im)
for i, (r, a0, a1, wdt) in enumerate([(300, 205, 320, 20), (228, 195, 330, 24), (156, 185, 335, 28)]):
    d.arc([cx - r, cy - r, cx + r, cy + r], start=a0, end=a1, fill=(86, 178, 255, 235), width=int(wdt * SS / 2))
# leaping figure: simple dynamic silhouette (head + sweeping body stroke)
hx, hy = cx + 92, cy - 128
d.ellipse([hx - 34 * SS, hy - 34 * SS, hx + 34 * SS, hy + 34 * SS], fill=(225, 242, 255, 255))
d.line([(hx - 8, hy + 30 * SS), (cx + 6, cy + 6), (cx - 104, cy + 128 * SS)], fill=(225, 242, 255, 255), width=int(30 * SS))
d.line([(cx + 6, cy + 6), (cx + 138, cy + 52 * SS)], fill=(225, 242, 255, 255), width=int(26 * SS))
d.line([(cx + 6, cy + 6), (cx - 30, cy + 140 * SS)], fill=(190, 224, 255, 255), width=int(24 * SS))
finish(im, "icon_dodge.png")

# --- defend: bronze-steel shield with gold rim and boss
im = canvas(); d = ImageDraw.Draw(im)
top = cy - 300; bot = cy + 330; half = 235
shield = [(cx - half, top), (cx + half, top), (cx + half, top + 260),
          (cx + 120, bot - 120), (cx, bot), (cx - 120, bot - 120), (cx - half, top + 260)]
d.polygon(shield, fill=(74, 92, 108, 255))
inner = [(x + (cx - x) * 0.13, y + (cy - y) * 0.10) for (x, y) in shield]
d.polygon(inner, fill=(116, 138, 158, 255))
d.line(shield + [shield[0]], fill=(212, 175, 55, 255), width=int(13 * SS), joint="curve")
d.line([(cx, top + 26), (cx, bot - 60)], fill=(212, 175, 55, 200), width=int(9 * SS))
d.ellipse([cx - 52 * SS, cy - 52 * SS, cx + 52 * SS, cy + 52 * SS], fill=(255, 215, 90, 255))
d.ellipse([cx - 30 * SS, cy - 30 * SS, cx + 30 * SS, cy + 30 * SS], fill=(176, 132, 32, 255))
finish(im, "icon_defend.png")

# --- interact: golden speech bubble with three dots
im = canvas(); d = ImageDraw.Draw(im)
box = [cx - 268, cy - 215, cx + 268, cy + 130]
d.rounded_rectangle(box, radius=88 * SS, fill=(240, 226, 178, 255), outline=(150, 112, 30, 255), width=int(10 * SS))
d.polygon([(cx - 60, cy + 118 * SS), (cx + 84, cy + 118 * SS), (cx - 6, cy + 268 * SS)], fill=(240, 226, 178, 255))
d.line([(cx - 60, cy + 116 * SS), (cx - 6, cy + 266 * SS)], fill=(150, 112, 30, 255), width=int(9 * SS))
d.line([(cx + 84, cy + 116 * SS), (cx - 6, cy + 266 * SS)], fill=(150, 112, 30, 255), width=int(9 * SS))
for k in (-1, 0, 1):
    dx = cx + k * 118 * SS
    d.ellipse([dx - 30 * SS, cy - 72 * SS, dx + 30 * SS, cy - 12 * SS], fill=(96, 74, 22, 255))
finish(im, "icon_interact.png")

print("done")
