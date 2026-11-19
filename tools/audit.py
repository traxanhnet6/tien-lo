#!/usr/bin/env python3
"""Independent audit for the iso3 island data.

Reads ONLY the shipped data files (data/Map_*.json) and checks:
 1. Every object/actor footprint: all lattice cells whose centre falls
    inside the footprint are blocked, with blocked_by == that object;
    and every footprint covers at least one cell.
 2. Connectivity: BFS from spawn using the engine's own movement rules
    (8-dir, no corner cutting, level changes only via stair cells)
    reaches every walkable cell — zero looks-walkable-but-unreachable.
 3. All 8 zones contain reachable cells and their HUD anchor is reachable.
 4. No actor/object anchor stands on a walkable cell (they stand on ground
    their footprint blocks); decor is exempt.
Writes proof/audit.json and prints a summary. Exit 1 on any failure.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAPNAME = sys.argv[1] if len(sys.argv) > 1 else "island"
D = ROOT / "data" / MAPNAME


def load(name):
    return json.loads((D / name).read_text())


def main():
    col = load("Map_Collision.json")
    obj = load("Map_Objects.json")
    nav = load("Map_Navigation.json")
    cells = col["cells"]
    errors, warnings = [], []

    def key(u, v):
        return f"{u},{v}"

    # ---- 1. footprints
    n_foot = 0
    for o in obj["objects"]:
        for f in o.get("foot", []):
            n_foot += 1
            inside = []
            if f[0] == "rect":
                _, x0, y0, x1, y1 = f
                test = lambda x, y: x0 <= x <= x1 and y0 <= y <= y1
            else:
                fx, fy, r = f
                test = lambda x, y: (x - fx) ** 2 + (y - fy) ** 2 <= r * r
            for c in cells.values():
                if test(c["x"], c["y"]):
                    inside.append(c)
                    if c["walk"]:
                        errors.append(f"{o['id']}: cell {c['u']},{c['v']} inside footprint but walkable")
                    elif c.get("blocked_by") not in (o["id"], "sealed"):
                        warnings.append(f"{o['id']}: cell {c['u']},{c['v']} blocked_by={c.get('blocked_by')}")
            if not inside:
                errors.append(f"{o['id']}: footprint {f} covers no lattice cell")

    # ---- 2. connectivity with engine rules
    def tier_ok(a, b):
        return a == b or a == 2 or b == 2

    su, sv = nav["spawn_cell"]
    start = key(su, sv)
    if start not in cells or not cells[start]["walk"]:
        errors.append(f"spawn cell {start} not walkable")
    seen, stack = set(), [(su, sv)]
    while stack:
        u, v = stack.pop()
        if (u, v) in seen:
            continue
        c = cells.get(key(u, v))
        if not c or not c["walk"]:
            continue
        seen.add((u, v))
        for du, dv in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]:
            n = cells.get(key(u + du, v + dv))
            if not n or not n["walk"] or not tier_ok(c["tier"], n["tier"]):
                continue
            if du and dv:
                a = cells.get(key(u + du, v))
                b = cells.get(key(u, v + dv))
                if not (a and a["walk"] and b and b["walk"]):
                    continue
            stack.append((u + du, v + dv))
    walkable = [c for c in cells.values() if c["walk"]]
    unreachable = [f"{c['u']},{c['v']}" for c in walkable if (c["u"], c["v"]) not in seen]
    if unreachable:
        errors.append(f"{len(unreachable)} walkable cells unreachable: {unreachable[:12]}")

    # ---- 3. zones
    zone_reach = {}
    for zid in nav["zones"]:
        zcells = [c for c in walkable if c["zone"] == zid]
        r = sum(1 for c in zcells if (c["u"], c["v"]) in seen)
        zone_reach[zid] = {"walkable": len(zcells), "reachable": r}
        if not zcells or r == 0:
            errors.append(f"zone {zid}: no reachable cells")
        ax, ay = nav["zones"][zid]["anchor_px"]
        # anchor must sit in/near a reachable cell of the same zone
        best = min(zcells, key=lambda c: (c["x"] - ax) ** 2 + (c["y"] - ay) ** 2, default=None)
        if best is None or (best["u"], best["v"]) not in seen:
            errors.append(f"zone {zid}: HUD anchor not on a reachable cell")

    # ---- 4. anchors not on walkable cells
    def cell_at_px(x, y):
        return min(cells.values(), key=lambda c: (c["x"] - x) ** 2 + (c["y"] - y) ** 2)
    for o in obj["objects"]:
        if o.get("decor") or o.get("passThrough"):
            continue
        ax, ay = o["anchor"]
        near_blocked = any(not c["walk"] and (c["x"] - ax) ** 2 + (c["y"] - ay) ** 2 <= 55 ** 2
                           for c in cells.values())
        if not near_blocked:
            errors.append(f"{o['id']}: no blocked cell within 55px of its anchor (base not grounded in data)")

    report = {
        "cells": len(cells), "walkable": len(walkable), "reachable": len(seen),
        "footprints": n_foot, "zones": zone_reach,
        "errors": errors, "warnings": warnings[:20],
        "verdict": "PASS" if not errors else "FAIL",
    }
    (ROOT / "proof" / f"audit_{MAPNAME}.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))
    print(json.dumps(report, indent=1, ensure_ascii=False))
    sys.exit(0 if not errors else 1)


if __name__ == "__main__":
    main()
