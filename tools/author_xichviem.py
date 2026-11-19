#!/usr/bin/env python3
"""Author iso3 map data for Xích Viêm Cốc (xichviem).

Zones:
  1. xich_viem_ngoai: Thềm Nhập Cốc (entry spawn, return dais, guardian NPC)
  2. hoa_nham_vuc: Hỏa Nham Vực (hunting grounds, 5 Viêm Tinh nodes, normal monsters)
  3. xich_viem_dan: Xích Viêm Đàn (Boss 002 arena, elite monster, wide dodge space)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EX, EY = (46, 23), (-46, 23)
PAINT = (2240, 1120)
ORIGIN = (1120, 140)


def in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def tier_ok(a, b):
    return a == b or a == 2 or b == 2


def build_cells(origin, paint, zones):
    def proj(u, v):
        return (origin[0] + u * EX[0] + v * EY[0], origin[1] + u * EX[1] + v * EY[1])
        
    cells = {}
    for u in range(-30, 81):
        for v in range(-30, 81):
            x, y = proj(u, v)
            if not (-80 <= x <= paint[0] + 80 and -80 <= y <= paint[1] + 80):
                continue
            zone, tier = None, None
            # Test in order of priority: boss arena first, middle, entrance
            for zid in ["xich_viem_dan", "hoa_nham_vuc", "xich_viem_ngoai"]:
                t, poly = zones[zid]
                if in_poly(x, y, poly):
                    zone, tier = zid, t
                    break
            if zone is None:
                continue
            cells[f"{u},{v}"] = {
                "u": u, "v": v, "x": round(x), "y": round(y),
                "tier": tier, "zone": zone, "walk": True
            }
    return cells


def apply_footprints(cells, objects):
    for o in objects:
        for f in o.get("foot", []):
            for c in cells.values():
                if f[0] == "rect":
                    hit = f[1] <= c["x"] <= f[3] and f[2] <= c["y"] <= f[4]
                else:
                    hit = (c["x"] - f[0]) ** 2 + (c["y"] - f[1]) ** 2 <= f[2] ** 2
                if hit and c["walk"]:
                    c["walk"] = False
                    c["blocked_by"] = o["id"]


def seal_unreachable(cells, spawn_cell):
    seen, stack = set(), [spawn_cell]
    while stack:
        u, v = stack.pop()
        if (u, v) in seen:
            continue
        c = cells.get(f"{u},{v}")
        if not c or not c["walk"]:
            continue
        seen.add((u, v))
        for du, dv in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]:
            n = cells.get(f"{u + du},{v + dv}")
            if not n or not n["walk"] or not tier_ok(c["tier"], n["tier"]):
                continue
            if du and dv:
                a = cells.get(f"{u + du},{v}")
                b = cells.get(f"{u},{v + dv}")
                if not (a and a["walk"] and b and b["walk"]):
                    continue
            stack.append((u + du, v + dv))
            
    sealed = 0
    for c in cells.values():
        if c["walk"] and (c["u"], c["v"]) not in seen:
            c["walk"] = False
            c["blocked_by"] = "sealed"
            sealed += 1
    return len(seen), sealed


def circ(x, y, r):
    return [x, y, r]


def rect(x0, y0, x1, y1):
    return ["rect", x0, y0, x1, y1]


class ObjList:
    def __init__(self):
        self.list = []

    def obj(self, oid, sprite, anchor, w, foot=None, **kw):
        o = {"id": oid, "sprite": sprite, "anchor": list(anchor), "w": w}
        if foot:
            o["foot"] = foot
        o.update(kw)
        self.list.append(o)
        return o

    def actor(self, oid, img, anchor, h, label, atype, foot_r=30, **kw):
        a = {"type": atype, "img": img, "h": h, "label": label, "shadowW": max(40, foot_r * 2)}
        a.update(kw)
        o = {"id": oid, "anchor": list(anchor), "actor": a,
             "foot": [circ(anchor[0], anchor[1], foot_r)]}
        self.list.append(o)
        return o


def build_xichviem_map():
    # Polygons with generous overlaps so there are no seams or unassigned cells
    zones = {
        "xich_viem_dan": (0, [
            (240, 160), (2000, 160), (2120, 530), (120, 530), (140, 360)
        ]),
        "hoa_nham_vuc": (0, [
            (110, 480), (2130, 480), (1980, 810), (1460, 810), (780, 810), (260, 810)
        ]),
        "xich_viem_ngoai": (0, [
            (760, 770), (1480, 770), (1580, 990), (1360, 1010), (1360, 1085),
            (880, 1085), (880, 1010), (660, 990)
        ]),
    }
    
    labels = {
        "xich_viem_ngoai": "Thềm Nhập Cốc",
        "hoa_nham_vuc": "Hỏa Nham Vực",
        "xich_viem_dan": "Xích Viêm Đàn",
    }
    
    anchors = {
        "xich_viem_ngoai": (1120, 880),
        "hoa_nham_vuc": (1120, 640),
        "xich_viem_dan": (1120, 380),
    }
    
    H = ObjList()
    
    # 1. Entrance Area (xich_viem_ngoai)
    # Return portal dais
    H.obj("dais_portal_xv", "dais", (1120, 1015), 300, decor=True)
    # Guardian NPC
    H.actor("npc_xichviem_tientri", "assets/npc/npc_chapsu_thanhvan_v1.png", (1020, 840), 118,
            "Thủ Hộ Giả Xích Viêm", "npc", foot_r=30)
    # Entrance burners and stele
    H.obj("burner_xv_l", "burner", (900, 780), 110, foot=[circ(900, 780, 33)])
    H.obj("burner_xv_r", "burner", (1340, 780), 110, foot=[circ(1340, 780, 33)])
    H.obj("stele_xv", "stele", (800, 880), 95, foot=[circ(800, 880, 25)])
    
    # 2. Hunting Ground (hoa_nham_vuc)
    # Rocks on sides
    H.obj("rocks_xv_l", "rocks", (500, 620), 130, foot=[circ(500, 620, 40)])
    H.obj("rocks_xv_r", "rocks", (1720, 620), 130, foot=[circ(1720, 620, 40)])
    
    # 5 Gathering nodes for Q11 (flower_patch decor)
    herb_coords = [(720, 680), (920, 600), (1320, 600), (1520, 680), (1120, 700)]
    for i, (hx, hy) in enumerate(herb_coords):
        H.obj(f"node_viemtinh_{i + 1}", "flower_patch", (hx, hy), 110, decor=True)
        
    # 5 Hỏa Tinh Thử for Q10
    mon_coords = [(800, 640), (980, 660), (1260, 660), (1440, 640), (1120, 600)]
    for i, (mx, my) in enumerate(mon_coords):
        H.actor(f"mon_hoatinh_{i + 1}", "assets/monsters/monster_hoatinh_sheet_v1.png", (mx, my), 95,
                "Hỏa Tinh Thử", "monster", foot_r=28)
                
    # Other normal monsters
    H.actor("mon_hoanhamlang_1", "assets/monsters/monster_hoanhamlang_sheet_v1.png", (650, 560), 110,
            "Hỏa Nham Lang", "monster", foot_r=32)
    H.actor("mon_hoanhamlang_2", "assets/monsters/monster_hoanhamlang_sheet_v1.png", (1590, 560), 110,
            "Hỏa Nham Lang", "monster", foot_r=32)
    H.actor("mon_viemnham_1", "assets/monsters/monster_viemnham_sheet_v1.png", (860, 480), 145,
            "Viêm Nham Khôi Lỗi", "monster", foot_r=36)
            
    # 3. Boss Arena (xich_viem_dan)
    # Elite monster for Q12
    H.actor("mon_xichviem_elite", "assets/monsters/monster_xichviem_elite_sheet_v1.png", (1380, 440), 185,
            "Xích Viêm Tinh Anh", "monster", foot_r=46)
            
    # Boss 002 for Q13
    H.actor("boss_xichviem", "assets/boss/boss_xichviem_v1.png", (1120, 420), 330,
            "Xích Viêm Ma Quân", "boss", foot_r=95, bob=2.2, bobSpeed=0.7, labelLift=26)
            
    objects = H.list
    
    # Portals: return portal to island dais_qt
    # Island dais_qt is at [2820, 1572], stand is ~[2820, 1700]
    portals = [
        {
            "id": "portal_to_island",
            "px": [1120, 1015],
            "r": 85,
            "to_map": "island",
            "to_px": [2820, 1700],
            "label": "Về Thanh Vân"
        }
    ]
    
    fx = [
        {"x": 1120, "y": 420, "r": 280, "n": 18, "color": "rgba(255,100,40,0.85)"},
        {"x": 1120, "y": 650, "r": 220, "n": 12, "color": "rgba(255,160,50,0.75)"}
    ]
    
    # Build cells & footprints
    cells = build_cells(ORIGIN, PAINT, zones)
    apply_footprints(cells, objects)
    
    spawn_px = (1120, 880)
    best = min((c for c in cells.values() if c["walk"]),
               key=lambda c: (c["x"] - spawn_px[0]) ** 2 + (c["y"] - spawn_px[1]) ** 2)
    reach, sealed = seal_unreachable(cells, (best["u"], best["v"]))
    walk = sum(1 for c in cells.values() if c["walk"])
    
    out_dir = ROOT / "data" / "xichviem"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    col_data = {
        "paint": {"w": PAINT[0], "h": PAINT[1]},
        "lattice": {"origin": list(ORIGIN), "ex": list(EX), "ey": list(EY)},
        "cells": cells
    }
    (out_dir / "Map_Collision.json").write_text(json.dumps(col_data))
    
    obj_data = {"objects": objects}
    (out_dir / "Map_Objects.json").write_text(json.dumps(obj_data, indent=1))
    
    nav_data = {
        "ground": "assets/ground_xichviem.jpg",
        "paint": {"w": PAINT[0], "h": PAINT[1]},
        "origin": list(ORIGIN),
        "ex": list(EX),
        "ey": list(EY),
        "spawn_px": list(spawn_px),
        "spawn_cell": [best["u"], best["v"]],
        "zones": {z: {"label": labels[z], "anchor_px": list(anchors[z])} for z in zones},
        "portals": portals,
        "fx": fx
    }
    (out_dir / "Map_Navigation.json").write_text(json.dumps(nav_data, indent=1))
    
    per_zone = {}
    for c in cells.values():
        if c["walk"]:
            per_zone[c["zone"]] = per_zone.get(c["zone"], 0) + 1
            
    print(f"[xichviem] cells={len(cells)} walkable={walk} reachable={reach} "
          f"sealed={sealed} objects={len(objects)} zones={per_zone}")


if __name__ == "__main__":
    build_xichviem_map()
