#!/usr/bin/env python3
"""Author iso3 map data — TWO maps (user correction 09:12: Hậu Sơn is a
separate map, not an island zone).

  data/island/  Thanh Vân island, 7 zones, ground = stitched painted scenes.
  data/hauson/  Hậu Sơn boss map, ground = its own painted scene.

Landmark coordinates are hand-fitted to the paintings. Zone polygons carry
small spikes down each painted stair so no cell-less moat opens between
zones at a tier change. Object footprints match each sprite's visible
base. Unreachable walkable cells are sealed per map. The two maps connect
through portal daises whose arrival spawns sit OUTSIDE the return trigger
radius (anti bounce-back discipline).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IDX = json.loads((ROOT / "assets" / "objects_index.json").read_text())
EX, EY = (46, 23), (-46, 23)


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


def build_cells(origin, paint, zones, stairs, bands, pools):
    def proj(u, v):
        return (origin[0] + u * EX[0] + v * EY[0], origin[1] + u * EX[1] + v * EY[1])
    cells = {}
    for u in range(-30, 81):
        for v in range(-30, 81):
            x, y = proj(u, v)
            if not (-80 <= x <= paint[0] + 80 and -80 <= y <= paint[1] + 80):
                continue
            zone, tier = None, None
            for zid, (t, poly) in zones.items():
                if in_poly(x, y, poly):
                    zone, tier = zid, t
            if zone is None:
                continue
            cells[f"{u},{v}"] = {"u": u, "v": v, "x": round(x), "y": round(y),
                                 "tier": tier, "zone": zone, "walk": True}
    for (x0, y0, x1, y1, why) in bands + [(*p, "pool") for p in pools]:
        for c in cells.values():
            if x0 <= c["x"] <= x1 and y0 <= c["y"] <= y1 and c["walk"]:
                c["walk"] = False
                c["blocked_by"] = why
    for (x0, y0, x1, y1, zid) in stairs:
        for c in cells.values():
            if x0 <= c["x"] <= x1 and y0 <= c["y"] <= y1:
                c["walk"] = True
                c["tier"] = 2
                c["zone"] = zid
                c.pop("blocked_by", None)
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


def split_roof_dy(sprite, w):
    full = IDX[sprite + "_full"]
    body = IDX[sprite + "_body"]
    H = w * full["h"] / full["w"]
    body_top = body["cut_from_top"] / full["h"] * H
    return -round(H - body_top) + 8


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


NPC = "assets/npc/"
MON = "assets/monsters/"
STRIP = {"sheet": {"cellW": 96, "cellH": 96, "cols": 6, "frames": [0, 1, 2, 3], "fps": 3, "pingpong": True}}
TRUCYEU = {"sheet": {"cellW": 200, "cellH": 220, "cols": 4, "frames": [0, 1, 2, 3], "fps": 3}}

# ================================================================ ISLAND (7 zones)
ISL_ORIGIN = (2200, 150)
ISL_PAINT = (4400, 2640)
ISL_ZONES = {
    "son_mon": (0, [(1300, 2140), (4280, 2140), (4340, 2540), (1360, 2540)]),
    "quang_truong": (0, [(1300, 1560), (4340, 1560), (4340, 2130), (1300, 2130)]),
    "dai_dien": (1, [(1330, 790), (1420, 790), (1420, 695), (2170, 695), (2170, 790),
                     (3030, 790), (3030, 1490), (2380, 1490), (2380, 1600),
                     (2010, 1600), (2010, 1490), (1330, 1490)]),
    "luyen_vo": (1, [(3000, 860), (4310, 860), (4310, 1450), (3480, 1450),
                     (3480, 1600), (2980, 1600), (2980, 1490), (3000, 1490)]),
    "linh_tuyen": (1, [(3060, 70), (4340, 70), (4340, 620), (4100, 760),
                       (3400, 800), (3340, 940), (3120, 940), (3120, 790), (3060, 740)]),
    "truc_lam": (0, [(80, 1300), (1400, 1300), (1400, 2560), (80, 2560)]),
    "van_an": (1, [(80, 150), (1340, 150), (1340, 1160), (80, 1160)]),
}
ISL_LABELS = {
    "son_mon": "Sơn Môn", "quang_truong": "Quảng Trường", "dai_dien": "Đại Điện",
    "luyen_vo": "Luyện Võ Trường", "truc_lam": "Trúc Linh Lâm",
    "linh_tuyen": "Linh Tuyền", "van_an": "Vân Ẩn Động",
}
ISL_ANCHORS = {
    "son_mon": (2200, 2470), "quang_truong": (2820, 1660), "dai_dien": (2200, 1300),
    "luyen_vo": (3650, 1180), "truc_lam": (650, 1850), "linh_tuyen": (3600, 470),
    "van_an": (760, 760),
}
ISL_STAIRS = [
    (2010, 1120, 2380, 1590, "dai_dien"),
    (2980, 1360, 3480, 1590, "luyen_vo"),
]
ISL_BANDS = [
    (1250, 1455, 2010, 1585, "edge"), (2380, 1455, 2980, 1585, "edge"),
    (3480, 1455, 4400, 1585, "edge"),
]
ISL_POOLS = [
    (2900, 40, 3560, 270), (3330, 240, 3790, 425), (3610, 385, 3850, 480),
    (3690, 420, 4130, 580), (3960, 540, 4300, 780),
]

O = ObjList()
obj, actor = O.obj, O.actor
# --- Sơn Môn
obj("gate_sm", "gate", (2200, 2362), 430, kind="split",
    roof_front_dy=split_roof_dy("gate", 430), passThrough=True,
    foot=[rect(2200 - 215 + 26, 2336, 2200 - 215 + 118, 2368),
          rect(2200 + 215 - 118, 2336, 2200 + 215 - 26, 2368)])
obj("lantern_sm_l", "lantern", (1965, 2405), 54, foot=[circ(1965, 2405, 30)])
obj("lantern_sm_r", "lantern", (2435, 2405), 54, foot=[circ(2435, 2405, 30)])
obj("stele_sm_l", "stele", (1740, 2330), 95, foot=[circ(1740, 2330, 22)])
obj("stele_sm_r", "stele", (2660, 2330), 95, foot=[circ(2660, 2330, 22)])
obj("tree_sm_wind", "tree_pine_wind", (1620, 2260), 200, foot=[circ(1620, 2260, 30)])
obj("tree_sm_blossom", "tree_blossom", (3050, 2240), 210, foot=[circ(3050, 2240, 31)])
obj("rocks_sm", "rocks", (3560, 2380), 130, foot=[circ(3560, 2380, 40)])
obj("bush_sm_1", "bush_flower", (1850, 2540), 95, decor=True)
obj("bush_sm_2", "bush_flower", (2680, 2520), 95, decor=True)
obj("tuft_sm", "grass_tuft", (3300, 2180), 90, decor=True)
actor("npc_tiendong", NPC + "npc_tiendong_v1.png", (2405, 2425), 110, "Tiên Đồng", "npc")
# --- Quảng Trường
obj("dais_qt", "dais", (2820, 1572), 330, decor=True)
actor("npc_chapsu", NPC + "npc_chapsu_thanhvan_v1.png", (2665, 1615), 118, "Chấp Sự", "npc")
obj("stall_dansu", "stall_a", (1560, 1700), 240, foot=[rect(1560 - 108, 1668, 1560 + 108, 1712)])
actor("npc_dansu", NPC + "npc_dansu_v1.png", (1560, 1795), 118, "Đan Dược Sư", "npc")
obj("stall_herb", "stall_b", (1560, 2010), 230, foot=[rect(1560 - 103, 1978, 1560 + 103, 2022)])
obj("stall_forge", "stall_b", (3920, 1720), 250, foot=[rect(3920 - 112, 1688, 3920 + 112, 1732)])
actor("npc_thoren", NPC + "npc_thoren_v1.png", (3920, 1820), 118, "Thợ Rèn", "npc")
obj("rack_forge", "rack", (4080, 1675), 115, foot=[rect(4080 - 52, 1648, 4080 + 52, 1682)])
obj("weights_forge", "weights", (3785, 1855), 105, foot=[circ(3785, 1855, 36)])
obj("stall_thuongnhan", "stall_a", (3520, 2005), 240, foot=[rect(3520 - 108, 1973, 3520 + 108, 2017)])
actor("npc_thuongnhan", NPC + "npc_thuongnhan_v1.png", (3520, 2095), 118, "Thương Nhân", "npc")
obj("lantern_qt_l", "lantern", (2615, 1745), 54, foot=[circ(2615, 1745, 30)])
obj("lantern_qt_r", "lantern", (3025, 1745), 54, foot=[circ(3025, 1745, 30)])
obj("tree_qt_ancient", "tree_ancient", (1750, 1655), 240, foot=[circ(1750, 1655, 36)])
obj("tree_qt_pine", "tree_pine", (4150, 1950), 200, foot=[circ(4150, 1950, 30)])
obj("tree_qt_blossom", "tree_blossom", (3620, 1600), 190, foot=[circ(3620, 1600, 29)])
obj("rocks_qt", "rocks", (2050, 2055), 120, foot=[circ(2050, 2055, 37)])
obj("flowers_qt_1", "flower_patch", (2400, 1900), 120, decor=True)
obj("flowers_qt_2", "flower_patch", (3150, 1950), 120, decor=True)
obj("bush_qt", "bush_green", (1900, 1900), 100, decor=True)
# --- Đại Điện (+ rear-gate portal platform on the terrace's north edge)
obj("daidien_hall", "daidien", (2200, 1015), 900, kind="split",
    roof_front_dy=split_roof_dy("daidien", 900),
    foot=[rect(2200 - 396, 895, 2200 + 396, 1020)])
actor("npc_chuongmon", NPC + "npc_chuongmon_v1.png", (2200, 1215), 122, "Chưởng Môn", "npc")
obj("burner_dd_l", "burner", (1905, 1250), 120, foot=[circ(1905, 1250, 36)])
obj("burner_dd_r", "burner", (2495, 1250), 120, foot=[circ(2495, 1250, 36)])
obj("lantern_dd_l", "lantern", (2050, 1085), 54, foot=[circ(2050, 1085, 30)])
obj("lantern_dd_r", "lantern", (2350, 1085), 54, foot=[circ(2350, 1085, 30)])
obj("tree_dd_wind", "tree_pine_wind", (1560, 1000), 210, foot=[circ(1560, 1000, 32)])
obj("tree_dd_ancient", "tree_ancient", (2880, 985), 230, foot=[circ(2880, 985, 35)])
obj("stele_dd", "stele", (1700, 1335), 95, foot=[circ(1700, 1335, 22)])
obj("bush_dd", "bush_flower", (2650, 1380), 95, decor=True)
obj("dais_portal_hs", "dais", (1560, 746), 300, decor=True)
obj("lantern_portal_l", "lantern", (1450, 828), 54, foot=[circ(1450, 828, 30)])
obj("lantern_portal_r", "lantern", (1670, 828), 54, foot=[circ(1670, 828, 30)])
obj("stele_portal", "stele", (1760, 835), 95, foot=[circ(1760, 835, 22)])
# --- Luyện Võ Trường
actor("npc_truonglao", NPC + "npc_truonglao_vo_v1.png", (3380, 985), 120, "Trưởng Lão Võ", "npc")
obj("dummy_lv1", "dummy", (3980, 995), 100, foot=[circ(3980, 995, 20)])
obj("dummy_lv2", "dummy", (4120, 1075), 100, foot=[circ(4120, 1075, 20)])
obj("dummy_lv3", "dummy", (4050, 1245), 100, foot=[circ(4050, 1245, 20)])
obj("rack_lv1", "rack", (3450, 905), 120, foot=[rect(3450 - 55, 878, 3450 + 55, 912)])
obj("rack_lv2", "rack", (4180, 905), 120, foot=[rect(4180 - 55, 878, 4180 + 55, 912)])
obj("weights_lv", "weights", (3620, 920), 105, foot=[circ(3620, 920, 36)])
actor("npc_kiemsi", NPC + "npc_kiemsi_v1.png", (3760, 1255), 118, "Đệ Tử Luyện Võ", "npc")
obj("rocks_lv", "rocks", (3180, 1330), 120, foot=[circ(3180, 1330, 37)])
obj("lantern_lv", "lantern", (3220, 1010), 54, foot=[circ(3220, 1010, 30)])
obj("bush_lv", "bush_green", (4250, 1300), 100, decor=True)
# --- Linh Tuyền
obj("rockstand_lt", "rock_stand", (3480, 480), 100, foot=[circ(3480, 480, 30)])
obj("lantern_lt", "lantern", (3260, 868), 54, foot=[circ(3260, 868, 30)])
obj("flowers_lt_1", "flower_patch", (3250, 700), 110, decor=True)
obj("flowers_lt_2", "flower_patch", (3950, 645), 110, decor=True)
obj("bush_lt", "bush_flower", (3650, 762), 95, decor=True)
# --- Trúc Linh Lâm (5 Trúc Yêu for quest 3, 5 herb nodes for quest 4)
for i, (x, y) in enumerate([(520, 1560), (820, 1980), (420, 2260), (1010, 2200), (280, 1700)]):
    actor(f"mon_trucyeu_{i + 1}", MON + "monster_trucyeu_sheet_v1.png", (x, y), 190,
          "Trúc Yêu", "monster", foot_r=40, **TRUCYEU)
actor("mon_linhlang_1", MON + "monster_linhlang_sheet_v1.png", (950, 1660), 92, "Linh Lang", "monster", **STRIP)
actor("mon_linhlang_2", MON + "monster_linhlang_sheet_v1.png", (640, 2140), 92, "Linh Lang", "monster", **STRIP)
for i, (x, y) in enumerate([(300, 1420), (1080, 1500), (240, 1780), (1150, 2050), (900, 2380), (350, 2480)]):
    obj(f"bamboo_tl_{i}", "bamboo", (x, y), 120, foot=[circ(x, y, 26)])
obj("tree_tl_pine", "tree_pine", (700, 1400), 200, foot=[circ(700, 1400, 30)])
obj("tree_tl_willow", "tree_willow", (1080, 2280), 220, foot=[circ(1080, 2280, 33)])
obj("tree_tl_ancient", "tree_ancient", (180, 2050), 240, foot=[circ(180, 2050, 36)])
obj("rocks_tl", "rocks", (980, 1820), 110, foot=[circ(980, 1820, 34)])
obj("bush_tl_1", "bush_green", (600, 1750), 100, decor=True)
obj("bush_tl_2", "bush_flower", (760, 2320), 95, decor=True)
obj("flowers_tl", "flower_patch", (480, 1900), 110, decor=True)
for i, (x, y) in enumerate([(560, 1620), (700, 1900), (450, 2180), (900, 2050), (620, 1480)]):
    obj(f"herb_node_{i + 1}", "flower_patch", (x, y), 120, decor=True)
# --- Vân Ẩn Động (Thạch Vệ elite for quest 6)
obj("cave_va", "cave_full", (470, 545), 600, foot=[rect(150, 170, 830, 560)])
actor("npc_thuve", NPC + "npc_thuve_v1.png", (720, 645), 118, "Thủ Vệ", "npc")
actor("mon_thachve_1", MON + "monster_thachve_sheet_v1.png", (880, 750), 130, "Thạch Vệ", "monster", foot_r=36, **STRIP)
actor("mon_thachve_2", MON + "monster_thachve_sheet_v1.png", (1200, 1080), 130, "Thạch Vệ", "monster", foot_r=36, **STRIP)
actor("mon_thachve_elite", MON + "monster_thachve_sheet_v1.png", (1005, 900), 178, "Thạch Vệ Tinh Anh", "monster", foot_r=46, **STRIP)
obj("lantern_va_l", "lantern", (600, 705), 54, foot=[circ(600, 705, 30)])
obj("lantern_va_r", "lantern", (845, 695), 54, foot=[circ(845, 695, 30)])
obj("rocks_va", "rocks", (1150, 420), 130, foot=[circ(1150, 420, 40)])
obj("rockstand_va", "rock_stand", (1250, 1080), 100, foot=[circ(1250, 1080, 30)])
obj("bush_va", "bush_green", (1000, 600), 95, decor=True)
ISL_OBJECTS = O.list

# ================================================================ HẬU SƠN (separate map)
HS_ORIGIN = (1120, 140)
HS_PAINT = (2240, 1120)
HS_ZONES = {
    "hauson": (0, [(260, 170), (1980, 170), (2100, 520), (1960, 830), (1560, 990),
                   (1340, 1010), (1340, 1085), (900, 1085), (900, 1010),
                   (640, 980), (300, 900), (150, 640), (170, 360)]),
}
H = ObjList()
hobj, hactor = H.obj, H.actor
hobj("dais_portal_back", "dais", (1120, 1015), 300, decor=True)
hactor("boss_bachho", "assets/boss/boss_bachho_sonquan_v1.png", (1120, 440), 330,
       "Bạch Hổ Sơn Quân", "boss", foot_r=95, bob=2.2, bobSpeed=0.7, labelLift=26)
hobj("burner_hs", "burner", (1120, 800), 110, foot=[circ(1120, 800, 33)])
hobj("lantern_hs_l", "lantern", (905, 760), 58, foot=[circ(905, 760, 30)])
hobj("lantern_hs_r", "lantern", (1335, 760), 58, foot=[circ(1335, 760, 30)])
hobj("stele_hs", "stele", (790, 640), 95, foot=[circ(790, 640, 22)])
hobj("rocks_hs", "rocks", (1560, 320), 130, foot=[circ(1560, 320, 40)])
hobj("tree_hs_pine", "tree_pine", (660, 330), 190, foot=[circ(660, 330, 29)])
HS_OBJECTS = H.list


def write_map(dirname, origin, paint, zones, stairs, bands, pools, objects,
              ground, spawn_px, labels, anchors, portals, fx):
    cells = build_cells(origin, paint, zones, stairs, bands, pools)
    apply_footprints(cells, objects)
    best = min((c for c in cells.values() if c["walk"]),
               key=lambda c: (c["x"] - spawn_px[0]) ** 2 + (c["y"] - spawn_px[1]) ** 2)
    reach, sealed = seal_unreachable(cells, (best["u"], best["v"]))
    walk = sum(1 for c in cells.values() if c["walk"])
    d = ROOT / "data" / dirname
    d.mkdir(parents=True, exist_ok=True)
    (d / "Map_Collision.json").write_text(json.dumps(
        {"paint": {"w": paint[0], "h": paint[1]},
         "lattice": {"origin": list(origin), "ex": list(EX), "ey": list(EY)}, "cells": cells}))
    (d / "Map_Objects.json").write_text(json.dumps({"objects": objects}, indent=1))
    nav = {
        "ground": ground,
        "paint": {"w": paint[0], "h": paint[1]},
        "origin": list(origin), "ex": list(EX), "ey": list(EY),
        "spawn_px": list(spawn_px), "spawn_cell": [best["u"], best["v"]],
        "zones": {z: {"label": labels[z], "anchor_px": list(anchors[z])} for z in zones},
        "portals": portals,
        "fx": fx,
    }
    (d / "Map_Navigation.json").write_text(json.dumps(nav, indent=1))
    per_zone = {}
    for c in cells.values():
        if c["walk"]:
            per_zone[c["zone"]] = per_zone.get(c["zone"], 0) + 1
    print(f"[{dirname}] cells={len(cells)} walkable={walk} reachable={reach} "
          f"sealed={sealed} objects={len(objects)} zones={per_zone}")


def main():
    write_map(
        "island", ISL_ORIGIN, ISL_PAINT, ISL_ZONES, ISL_STAIRS, ISL_BANDS, ISL_POOLS,
        ISL_OBJECTS, "assets/ground.jpg", (2200, 2470), ISL_LABELS, ISL_ANCHORS,
        portals=[{"id": "portal_to_hauson", "px": [1560, 746], "r": 85,
                  "to_map": "hauson", "to_px": [1120, 880], "label": "Cổng Hậu Sơn"}],
        fx=[
            {"x": 3600, "y": 400, "r": 170, "n": 22, "color": "rgba(170,240,255,0.85)"},
            {"x": 2200, "y": 1000, "r": 200, "n": 12, "color": "rgba(255,230,160,0.85)"},
            {"x": 600, "y": 1560, "r": 130, "n": 14, "color": "rgba(170,255,215,0.85)"},
        ])
    write_map(
        "hauson", HS_ORIGIN, HS_PAINT, HS_ZONES, [], [], [],
        HS_OBJECTS, "assets/ground_hauson.jpg", (1120, 880),
        {"hauson": "Hậu Sơn"}, {"hauson": (1120, 560)},
        portals=[{"id": "portal_to_island", "px": [1120, 1015], "r": 90,
                  "to_map": "island", "to_px": [1560, 872], "label": "Về Thanh Vân"}],
        fx=[{"x": 1120, "y": 430, "r": 260, "n": 14, "color": "rgba(255,215,150,0.8)"}])


if __name__ == "__main__":
    main()
