#!/usr/bin/env python3
"""Stride4 (round 5) separation: generated magenta grid sheet ->
normalized 384x384 master cells. Changes vs round 3:

- Placement X uses the TRUE head (near-white blob, head_detect.py):
  each frame is shifted so its head centroid x lands exactly on the
  APPROVED set's head centroid x for the same animation/direction/
  frame index (phase-matched). The approved sway pattern is therefore
  transferred and any constant drift or cloak-driven mis-measurement
  of the round-3 proxy is removed.
- Placement Y keeps the round-3 row-baseline rule (the sheet row's
  lowest planted foot -> ground y=360), preserving bob and flight.
- One uniform scale per sheet (figure median height -> approved idle
  height of the direction). No warp, no stretch, no per-frame rescale.

Usage:
  separate_stride3.py <sheet.png> <anim> <DIR> <outdir>
The approved head series is read from tools/stride3/approved_cells via
head_series.json (built by build_head_series.py).
Prints a JSON report line per sheet.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from head_detect import detect_head

MAG = np.array([255, 0, 255], float)


def key_alpha(rgb):
    d = np.sqrt(((rgb.astype(float) - MAG) ** 2).sum(axis=2))
    alpha = np.clip((d - 50) / 110, 0, 1)
    out = rgb.astype(float).copy()
    spill = np.minimum(out[..., 0], out[..., 2]) - out[..., 1]
    m = spill > 0
    out[..., 0] = np.where(m, out[..., 0] - spill * 0.8, out[..., 0])
    out[..., 2] = np.where(m, out[..., 2] - spill * 0.8, out[..., 2])
    return out, alpha


def bbox_of(alpha):
    ys, xs = np.nonzero(alpha > 0.5)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def main():
    sheet_p, anim, dirn, outdir = sys.argv[1:5]
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    series = json.loads((HERE / "head_series.json").read_text())
    target = series[f"{anim}|{dirn}"]          # {idle_h, head_cx[8], ...}
    anchor_h = target["idle_fig_h"]

    im = Image.open(sheet_p).convert("RGB")
    rgb = np.asarray(im)
    _, alpha = key_alpha(rgb)
    lab, n = ndimage.label(alpha > 0.5)
    comps = []
    H = alpha.shape[0]
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 4000:
            continue
        comps.append((i, xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    comps.sort(key=lambda c: (0 if (c[2] + c[4]) / 2 < H / 2 else 1, c[1]))
    if len(comps) != 8:
        print(json.dumps({"sheet": Path(sheet_p).name, "clusters": len(comps),
                          "FAIL": "expected exactly 8 figures"}))
        sys.exit(2)

    figs = []
    for (ci, x0, y0, x1, y1) in comps:
        pad = 6
        cx0, cy0 = max(0, x0 - pad), max(0, y0 - pad)
        cx1, cy1 = min(rgb.shape[1], x1 + pad), min(rgb.shape[0], y1 + pad)
        sub_rgb, sub_a = key_alpha(rgb[cy0:cy1, cx0:cx1])
        keep = (lab[cy0:cy1, cx0:cx1] == ci)
        sub_a = np.where(keep, sub_a, 0)
        rgba = np.dstack([sub_rgb, sub_a * 255]).astype(np.uint8)
        figs.append((rgba, cy0 + bbox_of(sub_a)[3],
                     0 if (y0 + y1) / 2 < H / 2 else 1))

    heights = []
    for rgba, _, _ in figs:
        bb = bbox_of(rgba[..., 3].astype(float) / 255)
        heights.append(bb[3] - bb[1])
    scale = anchor_h / float(np.median(heights))
    row_base = {}
    for _, sb, r in figs:
        row_base[r] = max(row_base.get(r, 0), sb)

    report = {"sheet": Path(sheet_p).name, "scale": round(scale, 3),
              "anchor_h": int(anchor_h), "frames": []}
    for i, (rgba, strip_bottom, r) in enumerate(figs):
        h, w = rgba.shape[:2]
        fig = Image.fromarray(rgba, "RGBA").resize(
            (round(w * scale), round(h * scale)), Image.LANCZOS)
        arr = np.asarray(fig)
        bb = bbox_of(arr[..., 3].astype(float) / 255)
        hd = detect_head(arr)
        if hd is None:
            print(json.dumps({"FAIL": f"no head in frame {i+1}",
                              "sheet": Path(sheet_p).name}))
            sys.exit(3)
        cell = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        dx = int(round(target["head_cx"][i] - hd["cx"] - bb[0] * 0))
        # hd cx is in cropped-figure coords; figure is pasted at (dx, dy)
        # so head lands at dx + hd.cx -> want == target head cx
        dx = int(round(target["head_cx"][i] - hd["cx"]))
        dy = int(round(360 - (bb[3] + (row_base[r] - strip_bottom) * scale)))
        cell.alpha_composite(fig, (dx, dy))
        name = f"player_hanhan__{anim}__{dirn}__{i+1:03d}.png"
        cell.save(outdir / name)
        hd2 = detect_head(np.asarray(cell))
        report["frames"].append({
            "name": name, "fig_h": int(bb[3] - bb[1]),
            "head_cx_err": None if hd2 is None else round(
                hd2["cx"] - target["head_cx"][i], 1),
            "head_w": hd2["w"] if hd2 else None,
            "head_h": hd2["h"] if hd2 else None,
            "bottom_off": round((row_base[r] - strip_bottom) * scale, 1),
        })
    print(json.dumps(report))


if __name__ == "__main__":
    main()
