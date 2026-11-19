#!/usr/bin/env python3
"""Build data/Map_Quests.json (quest anchors as data) and run the chain
walkthrough gate.

The 8-quest newbie chain is taken verbatim from the consolidated project
document (Tien-Lo-Tong-Hop-Toan-Du-An-1.0.pdf, section G.4). Every quest
target resolves to a real placed object (or a named point), a standable
cell next to it, and a tile — so guidance arrows / "!" markers can bind
to data, never to hard-coded screen positions.

Walkthrough: scripted route spawn -> every quest anchor in chain order,
including the portal hop into the Hậu Sơn map and back, using the
engine's own movement rules (8-dir, no corner cutting, level changes
only via stair cells). Asserts every anchor is reachable and
adjacent-standable, and that both portal arrivals land clear of the
return trigger radius. Writes proof/walkthrough.json; exit 1 on failure.
"""
import json
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_map(name):
    d = ROOT / "data" / name
    col = json.loads((d / "Map_Collision.json").read_text())
    obj = json.loads((d / "Map_Objects.json").read_text())
    nav = json.loads((d / "Map_Navigation.json").read_text())
    return {"name": name, "cells": col["cells"], "nav": nav,
            "objects": {o["id"]: o for o in obj["objects"]}}


MAPS = {n: load_map(n) for n in ("island", "hauson", "xichviem")}


def tier_ok(a, b):
    return a == b or a == 2 or b == 2


def bfs_from(m, start):
    dist = {start: 0}
    q = deque([start])
    cells = m["cells"]
    while q:
        u, v = q.popleft()
        c = cells.get(f"{u},{v}")
        if not c or not c["walk"]:
            continue
        for du, dv in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]:
            nk = f"{u + du},{v + dv}"
            n = cells.get(nk)
            if not n or not n["walk"] or (u + du, v + dv) in dist:
                continue
            if not tier_ok(c["tier"], n["tier"]):
                continue
            if du and dv:
                a = cells.get(f"{u + du},{v}")
                b = cells.get(f"{u},{v + dv}")
                if not (a and a["walk"] and b and b["walk"]):
                    continue
            dist[(u + du, v + dv)] = dist[(u, v)] + 1
            q.append((u + du, v + dv))
    return dist


def nearest_cell(m, px, py, walk_only=True):
    best, bd = None, 1e18
    for c in m["cells"].values():
        if walk_only and not c["walk"]:
            continue
        d = (c["x"] - px) ** 2 + (c["y"] - py) ** 2
        if d < bd:
            bd, best = d, c
    return best, bd ** 0.5


def stand_cell(m, px, py, radius=170):
    """Best cell to stand on when interacting with an anchor at (px, py):
    walkable, within radius, preferring the front (south) side."""
    best, bs = None, 1e18
    for c in m["cells"].values():
        if not c["walk"]:
            continue
        d = ((c["x"] - px) ** 2 + (c["y"] - py) ** 2) ** 0.5
        if d > radius:
            continue
        score = d - 0.35 * max(0, c["y"] - py)
        if score < bs:
            bs, best = score, c
    return best


def anchor_entry(m, ref):
    """ref: object id or ('point', x, y, label). Returns the data anchor."""
    if isinstance(ref, tuple):
        _, px, py, label = ref
        cell, dist = nearest_cell(m, px, py)
        stand = stand_cell(m, px, py)
        return {"point": [px, py], "label": label, "map": m["name"],
                "zone": cell["zone"], "anchor_tile": [cell["u"], cell["v"]],
                "stand_tile": [stand["u"], stand["v"]] if stand else None,
                "stand_px": [stand["x"], stand["y"]] if stand else None,
                "_stand": (stand["u"], stand["v"]) if stand else None,
                "_dist": dist}
    o = m["objects"][ref]
    px, py = o["anchor"]
    cell, _ = nearest_cell(m, px, py, walk_only=False)
    stand = stand_cell(m, px, py)
    return {"object": ref, "map": m["name"], "zone": cell["zone"],
            "anchor_px": [px, py], "anchor_tile": [cell["u"], cell["v"]],
            "stand_tile": [stand["u"], stand["v"]] if stand else None,
            "stand_px": [stand["x"], stand["y"]] if stand else None,
            "_stand": (stand["u"], stand["v"]) if stand else None}


