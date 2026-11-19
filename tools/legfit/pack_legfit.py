#!/usr/bin/env python3
"""Pack the legfit frames (frames_final/) into the gd3 engine atlases.

Identical layout/JSON format to pack_stride4.py; only the E/W walk+run
rows differ from the merged stride4 atlases (leg-proportion fix), walk E
frames 1/5 are the approved stage A-D contact cells. All other rows are
re-packed from pixel-identical crops of the previous atlases.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FRAMES = Path(__file__).resolve().parent / "frames_final"
CW = ROOT / "assets" / "char_workflow"
DIRS = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"]

STATUS = ("CHUA NGHIEM THU (legfit 2026-11-10: E/W walk+run rows "
          "re-anchored on the approved stage A-D proportions - compact "
          "legs, long robe panels, stride per stride4 calc; walk E "
          "frames 1/5 are the approved stage A-D cells verbatim; other "
          "rows unchanged from stride4 round 5, awaiting Bui verdict)")")

for anim in ["walk", "run"]:
    atlas = Image.new("RGBA", (384 * 8, 384 * 8), (0, 0, 0, 0))
    frames = []
    for r, d in enumerate(DIRS):
        for c in range(8):
            name = f"player_hanhan__{anim}__{d}__{c + 1:03d}.png"
            cell = Image.open(FRAMES / name).convert("RGBA")
            assert cell.size == (384, 384), (name, cell.size)
            atlas.alpha_composite(cell, (384 * c, 384 * r))
            frames.append({
                "name": name, "animation": anim, "direction": d,
                "rect": {"x": 384 * c, "y": 384 * r, "w": 384, "h": 384},
                "duration_ms": 125,
                "pivot": {"x": 192, "y": 360},
                "pivot_norm": {"x": 0.5, "y": 0.9375},
                "weapon_socket": None, "event_markers": [],
            })
    out_png = CW / f"hanhan_stride4_{anim}.png"
    atlas.save(out_png)
    data = {
        "status": STATUS,
        "atlas": out_png.name,
        "size": {"w": 384 * 8, "h": 384 * 8},
        "scale_from_master": 1.0,
        "master": {"cell": {"w": 384, "h": 384}, "char_height_px": 352,
                   "ground_y_in_cell": 360,
                   "pivot_norm": {"x": 0.5, "y": 0.9375},
                   "display_height_px": 118},
        "frames": frames,
    }
    (CW / f"hanhan_stride4_{anim}.json").write_text(json.dumps(data, indent=2))
    print(anim, "packed", len(frames), "frames ->", out_png.name)
