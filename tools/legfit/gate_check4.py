#!/usr/bin/env python3
"""Anti-truncation gate for the stride-rebuilt strips.

Applies the HARD rules of the project gate
(game-hanhan-workflow/tools/gate_completeness.py) verbatim to the 16 new
walk/run strips. That script itself is bound to the workflow pack's QA
scope (final_report_ef.json / measured sword grips), so it cannot run
against this tree directly; the rules applied here are its body-strip
rules, unchanged:
  * EMPTY frame -> fail
  * AREA DROP: alpha area < 0.65 x strip median, or < 0.70 x the mean of
    its two neighbours -> a body part is missing -> fail
  * AREA SPIKE: alpha area > 1.45 x strip median -> fail
(Sword-pixel rules do not apply: these are unarmed locomotion strips.)
Frames are measured as full 384x384 master cells rebuilt from the packed
atlases through their own JSON pivots — exactly what the engine draws.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CW = ROOT / "assets/char_workflow"

def load(atlas_json, atlas_png):
    d = json.loads(Path(atlas_json).read_text())
    im = Image.open(atlas_png).convert("RGBA")
    out = {}
    for f in d["frames"]:
        r = f["rect"]
        cell = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        crop = im.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
        cell.alpha_composite(crop, (int(round(192 - f["pivot"]["x"])),
                                    int(round(360 - f["pivot"]["y"]))))
        out.setdefault((f["animation"], f["direction"]), []).append(
            (f["name"], cell))
    for k in out:
        out[k] = [c for _, c in sorted(out[k])]
    return out

def main():
    fm = load(CW / "hanhan_stride4_walk.json", CW / "hanhan_stride4_walk.png")
    fm.update(load(CW / "hanhan_stride4_run.json", CW / "hanhan_stride4_run.png"))
    fails = 0
    for (anim, dirn), frames in sorted(fm.items()):
        areas = []
        for c in frames:
            al = np.asarray(c)[..., 3]
            areas.append(int((al > 12).sum()))
        med = float(np.median([a for a in areas if a > 0] or [1]))
        msgs = []
        for i, a in enumerate(areas):
            if a == 0:
                msgs.append(f"f{i + 1} EMPTY"); continue
            if a < 0.65 * med:
                msgs.append(f"f{i + 1} DROP {a} < 0.65*med {0.65 * med:.0f}")
            nb = [areas[j] for j in (i - 1, i + 1) if 0 <= j < len(areas)]
            if nb and a < 0.70 * (sum(nb) / len(nb)):
                msgs.append(f"f{i + 1} DROP-NB {a} < 0.70*nbmean "
                            f"{0.70 * sum(nb) / len(nb):.0f}")
            if a > 1.45 * med:
                msgs.append(f"f{i + 1} SPIKE {a} > 1.45*med {1.45 * med:.0f}")
        ratio = [round(a / med, 2) for a in areas]
        status = "PASS" if not msgs else "FAIL"
        if msgs:
            fails += len(msgs)
        print(f"{status} {anim} {dirn:2s} median={med:.0f} area/median={ratio}"
              + (f"  -> {msgs}" if msgs else ""))
    print(f"\n{'ALL PASS' if fails == 0 else f'{fails} FAILURES'} "
          f"({sum(len(v) for v in fm.values())} frames, 16 strips)")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
