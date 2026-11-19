#!/usr/bin/env python3
"""Per-frame shoe geometry for walk/run E and W: approved stage A-D set
vs merged stride4 set. For each frame: shoe clusters (dark shoe bodies
in the bottom zone), their centroids relative to the head centre, the
skirt-mass bottom (lowest row whose opaque width >= 45% of the strip's
max row width, ignoring the last 6 sole rows) and bare-leg length
(sole - skirt_bottom). Master px."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
CW = ROOT / "assets" / "char_workflow"


def load_atlas(png, js):
    d = json.loads(Path(js).read_text())
    img = Image.open(png).convert("RGBA")
    return {f["name"]: f for f in d["frames"]}, img


def crop(idx, img, name):
    r = idx[name]["rect"]
    return np.asarray(img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))).astype(float)


def lum(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def head_cx(a, L):
    ys, xs = np.nonzero(a > 0.5)
    top, bot = ys.min(), ys.max() + 1
    H = bot - top
    white = (a > 0.5) & (L >= 190)
    white[bot - int(0.52 * H):] = False
    lab, n = ndimage.label(white)
    best = None
    for i in range(1, n + 1):
        y2, x2 = np.nonzero(lab == i)
        if len(x2) < 0.06 * (a > 0.5).sum():
            continue
        if best is None or y2.min() < best[0].min():
            best = (y2, x2)
    return None if best is None else float(best[1].mean())


def shoes(a, L, bot):
    """Dark shoe clusters in the bottom 70 master px."""
    zone = np.zeros_like(a, dtype=bool)
    zone[bot - 70:] = True
    dark = zone & (a > 0.5) & (L < 80)
    lab, n = ndimage.label(dark)
    out = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 120:            # a shoe is a solid blob
            continue
        if ys.max() < bot - 26:      # must reach near the ground zone
            continue
        out.append({"cx": float(xs.mean()), "cy": float(ys.mean()),
                    "area": int(len(xs)), "w": int(xs.max() - xs.min()) + 1})
    out.sort(key=lambda s: s["cx"])
    return out


def skirt_bottom(a):
    mask = a > 0.5
    widths = mask.sum(axis=1)
    ys, _ = np.nonzero(mask)
    bot = int(ys.max())
    wmax = widths.max()
    rows = [y for y in range(len(widths) - 6) if widths[y] >= 0.45 * wmax]
    return (max(rows) if rows else None), bot, int(wmax)


def strip(idx, img, anim, dirn):
    res = []
    for i in range(1, 9):
        cell = crop(idx, img, f"player_hanhan__{anim}__{dirn}__{i:03d}.png")
        a = cell[..., 3] / 255.0
        L = lum(cell[..., :3])
        ys, _ = np.nonzero(a > 0.5)
        bot = int(ys.max())
        cx = head_cx(a, L)
        sh = shoes(a, L, bot + 1)
        sb, _, wmax = skirt_bottom(a)
        res.append({"f": i, "head_cx": None if cx is None else round(cx, 1),
                    "shoes": [{"cx": round(s["cx"], 1),
                               "off": None if cx is None else round(s["cx"] - cx, 1),
                               "w": s["w"]} for s in sh],
                    "skirt_bot": sb, "sole": bot,
                    "bare_leg": None if sb is None else bot - sb,
                    "wmax": wmax})
    return res


def main():
    ab_i, ab = load_atlas(CW / "hanhan_stage_ab.png", CW / "hanhan_stage_ab.json")
    wk_i, wk = load_atlas(CW / "hanhan_stride4_walk.png", CW / "hanhan_stride4_walk.json")
    rn_i, rn = load_atlas(CW / "hanhan_stride4_run.png", CW / "hanhan_stride4_run.json")
    out = {}
    for dirn in ["E", "W"]:
        for label, idx, img, anim in [("APPR", ab_i, ab, "walk"),
                                      ("S4", wk_i, wk, "walk"),
                                      ("APPR", ab_i, ab, "run"),
                                      ("S4", rn_i, rn, "run")]:
            rows = strip(idx, img, anim, dirn)
            key = f"{dirn} {anim} {label}"
            out[key] = rows
            print(f"== {key}  (offsets = shoe cx - head cx, master px)")
            for r in rows:
                offs = [s["off"] for s in r["shoes"]]
                print(f"  f{r['f']}: shoes={len(r['shoes'])} offs={offs} "
                      f"bare_leg={r['bare_leg']} wmax={r['wmax']}")
    (ROOT / "tools" / "legfit" / "logs" / "sweep_before.json").write_text(json.dumps(out, indent=1))
    print("saved tools/legfit/logs/sweep_before.json")


if __name__ == "__main__":
    main()
