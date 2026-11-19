#!/usr/bin/env python3
"""Process the iso3 round of generated assets (daidien, cave, training
props, dais, thoren NPC) with the iso2 keyout method.

Reuses keyout / trim / split_sheet / split_roof_body from process_assets.py
(copied from game-tien-lo-iso2/tools/). Raws live in gen_new/; outputs go to
assets/objects/ (and assets/npc/ for thoren). New entries are merged into
assets/objects_index.json without touching the existing iso2 entries.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from process_assets import keyout, trim, split_sheet, split_roof_body, OUT  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402
from scipy import ndimage  # noqa: E402


def keyout_wash(img: Image.Image) -> Image.Image:
    """keyout variant for sheets whose props cast a soft warm ground wash.

    The wash (light, low-saturation) bridges the gaps between props, so the
    plain near-white mask sees one blob. Here the background candidates are
    near-white OR wash pixels; only candidates connected to the image border
    (plus enclosed flat pockets, as in iso2's keyout) become background, so
    light low-saturation detail enclosed inside a prop (stone highlights,
    steel tips) survives.
    """
    rgb = np.asarray(img.convert("RGB")).astype(np.int32)
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    cand = (mn > 242) | ((mn > 165) & (sat < 0.20))
    lab, n = ndimage.label(cand)
    bg = np.zeros(cand.shape, bool)
    if n:
        border_ids = set(np.unique(np.concatenate(
            [lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))) - {0}
        sizes = ndimage.sum(cand, lab, range(1, n + 1))
        meansat = ndimage.mean(sat, lab, range(1, n + 1))
        for i in range(1, n + 1):
            if i in border_ids:
                bg |= lab == i
            elif sizes[i - 1] < 0.40 * cand.size and meansat[i - 1] < 0.06:
                bg |= lab == i
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    a_img = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(a_img).astype(np.float32) / 255.0
    out = rgb.astype(np.float32)
    partial = (alpha > 0.01) & (alpha < 0.99)
    if partial.any():
        a = alpha[partial][:, None]
        out[partial] = np.clip((out[partial] - (1 - a) * 255.0) / a, 0, 255)
    rgba = np.dstack([out, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "gen_new"
NPC_OUT = ROOT / "assets" / "npc"


def raw(part: str) -> Path:
    for p in GEN.glob("*.png"):
        if part in p.stem:
            return p
    raise FileNotFoundError(part)


def main():
    index_path = ROOT / "assets" / "objects_index.json"
    index = json.loads(index_path.read_text())

    print("daidien")
    hall = trim(keyout(Image.open(raw("daidien"))))
    hall.save(OUT / "daidien_full.png")
    index.update(split_roof_body(hall, "daidien", 0.58))

    print("cave")
    cave = trim(keyout(Image.open(raw("cave"))), pad=0)
    cave.save(OUT / "cave_full.png")
    index["cave_full"] = {"w": cave.width, "h": cave.height}
    print("  cave_full", cave.size)

    print("training sheet")
    # v1 of the sheet carried a painted ground wash that bridged the props
    # and survived keyout as a cream fringe; v2 was regenerated with an
    # explicit no-shadow prompt and splits cleanly with the plain keyout.
    index.update(split_sheet(keyout(Image.open(raw("training-sheet-v2"))),
                             ["dummy", "rack", "weights"]))

    print("dais")
    dais = trim(keyout(Image.open(raw("dais"))))
    dais.save(OUT / "dais.png")
    index["dais"] = {"w": dais.width, "h": dais.height}
    print("  dais", dais.size)

    print("thoren npc -> exactly 96x120, feet at bottom edge")
    thoren = trim(keyout(Image.open(raw("thoren"))), pad=0)
    scale = min(96 / thoren.width, 120 / thoren.height)
    thoren = thoren.resize((round(thoren.width * scale),
                            round(thoren.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (96, 120), (0, 0, 0, 0))
    canvas.paste(thoren, ((96 - thoren.width) // 2, 120 - thoren.height), thoren)
    canvas.save(NPC_OUT / "npc_thoren_v1.png")
    print("  npc_thoren_v1", canvas.size, "scaled prop", thoren.size)

    index_path.write_text(json.dumps(index, indent=1))
    print("index:", len(index), "entries")


if __name__ == "__main__":
    main()
