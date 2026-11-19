#!/usr/bin/env python3
"""True head detection shared by stride3 tools.

The head is the large near-white blob in the upper part of the figure
(the white round head). The robe's white skirt sits lower and is split
from the head by the dark armor, so the highest large near-white
connected component is the head for every direction (front, profile and
back views alike).

detect_head(rgba) -> dict with head bbox, centroid, or None.
"""
import numpy as np
from scipy import ndimage


def detect_head(rgba):
    im = rgba.astype(float)
    rgb, a = im[..., :3], im[..., 3] / 255.0
    mask = a > 0.5
    if mask.sum() < 100:
        return None
    ys, xs = np.nonzero(mask)
    top, bot = ys.min(), ys.max() + 1
    H = bot - top
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    white = mask & (lum >= 190)
    white[bot - int(0.52 * H):] = False          # head lives in upper 52%
    lab, n = ndimage.label(white)
    best = None
    for i in range(1, n + 1):
        ys2, xs2 = np.nonzero(lab == i)
        if len(xs2) < 0.06 * mask.sum():
            continue
        cand = (ys2.min(), len(xs2), ys2, xs2)
        if best is None or cand[0] < best[0]:
            best = cand
    if best is None:
        return None
    _, _, ys2, xs2 = best
    w = a[ys2, xs2]
    return {
        "cx": float((xs2 * w).sum() / w.sum()),
        "cy": float((ys2 * w).sum() / w.sum()),
        "x0": int(xs2.min()), "x1": int(xs2.max()) + 1,
        "y0": int(ys2.min()), "y1": int(ys2.max()) + 1,
        "w": int(xs2.max() - xs2.min()) + 1,
        "h": int(ys2.max() - ys2.min()) + 1,
        "area": int(len(xs2)),
    }
