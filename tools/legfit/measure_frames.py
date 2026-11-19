#!/usr/bin/env python3
"""Measure a directory of separated 384 cells with the legfit meters
(same algorithms as measure_legfit.py / measure_sweep.py) and print a
comparison table against the saved before-measurements."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent


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
    return {"h": int(ys.max() - ys.min()) + 1, "y1": int(ys.max())}


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


def bare_leg(a):
    mask = a > 0.5
    widths = mask.sum(axis=1)
    ys, _ = np.nonzero(mask)
    bot = int(ys.max())
    wmax = widths.max()
    rows = [y for y in range(len(widths) - 6) if widths[y] >= 0.45 * wmax]
    return None if not rows else bot - max(rows)


def measure(cell):
    a = cell[..., 3] / 255.0
    L = lum(cell[..., :3])
    ys, xs = np.nonzero(a > 0.5)
    top, bot = int(ys.min()), int(ys.max())
    hd = head_blob(a, L, top, bot + 1)
    return {"H": bot - top + 1, "W": int(xs.max() - xs.min()) + 1,
            "head_h": None if hd is None else hd["h"],
            "bare": bare_leg(a), "sep": feet_sep(a)}


def med(v):
    v = [x for x in v if x is not None]
    return None if not v else round(float(np.median(v)), 1)


def main():
    fdir = Path(sys.argv[1])
    out = {}
    print(f"{'new strip':18s} {'H':>6} {'W':>6} {'head':>6} {'bareMed':>8} {'bareMax':>8} {'sep1':>6} {'sep5':>6}")
    for anim in ["walk", "run"]:
        for dirn in ["E", "W"]:
            rows = []
            for i in range(1, 9):
                p = fdir / f"player_hanhan__{anim}__{dirn}__{i:03d}.png"
                rows.append(measure(np.asarray(Image.open(p).convert("RGBA")).astype(float)))
            key = f"{dirn} {anim} NEW"
            out[key] = rows
            bares = [r["bare"] for r in rows if r["bare"] is not None]
            print(f"{key:18s} {med([r['H'] for r in rows])!s:>6} {med([r['W'] for r in rows])!s:>6} "
                  f"{med([r['head_h'] for r in rows])!s:>6} {med(bares)!s:>8} "
                  f"{max(bares) if bares else None!s:>8} {rows[0]['sep']!s:>6} {rows[4]['sep']!s:>6}")
    (HERE / "logs" / "measure_after.json").write_text(json.dumps(out, indent=1))
    print("saved logs/measure_after.json")


if __name__ == "__main__":
    main()
