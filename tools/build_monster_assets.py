#!/usr/bin/env python3
"""Build and standardize monster animation metadata and Linh Lang death frames."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MON_DIR = ROOT / "assets" / "monsters"

def extend_linhlang():
    src_p = MON_DIR / "monster_linhlang_sheet_v1.png"
    out_p = MON_DIR / "monster_linhlang_full_sheet_v1.png"
    im = Image.open(src_p).convert("RGBA")
    w, h = im.size # 576, 96 (6 frames of 96x96)
    
    # Create 8 frames (768 x 96)
    out = Image.new("RGBA", (96 * 8, 96), (0, 0, 0, 0))
    out.paste(im, (0, 0))
    
    # Frame 5 is hit/recoil. Let's make frame 6 (falling down) and frame 7 (flat on ground)
    f5 = im.crop((5 * 96, 0, 6 * 96, 96))
    
    # Frame 6: flinch down, sinking into ground
    f6 = f5.resize((96, 68), Image.Resampling.LANCZOS)
    f6_canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    f6_canvas.paste(f6, (0, 28))
    out.paste(f6_canvas, (6 * 96, 0))
    
    # Frame 7: flat on ground, legs collapsed
    f7 = f5.resize((102, 42), Image.Resampling.LANCZOS)
    f7_canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    f7_canvas.paste(f7, (-3, 54))
    # Slight transparency fade
    arr7 = np.array(f7_canvas)
    arr7[:, :, 3] = (arr7[:, :, 3].astype(np.float32) * 0.8).astype(np.uint8)
    out.paste(Image.fromarray(arr7, "RGBA"), (7 * 96, 0))
    
    out.save(out_p, format="PNG")
    print(f"Saved: {out_p}")
    
    meta_linhlang = {
        "name": "monster_linhlang_full_sheet_v1",
        "cellW": 96, "cellH": 96, "cols": 8, "rows": 1,
        "animations": {
            "idle": {"frames": [0], "fps": 1},
            "move": {"frames": [1, 2, 3], "fps": 8, "loop": True},
            "telegraph": {"frames": [4], "fps": 2},
            "attack": {"frames": [4], "fps": 4},
            "hit": {"frames": [5], "fps": 4},
            "death": {"frames": [6, 7], "fps": 3, "hold_last": True}
        }
    }
    (MON_DIR / "monster_linhlang_full_sheet_v1.json").write_text(json.dumps(meta_linhlang, indent=2))

def meta_trucyeu():
    meta = {
        "name": "monster_trucyeu_sheet_v1",
        "cellW": 200, "cellH": 220, "cols": 4, "rows": 5,
        "animations": {
            "idle": {"frames": [0, 1, 2, 3], "fps": 4, "pingpong": True},
            "move": {"frames": [4, 5, 6, 7], "fps": 6, "loop": True},
            "telegraph": {"frames": [12, 13], "fps": 3},
            "attack": {"frames": [8, 9, 10, 11], "fps": 7},
            "hit": {"frames": [14, 15], "fps": 5},
            "death": {"frames": [16, 17, 18, 19], "fps": 4, "hold_last": True}
        }
    }
    (MON_DIR / "monster_trucyeu_sheet_v1.json").write_text(json.dumps(meta, indent=2))

def meta_thachve():
    meta = {
        "name": "monster_thachve_sheet_v1",
        "cellW": 96, "cellH": 96, "cols": 6, "rows": 1,
        "animations": {
            "idle": {"frames": [0, 1], "fps": 2, "pingpong": True},
            "move": {"frames": [2, 0, 1], "fps": 3, "loop": True},
            "telegraph": {"frames": [2], "fps": 2},
            "attack": {"frames": [3], "fps": 4},
            "hit": {"frames": [4], "fps": 4},
            "death": {"frames": [5], "fps": 2, "hold_last": True}
        }
    }
    (MON_DIR / "monster_thachve_sheet_v1.json").write_text(json.dumps(meta, indent=2))

if __name__ == "__main__":
    extend_linhlang()
    meta_trucyeu()
    meta_thachve()
    print("Monster assets ready.")