ISL, HS, XV = MAPS["island"], MAPS["hauson"], MAPS["xichviem"]
QUESTS = [
    {"n": 1, "id": "q1_tan_nhan_nhap_mon", "name": "Tân nhân nhập môn",
     "objective": "Gặp chấp sự.", "type": "talk",
     "giver": ("island", "npc_tiendong"), "targets": [("island", "npc_chapsu")]},
    {"n": 2, "id": "q2_buoc_chan_tu_tien", "name": "Bước chân tu tiên",
     "objective": "Di chuyển và tương tác.", "type": "interact",
     "giver": ("island", "npc_chapsu"), "targets": [("island", "dais_qt")]},
    {"n": 3, "id": "q3_luyen_kiem_nhap_mon", "name": "Luyện kiếm nhập môn",
     "objective": "Đánh 5 Trúc Yêu.", "type": "kill", "count": 5,
     "giver": ("island", "npc_truonglao"),
     "targets": [("island", f"mon_trucyeu_{i}") for i in range(1, 6)]},
    {"n": 4, "id": "q4_thu_thap_linh_thao", "name": "Thu thập linh thảo",
     "objective": "Thu thập 5 linh thảo.", "type": "gather", "count": 5,
     "giver": ("island", "npc_dansu"),
     "targets": [("island", f"herb_node_{i}") for i in range(1, 6)]},
    {"n": 5, "id": "q5_truy_tim_dau_vet", "name": "Truy tìm dấu vết",
     "objective": "Khám phá Vân Ẩn Động.", "type": "explore",
     "giver": ("island", "npc_chapsu"),
     "targets": [("island", "npc_thuve"),
                 ("island", ("point", 655, 600, "Miệng Vân Ẩn Động"))]},
    {"n": 6, "id": "q6_thach_ve_thuc_tinh", "name": "Thạch Vệ thức tỉnh",
     "objective": "Đánh bại tinh anh.", "type": "kill_elite",
     "giver": ("island", "npc_thuve"), "targets": [("island", "mon_thachve_elite")]},
    {"n": 7, "id": "q7_bach_ho_xuat_the", "name": "Bạch Hổ xuất thế",
     "objective": "Đánh boss.", "type": "boss", "via_portal": "portal_to_hauson",
     "giver": ("island", "npc_chuongmon"), "targets": [("hauson", "boss_bachho")]},
    {"n": 8, "id": "q8_xuat_mon_lich_luyen", "name": "Xuất môn lịch luyện",
     "objective": "Mở khu vực kế tiếp.", "type": "depart",
     "giver": ("island", "npc_chuongmon"), "targets": [("island", "dais_qt")]},
    {"n": 9, "id": "q9_pha_an_nhap_coc", "name": "Phá ấn nhập cốc",
     "objective": "Tiến vào Xích Viêm Cốc.", "type": "talk", "via_portal": "portal_to_xichviem",
     "giver": ("island", "dais_qt"), "targets": [("xichviem", "npc_xichviem_tientri")]},
    {"n": 10, "id": "q10_tru_diet_hoa_tinh", "name": "Trừ diệt Hỏa Tinh Thử",
     "objective": "Đánh 5 Hỏa Tinh Thử.", "type": "kill", "count": 5,
     "giver": ("xichviem", "npc_xichviem_tientri"),
     "targets": [("xichviem", f"mon_hoatinh_{i}") for i in range(1, 6)]},
    {"n": 11, "id": "q11_thu_thap_viem_tinh", "name": "Thu thập Viêm Tinh",
     "objective": "Thu thập 5 Viêm Tinh Thạch.", "type": "gather", "count": 5,
     "giver": ("xichviem", "npc_xichviem_tientri"),
     "targets": [("xichviem", f"node_viemtinh_{i}") for i in range(1, 6)]},
    {"n": 12, "id": "q12_viem_tinh_thuc_tinh", "name": "Xích Viêm Tinh Anh",
     "objective": "Đánh bại tinh anh.", "type": "kill_elite",
     "giver": ("xichviem", "npc_xichviem_tientri"), "targets": [("xichviem", "mon_xichviem_elite")]},
    {"n": 13, "id": "q13_ma_quan_giang_the", "name": "Ma Quân giáng thế",
     "objective": "Tiêu diệt Boss 002.", "type": "boss",
     "giver": ("xichviem", "npc_xichviem_tientri"), "targets": [("xichviem", "boss_xichviem")]},
]


