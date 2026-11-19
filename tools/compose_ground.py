#!/usr/bin/env python3
"""Compose the eight zone paintings into ONE island ground image.

Each zone painting is placed into its window rect on the 4400x2640 world
canvas with a feathered alpha mask so seams blend over shared terrain
(paths / grass / stone). Paintings are cover-cropped to their window
(aspect preserved); if cover-cropping would throw away more than 35% of
a painting, it falls back to a direct resize (terrain tolerates a mild
stretch far better than losing a painted landmark).
Draw order is back-to-front: summit/back zones first, entrance last.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "gen"
W, H = 4400, 2640
FEATHER = 64

RECTS = {  # zone -> (x0, y0, x1, y1) window on the world canvas (island = 7 zones;
    # Hậu Sơn is a separate map since the user's 09:12 correction)
    "linh_tuyen":  (3000, 0,    4400, 880),
    "van_an":      (0,    0,    1400, 1250),
    "dai_dien":    (1250, 720,  3100, 1520),
    "luyen_vo":    (3000, 780,  4400, 1520),
    "truc_lam":    (0,    1200, 1350, 2640),
    "quang_truong": (1250, 1420, 4400, 2180),
    "son_mon":     (1250, 2080, 4400, 2640),
}
ORDER = ["linh_tuyen", "van_an", "dai_dien",
         "luyen_vo", "truc_lam", "quang_truong", "son_mon"]
# the island's rear-centre rim (between Vân Ẩn and Linh Tuyền, behind Đại Điện)
# is a misty ridge backdrop: the Hậu Sơn painting, heavily blurred and lifted,
# so palette/light match but no playable detail reads there
RIDGE_RECT = (1150, 0, 3200, 880)


# per-zone fit overrides: mode "stretch" (terrain tolerates it; painted
# circles become 2:1 ellipses, which is iso-correct) or "cover" with a
# focus point (fx, fy in 0..1) choosing which part of the painting survives
FIT = {
    "son_mon": {"mode": "stretch"},
    "quang_truong": {"mode": "stretch"},
    "truc_lam": {"mode": "cover", "fx": 0.60, "fy": 0.5},
    "van_an": {"mode": "cover", "fx": 0.30, "fy": 0.5},
}


def fit(img: Image.Image, rect, zone: str) -> Image.Image:
    x0, y0, x1, y1 = rect
    tw, th = x1 - x0, y1 - y0
    sw, sh = img.size
    spec = FIT.get(zone, {})
    cover = max(tw / sw, th / sh)
    cw, ch = int(sw * cover), int(sh * cover)
    crop_frac = 1 - min(tw / cw, th / ch)
    if spec.get("mode") == "stretch":
        return img.resize((tw, th), Image.LANCZOS)
    if spec.get("mode") == "cover" or crop_frac <= 0.35:
        im = img.resize((cw, ch), Image.LANCZOS)
        fx = spec.get("fx", 0.5)
        fy = spec.get("fy", 0.5)
        ox = int((cw - tw) * fx)
        oy = int((ch - th) * fy)
        return im.crop((ox, oy, ox + tw, oy + th))
    return img.resize((tw, th), Image.LANCZOS)


def feather_mask(tw, th, feather=FEATHER):
    m = Image.new("L", (tw, th), 255)
    d = ImageDraw.Draw(m)
    d.rectangle([0, 0, tw - 1, th - 1], outline=0, width=feather)
    # build an alpha that is 0 at the very edge and 255 inside
    m = Image.new("L", (tw, th), 0)
    d = ImageDraw.Draw(m)
    d.rectangle([feather, feather, tw - feather, th - feather], fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather / 2))


def main():
    # base: soft cloud-sea gradient so any pinhole reads as cloud
    grad = Image.new("RGB", (1, H))
    top = (196, 216, 226)
    bot = (240, 244, 240)
    grad.putdata([tuple(int(top[i] + (bot[i] - top[i]) * (y / H)) for i in range(3))
                  for y in range(H)])
    base = grad.resize((W, H))
    # rear ridge backdrop first (zone paintings feather over its edges)
    ridge_src = GEN / "ground_hauson.png"
    if ridge_src.exists():
        from PIL import ImageEnhance
        rx0, ry0, rx1, ry1 = RIDGE_RECT
        ridge = Image.open(ridge_src).convert("RGB").resize((rx1 - rx0, ry1 - ry0), Image.LANCZOS)
        ridge = ridge.filter(ImageFilter.GaussianBlur(26))
        ridge = ImageEnhance.Brightness(ridge).enhance(1.07)
        base.paste(ridge, (rx0, ry0), feather_mask(rx1 - rx0, ry1 - ry0, 110))
        print("ridge backdrop placed", RIDGE_RECT)
    placed = {}
    for zone in ORDER:
        src = GEN / f"ground_{zone}.png"
        if not src.exists():
            print("MISSING", src)
            continue
        img = Image.open(src).convert("RGB")
        rect = RECTS[zone]
        tile = fit(img, rect, zone)
        mask = feather_mask(tile.width, tile.height)
        base.paste(tile, (rect[0], rect[1]), mask)
        placed[zone] = {"src_size": img.size, "rect": rect}
        print(zone, img.size, "->", rect)
    out = ROOT / "assets" / "ground.jpg"
    base.save(out, quality=90)
    # Hậu Sơn standalone map ground: its own painting at native size
    hs = GEN / "ground_hauson.png"
    if hs.exists():
        Image.open(hs).convert("RGB").save(ROOT / "assets" / "ground_hauson.jpg", quality=90)
        print("saved ground_hauson.jpg")
    base.resize((1100, 660)).save(ROOT / "proof" / "ground_preview.jpg", quality=85)
    (ROOT / "data" / "ground_layout.json").write_text(json.dumps(
        {"canvas": [W, H], "rects": RECTS, "placed": placed}, indent=1))
    print("saved", out, base.size)


if __name__ == "__main__":
    main()
