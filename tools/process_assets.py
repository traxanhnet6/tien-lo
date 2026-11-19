#!/usr/bin/env python3
"""Cut every prop out of the generated white-background sheets.

Method: near-white mask -> connected components (scipy). Components touching
the image border are background; enclosed near-white, low-saturation pockets
(the gate arch opening, gaps under stall canopies) are background too.
Everything else is the subject. Alpha is feathered and edges are de-spilled
(un-premultiplied from white) so no white halo survives.

Sheets are split into individual props along empty gutters (runs of columns /
rows with no subject pixels), then each prop is trimmed to its alpha bbox.
Gate and hall are additionally split into roof / body pieces with an 8 px
overlap band so the seam is invisible when both are drawn at the same anchor.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "gen"
OUT = ROOT / "assets" / "objects"
OUT.mkdir(parents=True, exist_ok=True)


def keyout(img: Image.Image) -> Image.Image:
    """Return RGBA with the white background removed."""
    rgb = np.asarray(img.convert("RGB")).astype(np.int32)
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    white = mn > 242
    lab, n = ndimage.label(white)
    bg = np.zeros(white.shape, bool)
    if n:
        border_ids = set(np.unique(np.concatenate(
            [lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))) - {0}
        sizes = ndimage.sum(white, lab, range(1, n + 1))
        meansat = ndimage.mean(sat, lab, range(1, n + 1))
        for i in range(1, n + 1):
            if i in border_ids:
                bg |= lab == i
            elif sizes[i - 1] < 0.40 * white.size and meansat[i - 1] < 0.06:
                bg |= lab == i  # enclosed flat white pocket (arch, canopy gap)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    a_img = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(a_img).astype(np.float32) / 255.0
    # de-spill: un-premultiply from white on partial pixels
    out = rgb.astype(np.float32)
    partial = (alpha > 0.01) & (alpha < 0.99)
    if partial.any():
        a = alpha[partial][:, None]
        out[partial] = np.clip((out[partial] - (1 - a) * 255.0) / a, 0, 255)
    rgba = np.dstack([out, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def trim(img: Image.Image, pad=4) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    if bbox is None:
        return img
    x0 = max(0, bbox[0] - pad); y0 = max(0, bbox[1] - pad)
    x1 = min(img.width, bbox[2] + pad); y1 = min(img.height, bbox[3] + pad)
    return img.crop((x0, y0, x1, y1))


def bands(profile: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    """Split a 1-D subject profile into (start, end) bands split at empty runs."""
    runs, start = [], None
    empty = 0
    for i, v in enumerate(profile):
        if v > 0:
            if start is None:
                start = i
            empty = 0
        elif start is not None:
            empty += 1
            if empty >= min_gap:
                runs.append((start, i - empty + 1))
                start, empty = None, 0
    if start is not None:
        runs.append((start, len(profile)))
    return runs


def split_sheet(img: Image.Image, names: list[str]) -> dict:
    alpha = np.asarray(img.getchannel("A")) > 10
    col_bands = bands(alpha.sum(axis=0), 14)
    pieces = []
    for (cx0, cx1) in col_bands:
        strip = alpha[:, cx0:cx1]
        row_bands = bands(strip.sum(axis=1), 14)
        for (ry0, ry1) in row_bands:
            pieces.append((cx0, ry0, cx1, ry1))
    pieces.sort(key=lambda b: (round(b[1] / 200), b[0]))  # row-major
    saved = {}
    assert len(pieces) == len(names), f"expected {len(names)} pieces, got {len(pieces)}: {pieces}"
    for name, (x0, y0, x1, y1) in zip(names, pieces):
        prop = trim(img.crop((x0, y0, x1, y1)))
        prop.save(OUT / f"{name}.png")
        saved[name] = {"w": prop.width, "h": prop.height}
        print(" ", name, prop.size)
    return saved


def split_roof_body(img: Image.Image, name: str, cut_frac: float) -> dict:
    cut = int(img.height * cut_frac)
    overlap = 8
    roof = img.crop((0, 0, img.width, cut + overlap))
    body = img.crop((0, cut, img.width, img.height))
    roof.save(OUT / f"{name}_roof.png")
    body.save(OUT / f"{name}_body.png")
    print(f"  {name}: full {img.size}, cut@{cut} roof {roof.size} body {body.size}")
    return {
        f"{name}_full": {"w": img.width, "h": img.height},
        f"{name}_roof": {"w": roof.width, "h": roof.height, "cut_from_top": 0},
        f"{name}_body": {"w": body.width, "h": body.height, "cut_from_top": cut},
    }


def main():
    index = {}
    sheets = {
        "trees_sheet": ["tree_pine", "tree_blossom", "tree_willow", "tree_ancient"],
        "bamboo_pine": ["bamboo", "tree_pine_wind"],
        "stalls_sheet": ["stall_a", "stall_b"],
        "stone_props": ["lantern", "burner", "stele"],
        "small_props": ["bush_flower", "bush_green", "rocks", "rock_stand", "grass_tuft", "flower_patch"],
    }
    raws = {p.stem.replace("-", "_"): p for p in GEN.glob("*.png")}
    def find(stem_part):
        for stem, p in raws.items():
            if stem_part in stem:
                return p
        raise FileNotFoundError(stem_part)

    for sheet, names in sheets.items():
        print(sheet)
        index.update(split_sheet(keyout(Image.open(find(sheet))), names))

    print("gate")
    gate = trim(keyout(Image.open(find("gate_paifang"))))
    gate.save(OUT / "gate_full.png")
    index.update(split_roof_body(gate, "gate", 0.47))
    print("hall")
    hall = trim(keyout(Image.open(find("hall_facade"))))
    hall.save(OUT / "hall_full.png")
    index.update(split_roof_body(hall, "hall", 0.60))

    (ROOT / "assets" / "objects_index.json").write_text(json.dumps(index, indent=1))
    print("index:", len(index), "entries")


if __name__ == "__main__":
    main()