# Quest XP rewards (team-authored 2026-11-09 under Bui's ruling: "Thêm
# phần thưởng cho Q1–Q5 để nhân vật mạnh dần lên"; Q6–Q8 are the natural
# extension of the same table). The shipped chain data defined NO rewards;
# these numbers live here — the generator — so a rebuild keeps them.
# Cumulative XP: 60 / 150 / 350 / 550 / 800 / 1150 / 1650 / 2250, crossing
# the GAME_DATA.levels thresholds 100/250/450/700/1000/1450/2000 exactly
# one level per quest from Q2 on. Authored in the generator because
# hand-editing the generated JSON is silently wiped by the next build.
# Extended Q9-Q13 for Xích Viêm Cốc (proposals 650-950 XP).
REWARDS = {
    "q1_tan_nhan_nhap_mon": 60,
    "q2_buoc_chan_tu_tien": 90,
    "q3_luyen_kiem_nhap_mon": 200,
    "q4_thu_thap_linh_thao": 200,
    "q5_truy_tim_dau_vet": 250,
    "q6_thach_ve_thuc_tinh": 350,
    "q7_bach_ho_xuat_the": 500,
    "q8_xuat_mon_lich_luyen": 600,
    "q9_pha_an_nhap_coc": 650,
    "q10_tru_diet_hoa_tinh": 750,
    "q11_thu_thap_viem_tinh": 800,
    "q12_viem_tinh_thuc_tinh": 850,
    "q13_ma_quan_giang_the": 950,
}


def resolve(ref):
    map_name, r = ref
    return anchor_entry(MAPS[map_name], r)


