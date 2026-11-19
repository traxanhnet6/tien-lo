#!/usr/bin/env python3
"""Leg/body proportion measurement for the gd3 legfit fix (Bui 22:49
'Chan ngang vua than'). Compares the APPROVED stage A-D set
(hanhan_stage_ab: idle/walk/run) against the merged stride4 walk/run
for the two profile directions E and W.

Per frame (master px, 384 cell, ground pivot y=360):
  H      figure alpha-bbox height
  W      figure alpha-bbox width
  head_h head blob height (largest near-white component, upper 52%)
  legvis visible leg length = sole_y - robe_panel_bottom_y, where the
         robe panel is the largest near-white component in the lower
         body (excluding the thin white shoe-sole strips at the very
         bottom). Big legvis = long bare legs below the robe.
  sep    foot separation at contact frames 1/5 (bottom-profile
         plateaus within 10px of the frame ground, same algorithm as
         stride rounds' measure_feet)
Ratios published: legvis/H, legvis/head_h, sep/H.
"""
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
    idx = {f["name"]: f for f in d["frames"]}
    return idx, img


def crop(idx, img, name):
    r = idx[name]["rect"]
    return np.asarray(img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))).astype(float)


def lum(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def head_blob(a, L, top, bot):
    H = bot - top
    white = (a > 0.5) & (L >= 190)
    white[bot - int(0.52 * H):] = False
    white[:top] = False
    lab, n = ndimage.label(white)
    best = None
    total = (a > 0.5).sum()
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 0.06 * total:
            continue
        if best is None or ys.min() < best[0].min():
            best = (ys, xs)
    if best is None:
        return None
    ys, xs = best
    return {"h": int(ys.max() - ys.min()) + 1, "y1": int(ys.max()),
            "cx": float(xs.mean())}


def panel_bottom(a, L, head_y1, bot):
    """Bottom of the white robe panel in the lower body."""
    white = (a > 0.5) & (L >= 190)
    white[:head_y1 + 8] = False          # below the head/neck
    white[bot - 14:] = False             # exclude white shoe soles
    lab, n = ndimage.label(white)
    best = None
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 250:                # panel is a big slab
            continue
        if best is None or len(xs) > len(best[0]):
            best = (ys, xs)
    if best is None:
        return None
    ys, xs = best
    return int(ys.max())


def feet_sep(a):
    cols = np.nonzero((a > 0.5).any(axis=0))[0]
    if len(cols) == 0:
        return None
    bottoms = {}
    for x in cols:
        ys = np.nonzero(a[:, x] > 0.5)[0]
        bottoms[x] = ys.max()
    ground = max(bottoms.values())
    touch = [x for x in cols if bottoms[x] >= ground - 10]
    if not touch:
        return None
    runs = [[touch[0]]]
    for x in touch[1:]:
        if x - runs[-1][-1] > 14:
            runs.append([x])
        else:
            runs[-1].append(x)
    runs = [r for r in runs if len(r) >= 6]
    if len(runs) < 2:
        return None
    return round(abs(np.mean(runs[-1]) - np.mean(runs[0])), 1)


def measure(cell):
    a = cell[..., 3] / 255.0
    L = lum(cell[..., :3])
    mask = a > 0.5
    ys, xs = np.nonzero(mask)
    top, bot = int(ys.min()), int(ys.max())
    H = bot - top + 1
    W = int(xs.max() - xs.min()) + 1
    hd = head_blob(a, L, top, bot + 1)
    pb = panel_bottom(a, L, hd["y1"] if hd else top, bot + 1)
    legvis = None if pb is None else (bot - pb)
    return {"H": H, "W": W, "head_h": None if hd is None else hd["h"],
            "legvis": legvis, "sep": feet_sep(a)}


def strip(idx, img, anim, dirn):
    rows = []
    for i in range(1, 9):
        name = f"player_hanhan__{anim}__{dirn}__{i:03d}.png"
        m = measure(crop(idx, img, name))
        m["f"] = i
        rows.append(m)
    return rows


def med(rows, k):
    v = [r[k] for r in rows if r[k] is not None]
    return None if not v else round(float(np.median(v)), 1)


def main():
    ab_i, ab = load_atlas(CW / "hanhan_stage_ab.png", CW / "hanhan_stage_ab.json")
    wk_i, wk = load_atlas(CW / "hanhan_stride4_walk.png", CW / "hanhan_stride4_walk.json")
    rn_i, rn = load_atlas(CW / "hanhan_stride4_run.png", CW / "hanhan_stride4_run.json")
    out = {}
    print(f"{'strip':28s} {'H':>6} {'W':>6} {'head':>6} {'legvis':>7} {'leg/H':>6} {'leg/head':>8} {'sep1':>6} {'sep5':>6}")
    for dirn in ["E", "W"]:
        for label, idx, img, anim in [
            ("APPROVED idle", ab_i, ab, "idle"),
            ("APPROVED walk", ab_i, ab, "walk"),
            ("APPROVED run", ab_i, ab, "run"),
            ("stride4 walk", wk_i, wk, "walk"),
            ("stride4 run", rn_i, rn, "run"),
        ]:
            rows = strip(idx, img, anim, dirn)
            H, hd, lv = med(rows, "H"), med(rows, "head_h"), med(rows, "legvis")
            sep1 = rows[0]["sep"]; sep5 = rows[4]["sep"]
            tag = f"{dirn} {label}"
            out[tag] = {"rows": rows, "H": H, "head_h": hd, "legvis": lv,
                        "sep1": sep1, "sep5": sep5}
            r1 = None if (lv is None or not H) else round(lv / H, 3)
            r2 = None if (lv is None or not hd) else round(lv / hd, 3)
            print(f"{tag:28s} {H!s:>6} {med(rows,'W')!s:>6} {hd!s:>6} {lv!s:>7} {r1!s:>6} {r2!s:>8} {sep1!s:>6} {sep5!s:>6}")
    Path(ROOT / "tools" / "legfit" / "logs" / "measure_before.json").write_text(
        json.dumps(out, indent=1))
    print("\nsaved tools/legfit/logs/measure_before.json")


if __name__ == "__main__":
    main()