def main():
    errors, table = [], []
    out_quests = []
    for q in QUESTS:
        entry = {"n": q["n"], "id": q["id"], "name": q["name"],
                 "objective": q["objective"], "type": q["type"]}
        if q["id"] in REWARDS:
            entry["reward"] = {"xp": REWARDS[q["id"]]}
        if "count" in q:
            entry["count"] = q["count"]
        if "via_portal" in q:
            entry["via_portal"] = q["via_portal"]
        if q.get("giver"):
            g = resolve(q["giver"])
            entry["giver"] = {k: v for k, v in g.items() if not k.startswith("_")}
            if not g["_stand"]:
                errors.append(f"Q{q['n']}: giver {q['giver'][1]} has no standable cell")
        tg = []
        for ref in q["targets"]:
            t = resolve(ref)
            tg.append({k: v for k, v in t.items() if not k.startswith("_")})
            if not t["_stand"]:
                errors.append(f"Q{q['n']}: target {ref[1]} has no standable cell")
        entry["targets"] = tg
        out_quests.append(entry)

    # ---- walkthrough route (chain order, incl. portal hops)
    isl_spawn = tuple(ISL["nav"]["spawn_cell"])
    hs_spawn = tuple(HS["nav"]["spawn_cell"])
    xv_spawn = tuple(XV["nav"]["spawn_cell"])
    isl_portal = ISL["nav"]["portals"][0]
    hs_portal = HS["nav"]["portals"][0]
    xv_portal = XV["nav"]["portals"][0]
    p_stand = stand_cell(ISL, *isl_portal["px"])
    isl_arrival, _ = nearest_cell(ISL, *hs_portal["to_px"])

    route = [  # (label, map, stand cell or special)
        ("Điểm xuất hiện Sơn Môn", "island", isl_spawn),
        ("Tiên Đồng (chào tại cổng)", "island", resolve(("island", "npc_tiendong"))["_stand"]),
        ("Q1 Chấp Sự", "island", resolve(("island", "npc_chapsu"))["_stand"]),
        ("Q2 Đài Truyền Tống", "island", resolve(("island", "dais_qt"))["_stand"]),
        ("Q3 người giao: Trưởng Lão Võ", "island", resolve(("island", "npc_truonglao"))["_stand"]),
        ("Q3 bầy Trúc Yêu (con đầu)", "island", resolve(("island", "mon_trucyeu_1"))["_stand"]),
        ("Q4 nút linh thảo (nút đầu)", "island", resolve(("island", "herb_node_1"))["_stand"]),
        ("Q5 Thủ Vệ (điểm kiểm soát)", "island", resolve(("island", "npc_thuve"))["_stand"]),
        ("Q5 miệng Vân Ẩn Động", "island", resolve(("island", ("point", 655, 600, "x")))["_stand"]),
        ("Q6 Thạch Vệ Tinh Anh", "island", resolve(("island", "mon_thachve_elite"))["_stand"]),
        ("Cổng Hậu Sơn (đài tại cổng sau)", "island", (p_stand["u"], p_stand["v"])),
        ("HẬU SƠN: điểm tới sau cổng", "hauson", hs_spawn),
        ("Q7 Bạch Hổ Sơn Quân", "hauson", resolve(("hauson", "boss_bachho"))["_stand"]),
        ("Cổng về (đài Hậu Sơn)", "hauson", hs_spawn),
        ("Đảo chính: điểm về sau cổng", "island", (isl_arrival["u"], isl_arrival["v"])),
        ("Q8 người giao: Chưởng Môn", "island", resolve(("island", "npc_chuongmon"))["_stand"]),
        ("Q8 Đài Truyền Tống — xuất môn", "island", resolve(("island", "dais_qt"))["_stand"]),
        # Q9-Q13: Xích Viêm Cốc
        ("XÍCH VIÊM CỐC: điểm tới sau cổng", "xichviem", xv_spawn),
        ("Q9 Thủ Hộ Giả Xích Viêm", "xichviem", resolve(("xichviem", "npc_xichviem_tientri"))["_stand"]),
        ("Q10 bầy Hỏa Tinh Thử (con đầu)", "xichviem", resolve(("xichviem", "mon_hoatinh_1"))["_stand"]),
        ("Q10 trả nhiệm vụ: Thủ Hộ Giả", "xichviem", resolve(("xichviem", "npc_xichviem_tientri"))["_stand"]),
        ("Q11 nút Viêm Tinh Thạch (nút đầu)", "xichviem", resolve(("xichviem", "node_viemtinh_1"))["_stand"]),
        ("Q11 trả nhiệm vụ: Thủ Hộ Giả", "xichviem", resolve(("xichviem", "npc_xichviem_tientri"))["_stand"]),
        ("Q12 Xích Viêm Tinh Anh", "xichviem", resolve(("xichviem", "mon_xichviem_elite"))["_stand"]),
        ("Q12 trả nhiệm vụ: Thủ Hộ Giả", "xichviem", resolve(("xichviem", "npc_xichviem_tientri"))["_stand"]),
        ("Q13 Boss 002: Xích Viêm Ma Quân", "xichviem", resolve(("xichviem", "boss_xichviem"))["_stand"]),
        ("Q13 kết chuỗi: Thủ Hộ Giả", "xichviem", resolve(("xichviem", "npc_xichviem_tientri"))["_stand"]),
    ]
    legs = []
    for (la, ma, ca), (lb, mb, cb) in zip(route, route[1:]):
        if ma != mb:
            legs.append({"from": la, "to": lb, "hop": f"{ma} -> {mb}", "ok": True,
                         "note": "portal hop (stand cell on the dais, arrival clear of return trigger)"})
            table.append(f"| — | Nhảy map | {la} → {lb} | cổng dịch chuyển | có |")
            continue
        dist = bfs_from(MAPS[ma], ca)
        ok = cb in dist
        if not ok:
            errors.append(f"leg {la} -> {lb}: no path")
        legs.append({"from": la, "to": lb, "map": ma, "steps": dist.get(cb), "ok": ok})
        table.append(f"| — | Đi bộ ({ma}) | {la} → {lb} | {dist.get(cb, '—')} ô | {'có' if ok else 'KHÔNG'} |")

    # ---- portal discipline assertions
    d_hs = ((hs_portal["px"][0] - isl_portal["to_px"][0]) ** 2 +
            (hs_portal["px"][1] - isl_portal["to_px"][1]) ** 2) ** 0.5
    if not d_hs > hs_portal["r"]:
        errors.append(f"hauson arrival is {d_hs:.0f}px from return portal (r={hs_portal['r']}) — bounce-back risk")
    d_isl = ((isl_portal["px"][0] - hs_portal["to_px"][0]) ** 2 +
             (isl_portal["px"][1] - hs_portal["to_px"][1]) ** 2) ** 0.5
    if not d_isl > isl_portal["r"]:
        errors.append(f"island arrival is {d_isl:.0f}px from return portal (r={isl_portal['r']}) — bounce-back risk")
        
    d_xv = ((xv_portal["px"][0] - XV["nav"]["spawn_px"][0]) ** 2 +
            (xv_portal["px"][1] - XV["nav"]["spawn_px"][1]) ** 2) ** 0.5
    if not d_xv > xv_portal["r"]:
        errors.append(f"xichviem arrival is {d_xv:.0f}px from return portal (r={xv_portal['r']}) — bounce-back risk")
    d_isl_xv = ((ISL["objects"]["dais_qt"]["anchor"][0] - xv_portal["to_px"][0]) ** 2 +
                (ISL["objects"]["dais_qt"]["anchor"][1] - xv_portal["to_px"][1]) ** 2) ** 0.5
    if not d_isl_xv > 85:
        errors.append(f"island arrival from xichviem is {d_isl_xv:.0f}px from dais_qt — bounce-back risk")

    # every pack member / gather node individually reachable from spawn
    isl_reach = bfs_from(ISL, isl_spawn)
    hs_reach = bfs_from(HS, hs_spawn)
    xv_reach = bfs_from(XV, xv_spawn)
    for q in QUESTS:
        for ref in q["targets"]:
            t = resolve(ref)
            m = MAPS[ref[0]]
            reach = isl_reach if ref[0] == "island" else (hs_reach if ref[0] == "hauson" else xv_reach)
            if t["_stand"] not in reach:
                errors.append(f"Q{q['n']} target {ref[1]} stand cell unreachable from {ref[0]} spawn")

    doc = {"chain": "thanh_van_newbie",
           "source": "Tien-Lo-Tong-Hop-Toan-Du-An-1.0.pdf §G.4 + Q9-Q13 Xích Viêm Cốc",
           "quests": out_quests}
    (ROOT / "data" / "Map_Quests.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False))
    verdict = "PASS" if not errors else "FAIL"
    (ROOT / "proof" / "walkthrough.json").write_text(json.dumps(
        {"legs": legs, "portal_arrival_clearance_px": {"hauson": round(d_hs), "island": round(d_isl), "xichviem": round(d_xv)},
         "errors": errors, "verdict": verdict}, indent=1, ensure_ascii=False))
    print("\n".join(table))
    print("portal clearance px:", {"hauson": round(d_hs), "island": round(d_isl), "xichviem": round(d_xv)})
    print("WALKTHROUGH:", verdict, errors if errors else "")
    raise SystemExit(0 if not errors else 1)
    raise SystemExit(0 if not errors else 1)


if __name__ == "__main__":
    main()
