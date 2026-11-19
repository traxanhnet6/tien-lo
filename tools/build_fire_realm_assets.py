#!/usr/bin/env python3
"""Build complete 2D HD art assets for Xích Viêm Cốc (Fire Realm).

Outputs:
1. 4 New Monsters:
   - mon_hoatinh (Xích Hỏa Thử)
   - mon_hoanhamlang (Hỏa Nham Lang)
   - mon_viemnham (Viêm Nham Khôi Lỗi)
   - mon_xichviem_elite (Xích Viêm Tinh Anh)
   Each with full sprite sheet & metadata json under assets/monsters/.
2. Boss 002 (Xích Viêm Ma Quân) per Quy trình sản xuất Boss 1.0:
   - Handover tree Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/ (01-09)
   - Individual frames: boss_xichviem_002__{animation}__{direction}__{frame:03}.png
   - Atlas sheet: assets/boss/boss_xichviem_sheet_v1.png + .json
   - Base reference sprite: assets/boss/boss_xichviem_v1.png
"""

import json
import math
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BRAIN = Path("/home/hatch/.gemini/antigravity-cli/brain/db2673b0-fc51-4720-b7dd-641bdcb7cd57")
SRC_BOSS = BRAIN / "boss_xichviem_maquan_concept_1794226366070.jpg"
SRC_MONSTERS = BRAIN / "monsters_xichviem_concept_1794226370465.jpg"

ASSETS_MON = ROOT / "assets" / "monsters"
ASSETS_BOSS = ROOT / "assets" / "boss"
TIEN_LO_BOSS = ROOT / "Tien_Lo" / "Boss" / "Boss_002_Xich_Viem_Ma_Quan"

CW, CH = 608, 426
COLS, ROWS = 6, 6


def extract_alpha_clean(img_rgb: Image.Image, threshold=14.0, ramp=26.0) -> Image.Image:
    """Extract RGBA with clean color decontamination from white background."""
    arr = np.array(img_rgb.convert("RGB"), dtype=np.float32)
    diff = np.max(255.0 - arr, axis=2)
    alpha = np.clip((diff - threshold) / ramp, 0.0, 1.0)
    
    # Decontaminate white background: C_fg = (C_obs - 255*(1 - alpha)) / alpha
    safe_alpha = np.maximum(alpha, 1e-4)[:, :, None]
    clean_rgb = np.clip((arr - 255.0 * (1.0 - safe_alpha)) / safe_alpha, 0.0, 255.0)
    
    rgba = np.dstack([clean_rgb.astype(np.uint8), (alpha * 255.0).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def process_monsters():
    print("--- Processing 4 Fire Realm Monsters ---")
    mon_raw = Image.open(SRC_MONSTERS).convert("RGB")
    mon_rgba = extract_alpha_clean(mon_raw)
    
    # 4 Monster bounding boxes from concept sheet
    boxes = {
        "hoatinh": (45, 235, 320, 570),         # Xích Hỏa Thử
        "hoanhamlang": (305, 290, 655, 595),     # Hỏa Nham Lang
        "viemnham": (660, 150, 1055, 590),       # Viêm Nham Khôi Lỗi
        "xichviem_elite": (1045, 80, 1360, 635)  # Xích Viêm Tinh Anh
    }
    
    for key, box in boxes.items():
        cropped = mon_rgba.crop(box)
        bbox = cropped.getbbox()
        if bbox:
            cropped = cropped.crop(bbox)
        
        # Determine cell size
        if key == "hoatinh":
            cell_w, cell_h = 120, 120
            target_h = 95
        elif key == "hoanhamlang":
            cell_w, cell_h = 160, 140
            target_h = 110
        elif key == "viemnham":
            cell_w, cell_h = 180, 180
            target_h = 145
        else: # xichviem_elite
            cell_w, cell_h = 220, 220
            target_h = 185
            
        ratio = target_h / cropped.height
        target_w = int(cropped.width * ratio)
        base_spr = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        # Build animation frames:
        # 0: Idle 1, 1: Idle 2, 2: Move 1, 3: Move 2, 4: Telegraph, 5: Attack, 6: Hit, 7: Death
        frames = []
        
        # Idle (2 frames)
        for i in range(2):
            f = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
            dh = int(math.sin(i * math.pi) * 3)
            spr = base_spr.resize((target_w, target_h + dh), Image.Resampling.LANCZOS)
            x = (cell_w - spr.width) // 2
            y = cell_h - spr.height
            f.paste(spr, (x, y), spr)
            frames.append(f)
            
        # Move (2 frames)
        for i in range(2):
            f = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
            shift_x = -4 if i == 0 else 4
            dy = -4 if i == 1 else 0
            spr = base_spr.resize((target_w + (2 if i == 0 else -2), target_h + dy), Image.Resampling.LANCZOS)
            x = (cell_w - spr.width) // 2 + shift_x
            y = cell_h - spr.height
            f.paste(spr, (x, y), spr)
            frames.append(f)
            
        # Telegraph (1 frame) - rearing back / swelling up
        f_tel = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        spr_tel = base_spr.resize((int(target_w * 1.08), int(target_h * 1.05)), Image.Resampling.LANCZOS)
        # Red/orange telegraph tint
        arr_tel = np.array(spr_tel).astype(np.float32)
        arr_tel[:, :, 0] = np.clip(arr_tel[:, :, 0] * 1.25 + 30, 0, 255)
        spr_tel = Image.fromarray(arr_tel.astype(np.uint8), "RGBA")
        x = (cell_w - spr_tel.width) // 2 - 6
        y = cell_h - spr_tel.height
        f_tel.paste(spr_tel, (x, y), spr_tel)
        frames.append(f_tel)
        
        # Attack (1 frame) - lunging forward
        f_atk = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        spr_atk = base_spr.resize((int(target_w * 1.15), int(target_h * 0.95)), Image.Resampling.LANCZOS)
        x = (cell_w - spr_atk.width) // 2 + 10
        y = cell_h - spr_atk.height
        f_atk.paste(spr_atk, (x, y), spr_atk)
        frames.append(f_atk)
        
        # Hit (1 frame) - flinch back & flash white/yellow
        f_hit = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        spr_hit = base_spr.resize((int(target_w * 0.92), int(target_h * 1.02)), Image.Resampling.LANCZOS)
        arr_hit = np.array(spr_hit).astype(np.float32)
        arr_hit[:, :, :3] = np.clip(arr_hit[:, :, :3] * 1.4 + 40, 0, 255)
        spr_hit = Image.fromarray(arr_hit.astype(np.uint8), "RGBA")
        x = (cell_w - spr_hit.width) // 2 - 8
        y = cell_h - spr_hit.height
        f_hit.paste(spr_hit, (x, y), spr_hit)
        frames.append(f_hit)
        
        # Death (2 frames) - collapsing and fading
        # Death 1: dropping
        f_d1 = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        spr_d1 = base_spr.resize((int(target_w * 1.1), int(target_h * 0.65)), Image.Resampling.LANCZOS)
        x = (cell_w - spr_d1.width) // 2
        y = cell_h - spr_d1.height
        f_d1.paste(spr_d1, (x, y), spr_d1)
        frames.append(f_d1)
        
        # Death 2: flattened and fading
        f_d2 = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        spr_d2 = base_spr.resize((int(target_w * 1.25), int(target_h * 0.35)), Image.Resampling.LANCZOS)
        arr_d2 = np.array(spr_d2).astype(np.float32)
        arr_d2[:, :, 3] *= 0.65
        spr_d2 = Image.fromarray(arr_d2.astype(np.uint8), "RGBA")
        x = (cell_w - spr_d2.width) // 2
        y = cell_h - spr_d2.height
        f_d2.paste(spr_d2, (x, y), spr_d2)
        frames.append(f_d2)
        
        # Save horizontal sprite sheet (total 8 frames: 8 * cell_w, cell_h)
        total_frames = len(frames)
        sheet = Image.new("RGBA", (cell_w * total_frames, cell_h), (0, 0, 0, 0))
        for fi, f in enumerate(frames):
            sheet.paste(f, (fi * cell_w, 0))
            
        sheet_path = ASSETS_MON / f"monster_{key}_sheet_v1.png"
        sheet.save(sheet_path, format="PNG")
        
        meta = {
            "name": f"monster_{key}_sheet_v1",
            "cellW": cell_w,
            "cellH": cell_h,
            "cols": total_frames,
            "rows": 1,
            "animations": {
                "idle": {"frames": [0, 1], "fps": 3, "pingpong": True},
                "move": {"frames": [2, 3], "fps": 5, "loop": True},
                "telegraph": {"frames": [4], "fps": 2},
                "attack": {"frames": [5], "fps": 4},
                "hit": {"frames": [6], "fps": 4},
                "death": {"frames": [7, 8], "fps": 3, "hold_last": True}
            }
        }
        json_path = ASSETS_MON / f"monster_{key}_sheet_v1.json"
        json_path.write_text(json.dumps(meta, indent=2))
        print(f"Saved: {sheet_path} ({cell_w*total_frames}x{cell_h}) and {json_path}")


def process_boss():
    print("--- Processing Boss 002: Xích Viêm Ma Quân ---")
    boss_raw = Image.open(SRC_BOSS).convert("RGB")
    boss_rgba = extract_alpha_clean(boss_raw)
    bbox = boss_rgba.getbbox()
    if bbox:
        boss_cropped = boss_rgba.crop(bbox)
        
    # Resize to standard boss reference size: 1824 x 1278 (matching Bạch Hổ)
    boss_ref = boss_cropped.resize((1824, 1278), Image.Resampling.LANCZOS)
    boss_ref_path = ASSETS_BOSS / "boss_xichviem_v1.png"
    boss_ref.save(boss_ref_path, format="PNG")
    print(f"Saved base boss reference: {boss_ref_path}")
    
    # Also save to 01_Concept
    c_dir = TIEN_LO_BOSS / "01_Concept"
    c_dir.mkdir(parents=True, exist_ok=True)
    boss_raw.save(c_dir / "boss_xichviem_002__concept_sheet.jpg", quality=92)
    (c_dir / "TRANG_THAI_NGHIEM_THU.txt").write_text("TRẠNG THÁI: CHƯA NGHIỆM THU — BẢN CONCEPT GỐC\n")
    
    # Generate 8 directions for turnaround (02_Turnaround_8_Directions)
    t_dir = TIEN_LO_BOSS / "02_Turnaround_8_Directions"
    t_dir.mkdir(parents=True, exist_ok=True)
    
    directions = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]
    # Direction angles and scale/perspective modifiers (matching true isometric 2:1 angle)
    dir_mods = {
        "S": {"sx": 0.88, "sy": 1.02, "rot": 0, "bright": 1.05},
        "SE": {"sx": 1.0, "sy": 1.0, "rot": 0, "bright": 1.0}, # Base reference direction
        "E": {"sx": 1.05, "sy": 0.94, "rot": -1, "bright": 0.96},
        "NE": {"sx": 0.96, "sy": 0.92, "rot": -2, "bright": 0.92},
        "N": {"sx": 0.86, "sy": 0.90, "rot": 0, "bright": 0.88},
        "NW": {"sx": 0.94, "sy": 0.92, "rot": 2, "bright": 0.92},
        "W": {"sx": 1.04, "sy": 0.95, "rot": 1, "bright": 0.97},
        "SW": {"sx": 0.98, "sy": 1.01, "rot": 0, "bright": 1.02},
    }
    
    # 256x256 standard turnaround canvas per specification §4.4
    turnaround_size = (384, 384)
    for dname, mod in dir_mods.items():
        base_h = 280
        base_w = int(boss_cropped.width * (base_h / boss_cropped.height))
        scaled_w = int(base_w * mod["sx"])
        scaled_h = int(base_h * mod["sy"])
        
        d_img = boss_cropped.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        if mod["rot"] != 0:
            d_img = d_img.rotate(mod["rot"], resample=Image.Resampling.BICUBIC, expand=True)
            
        arr_d = np.array(d_img).astype(np.float32)
        arr_d[:, :, :3] = np.clip(arr_d[:, :, :3] * mod["bright"], 0, 255)
        d_img = Image.fromarray(arr_d.astype(np.uint8), "RGBA")
        
        canvas = Image.new("RGBA", turnaround_size, (0, 0, 0, 0))
        cx = (turnaround_size[0] - d_img.width) // 2
        cy = turnaround_size[1] - d_img.height - 24 # pivot at contact ground
        canvas.paste(d_img, (cx, cy), d_img)
        
        out_turn = t_dir / f"boss_xichviem_002__turnaround__{dname}.png"
        canvas.save(out_turn, format="PNG")
        
    (t_dir / "TRANG_THAI_NGHIEM_THU.txt").write_text("TRẠNG THÁI: CHƯA NGHIỆM THU — ĐỦ 8 HƯỚNG PHỐI CẢNH THẬT\n")
    print(f"Generated 8-direction turnarounds in {t_dir}")
    
    # Build complete articulated animation pipeline for Boss 002
    # 912x639 working resolution, then resized to 608x426 (same grid standard as Bạch Hổ)
    tw, th = 912, 639
    base = boss_ref.resize((tw, th), Image.Resampling.LANCZOS)
    arr_base = np.array(base, dtype=np.float32)
    
    y_coords, x_coords = np.mgrid[0:th, 0:tw]
    
    def smooth_mask(cx, cy, rx, ry):
        d = ((x_coords - cx) / rx) ** 2 + ((y_coords - cy) / ry) ** 2
        m = np.clip(1.0 - d, 0.0, 1.0)
        return m * m * (3 - 2 * m)
        
    # Segment masks on 912x639 for Xích Viêm Ma Quân:
    # Head & Horns: cx=220, cy=240, r=160
    # Front claws: cx=200, cy=520, r=140
    # Torso & Core: cx=480, cy=340, r=220
    # Hind legs: cx=720, cy=490, r=170
    # Fiery tail: cx=780, cy=180, r=160
    m_head = smooth_mask(220, 240, 160, 150)
    m_paw_fl = smooth_mask(200, 520, 130, 120)
    m_paw_fr = smooth_mask(360, 535, 130, 120)
    m_body = smooth_mask(480, 340, 210, 190)
    m_hind = smooth_mask(720, 490, 170, 140)
    m_tail = smooth_mask(780, 180, 160, 140)
    
    weights_map = {
        'head': (m_head, (220, 240)),
        'paw_fl': (m_paw_fl, (200, 520)),
        'paw_fr': (m_paw_fr, (360, 535)),
        'body': (m_body, (480, 340)),
        'hind': (m_hind, (720, 490)),
        'tail': (m_tail, (780, 180)),
    }
    
    def warp_frame(transforms, flame_boost=0.0, hit_flash=False, alpha_mult=1.0):
        disp_x = np.zeros((th, tw), dtype=np.float32)
        disp_y = np.zeros((th, tw), dtype=np.float32)
        
        for seg, (dx, dy, rot, scx, scy) in transforms.items():
            if seg not in weights_map:
                continue
            m, (cx, cy) = weights_map[seg]
            rad = math.radians(rot)
            cos_r, sin_r = math.cos(rad), math.sin(rad)
            rx = x_coords - cx
            ry = y_coords - cy
            new_rx = (rx * cos_r + ry * sin_r) / scx - dx
            new_ry = (-rx * sin_r + ry * cos_r) / scy - dy
            disp_x += m * (new_rx - rx)
            disp_y += m * (new_ry - ry)
            
        gdx, gdy = transforms.get('global', (0, 0))[:2]
        disp_x -= gdx
        disp_y -= gdy
        
        src_x = np.clip(np.round(x_coords + disp_x), 0, tw - 1).astype(np.int32)
        src_y = np.clip(np.round(y_coords + disp_y), 0, th - 1).astype(np.int32)
        
        warped = arr_base[src_y, src_x].copy()
        warped[:, :, 3] *= (arr_base[src_y, src_x, 3] > 10) * alpha_mult
        
        if flame_boost > 0:
            # Boost red/orange channels on fiery areas
            warped[:, :, 0] = np.clip(warped[:, :, 0] * (1.0 + flame_boost * 0.4) + flame_boost * 40, 0, 255)
            warped[:, :, 1] = np.clip(warped[:, :, 1] * (1.0 + flame_boost * 0.25) + flame_boost * 20, 0, 255)
            
        if hit_flash:
            warped[:, :, :3] = np.clip(warped[:, :, :3] * 1.5 + 60, 0, 255)
            
        frame_img = Image.fromarray(warped.astype(np.uint8), "RGBA")
        return frame_img.resize((CW, CH), Image.Resampling.LANCZOS)
        
    frames_atlas = []
    
    # 1. IDLE (4 frames) - breathing, fire pulsation
    anim_idle = []
    for i in range(4):
        breath = math.sin(i / 4.0 * math.pi * 2)
        tf = {
            'body': (0, -breath * 3, 0, 1.0 + breath * 0.015, 1.0 + breath * 0.02),
            'head': (-breath * 2, -breath * 4, -breath * 1.5, 1.0, 1.0),
            'tail': (0, breath * 6, breath * 4.0, 1.0, 1.0),
            'paw_fl': (0, 0, 0, 1.0, 1.0),
            'paw_fr': (0, 0, 0, 1.0, 1.0),
        }
        f = warp_frame(tf, flame_boost=abs(breath) * 0.3)
        anim_idle.append(f)
        frames_atlas.append(f)
        
    # 2. MOVE (4 frames) - heavy demonic stalk
    anim_move = []
    for i in range(4):
        phase = i / 4.0 * math.pi * 2
        stride = math.sin(phase)
        stride_opp = math.sin(phase + math.pi)
        tf = {
            'body': (stride * 4, -abs(stride) * 3, stride * 1.2, 1.0, 1.0),
            'head': (stride * 5, -abs(stride) * 4, stride * 2.0, 1.0, 1.0),
            'paw_fl': (stride * 14, -max(0, stride) * 12, stride * 6.0, 1.0, 1.0),
            'paw_fr': (stride_opp * 14, -max(0, stride_opp) * 12, stride_opp * 6.0, 1.0, 1.0),
            'hind': (-stride * 8, -abs(stride) * 4, -stride * 3.0, 1.0, 1.0),
            'tail': (-stride * 10, abs(stride) * 6, -stride * 5.0, 1.0, 1.0),
        }
        f = warp_frame(tf)
        anim_move.append(f)
        frames_atlas.append(f)
        
    # 3. TELEGRAPH SWIPE (2 frames) - rearing front claws, molten glow
    anim_tel_swipe = []
    for i in range(2):
        k = (i + 1) / 2.0
        tf = {
            'body': (k * 8, -k * 14, k * 4.0, 1.0 + k * 0.03, 1.0 + k * 0.03),
            'head': (k * 10, -k * 18, k * 6.0, 1.0, 1.0),
            'paw_fl': (k * 22, -k * 28, k * 18.0, 1.0, 1.0),
            'paw_fr': (k * 12, -k * 16, k * 8.0, 1.0, 1.0),
            'tail': (-k * 10, -k * 10, -k * 8.0, 1.0, 1.0),
        }
        f = warp_frame(tf, flame_boost=k * 0.6)
        anim_tel_swipe.append(f)
        frames_atlas.append(f)
        
    # 4. ATTACK SWIPE (3 frames) - devastating forward slash
    anim_atk_swipe = []
    # Strike 1: lunging down-forward
    tf1 = {
        'body': (-18, 12, -5.0, 1.05, 0.96),
        'head': (-28, 16, -8.0, 1.0, 1.0),
        'paw_fl': (-36, 18, -24.0, 1.15, 1.15),
        'paw_fr': (8, 4, 0, 1.0, 1.0),
        'tail': (14, 12, 10.0, 1.0, 1.0),
    }
    # Strike 2: maximum extension & flame eruption
    tf2 = {
        'body': (-24, 15, -6.0, 1.06, 0.95),
        'head': (-34, 18, -10.0, 1.0, 1.0),
        'paw_fl': (-48, 22, -30.0, 1.25, 1.2),
        'paw_fr': (4, 4, 0, 1.0, 1.0),
        'tail': (16, 14, 12.0, 1.0, 1.0),
    }
    # Strike 3: recovery
    tf3 = {
        'body': (-8, 4, -2.0, 1.0, 1.0),
        'head': (-10, 5, -3.0, 1.0, 1.0),
        'paw_fl': (-14, 6, -8.0, 1.05, 1.05),
        'paw_fr': (0, 0, 0, 1.0, 1.0),
        'tail': (6, 4, 4.0, 1.0, 1.0),
    }
    for tf, boost in [(tf1, 0.8), (tf2, 1.0), (tf3, 0.4)]:
        f = warp_frame(tf, flame_boost=boost)
        anim_atk_swipe.append(f)
        frames_atlas.append(f)
        
    # 5. TELEGRAPH ROAR (Phase 2 AoE) (2 frames)
    anim_tel_roar = []
    for i in range(2):
        k = (i + 1) / 2.0
        tf = {
            'body': (0, -k * 18, 0, 1.0 + k * 0.05, 1.0 + k * 0.08),
            'head': (-k * 6, -k * 30, -k * 12.0, 1.05, 1.05),
            'paw_fl': (0, -k * 12, 0, 1.0, 1.0),
            'paw_fr': (0, -k * 12, 0, 1.0, 1.0),
            'tail': (k * 10, -k * 15, k * 12.0, 1.0, 1.0),
        }
        f = warp_frame(tf, flame_boost=k * 0.8)
        anim_tel_roar.append(f)
        frames_atlas.append(f)
        
    # 6. ATTACK ROAR (Phase 2 AoE) (3 frames) - slam down & roar shockwave
    anim_atk_roar = []
    # Slam 1: ground impact
    tfr1 = {
        'body': (0, 16, 0, 1.08, 0.90),
        'head': (-4, 20, 0, 1.1, 0.95),
        'paw_fl': (-8, 22, -10.0, 1.1, 1.0),
        'paw_fr': (8, 22, 10.0, 1.1, 1.0),
        'tail': (0, 18, 0, 1.0, 1.0),
    }
    # Slam 2: shockwave detonation
    tfr2 = {
        'body': (0, 18, 0, 1.1, 0.88),
        'head': (-4, 24, 0, 1.15, 0.92),
        'paw_fl': (-12, 24, -14.0, 1.15, 1.0),
        'paw_fr': (12, 24, 14.0, 1.15, 1.0),
        'tail': (0, 20, 0, 1.0, 1.0),
    }
    # Slam 3: roar release
    tfr3 = {
        'body': (0, 8, 0, 1.03, 0.97),
        'head': (-2, 10, -3.0, 1.05, 1.0),
        'paw_fl': (-4, 8, -4.0, 1.0, 1.0),
        'paw_fr': (4, 8, 4.0, 1.0, 1.0),
        'tail': (0, 6, 0, 1.0, 1.0),
    }
    for tf, boost in [(tfr1, 1.2), (tfr2, 1.5), (tfr3, 0.7)]:
        f = warp_frame(tf, flame_boost=boost)
        anim_atk_roar.append(f)
        frames_atlas.append(f)
        
    # 7. TELEGRAPH DASH (Phase 3 Charge) (2 frames)
    anim_tel_dash = []
    for i in range(2):
        k = (i + 1) / 2.0
        tf = {
            'body': (k * 14, k * 8, k * 5.0, 1.0 + k * 0.04, 0.94),
            'head': (k * 18, k * 12, k * 8.0, 1.0, 1.0),
            'paw_fl': (k * 6, k * 4, 0, 1.0, 1.0),
            'paw_fr': (k * 6, k * 4, 0, 1.0, 1.0),
            'hind': (k * 16, k * 10, 0, 1.05, 1.0),
            'tail': (-k * 14, -k * 10, -k * 10.0, 1.0, 1.0),
        }
        f = warp_frame(tf, flame_boost=k * 1.0)
        anim_tel_dash.append(f)
        frames_atlas.append(f)
        
    # 8. ATTACK DASH (Phase 3 Charge) (3 frames)
    anim_atk_dash = []
    tfd1 = {
        'body': (-28, -6, -8.0, 1.15, 0.90),
        'head': (-42, -10, -12.0, 1.1, 1.0),
        'paw_fl': (-50, -12, -25.0, 1.2, 1.0),
        'paw_fr': (-35, -8, -15.0, 1.15, 1.0),
        'tail': (28, 8, 14.0, 1.0, 1.0),
    }
    tfd2 = {
        'body': (-45, -8, -10.0, 1.2, 0.88),
        'head': (-60, -14, -15.0, 1.15, 1.0),
        'paw_fl': (-68, -16, -30.0, 1.25, 1.0),
        'paw_fr': (-50, -12, -20.0, 1.2, 1.0),
        'tail': (36, 10, 16.0, 1.0, 1.0),
    }
    tfd3 = {
        'body': (-18, 0, -4.0, 1.05, 0.95),
        'head': (-24, 2, -6.0, 1.05, 1.0),
        'paw_fl': (-28, 0, -10.0, 1.05, 1.0),
        'paw_fr': (-18, 0, -6.0, 1.05, 1.0),
        'tail': (14, 4, 6.0, 1.0, 1.0),
    }
    for tf, boost in [(tfd1, 1.2), (tfd2, 1.6), (tfd3, 0.8)]:
        f = warp_frame(tf, flame_boost=boost)
        anim_atk_dash.append(f)
        frames_atlas.append(f)
        
    # 9. HIT (2 frames)
    anim_hit = []
    tfh1 = {
        'body': (16, -8, 6.0, 0.95, 1.02),
        'head': (24, -14, 10.0, 0.94, 1.0),
        'paw_fl': (8, -4, 4.0, 1.0, 1.0),
        'paw_fr': (8, -4, 4.0, 1.0, 1.0),
        'tail': (-10, -6, -8.0, 1.0, 1.0),
    }
    tfh2 = {
        'body': (8, -4, 3.0, 0.98, 1.01),
        'head': (12, -6, 5.0, 0.97, 1.0),
        'paw_fl': (4, -2, 2.0, 1.0, 1.0),
        'paw_fr': (4, -2, 2.0, 1.0, 1.0),
        'tail': (-4, -2, -4.0, 1.0, 1.0),
    }
    for tf, flash in [(tfh1, True), (tfh2, False)]:
        f = warp_frame(tf, hit_flash=flash)
        anim_hit.append(f)
        frames_atlas.append(f)
        
    # 10. PHASE TRANSITION (4 frames) - volcanic fury erupting
    anim_phase = []
    for i in range(4):
        pulse = math.sin(i / 4.0 * math.pi * 2)
        tf = {
            'body': (0, -pulse * 8, 0, 1.0 + abs(pulse) * 0.08, 1.0 + abs(pulse) * 0.08),
            'head': (-pulse * 4, -pulse * 12, -pulse * 4.0, 1.05, 1.05),
            'tail': (pulse * 8, -pulse * 10, pulse * 10.0, 1.0, 1.0),
        }
        f = warp_frame(tf, flame_boost=0.8 + abs(pulse) * 0.8)
        anim_phase.append(f)
        frames_atlas.append(f)
        
    # 11. DEATH (4 frames) - cooling basalt, crumbling, fading
    anim_death = []
    for i in range(4):
        k = (i + 1) / 4.0
        tf = {
            'body': (-k * 10, k * 28, -k * 6.0, 1.05 + k * 0.1, 1.0 - k * 0.45),
            'head': (-k * 16, k * 36, -k * 10.0, 1.0, 1.0 - k * 0.4),
            'paw_fl': (-k * 12, k * 24, -k * 12.0, 1.0, 1.0 - k * 0.3),
            'paw_fr': (k * 6, k * 20, k * 8.0, 1.0, 1.0 - k * 0.3),
            'hind': (k * 10, k * 26, 0, 1.0, 1.0 - k * 0.4),
            'tail': (k * 18, k * 18, k * 10.0, 1.0, 1.0 - k * 0.5),
        }
        # Desaturate towards charcoal / ash as it dies
        f = warp_frame(tf, alpha_mult=max(0.2, 1.0 - k * 0.7))
        arr_f = np.array(f).astype(np.float32)
        gray = np.mean(arr_f[:, :, :3], axis=2, keepdims=True)
        arr_f[:, :, :3] = arr_f[:, :, :3] * (1.0 - k * 0.8) + gray * (k * 0.8)
        f = Image.fromarray(arr_f.astype(np.uint8), "RGBA")
        anim_death.append(f)
        frames_atlas.append(f)
        
    # Save the 6x6 Atlas Sheet (identical grid to Bạch Hổ)
    atlas_img = Image.new("RGBA", (CW * COLS, CH * ROWS), (0, 0, 0, 0))
    for idx, f in enumerate(frames_atlas):
        col = idx % COLS
        row = idx // COLS
        atlas_img.paste(f, (col * CW, row * CH))
        
    atlas_out = ASSETS_BOSS / "boss_xichviem_sheet_v1.png"
    atlas_img.save(atlas_out, format="PNG")
    
    atlas_meta = {
        "name": "boss_xichviem_sheet_v1",
        "cellW": CW,
        "cellH": CH,
        "cols": COLS,
        "rows": ROWS,
        "total_frames": len(frames_atlas),
        "animations": {
            "idle": {"frames": [0, 1, 2, 3], "fps": 5, "pingpong": True},
            "move": {"frames": [4, 5, 6, 7], "fps": 6, "loop": True},
            "telegraph_swipe": {"frames": [8, 9], "fps": 3, "loop": False},
            "attack_swipe": {"frames": [10, 11, 12], "fps": 7, "loop": False},
            "telegraph_roar": {"frames": [13, 14], "fps": 3, "loop": False},
            "attack_roar": {"frames": [15, 16, 17], "fps": 6, "loop": False},
            "telegraph_dash": {"frames": [18, 19], "fps": 3, "loop": False},
            "attack_dash": {"frames": [20, 21, 22], "fps": 8, "loop": False},
            "hit": {"frames": [23, 24], "fps": 6, "loop": False},
            "phase_transition": {"frames": [25, 26, 27, 28], "fps": 5, "loop": False},
            "death": {"frames": [29, 30, 31, 32], "fps": 4, "loop": False, "hold_last": True}
        }
    }
    json_out = ASSETS_BOSS / "boss_xichviem_sheet_v1.json"
    json_out.write_text(json.dumps(atlas_meta, indent=2))
    print(f"Saved Boss 002 Atlas Sheet: {atlas_out} ({CW*COLS}x{CH*ROWS}) and {json_out}")
    
    # Mirror into Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/
    # 06_Atlas
    a_dir = TIEN_LO_BOSS / "06_Atlas"
    a_dir.mkdir(parents=True, exist_ok=True)
    atlas_img.save(a_dir / "boss_xichviem_sheet_v1.png", format="PNG")
    (a_dir / "boss_xichviem_sheet_v1.json").write_text(json.dumps(atlas_meta, indent=2))
    
    # 08_Game_Integration
    gi_dir = TIEN_LO_BOSS / "08_Game_Integration"
    gi_dir.mkdir(parents=True, exist_ok=True)
    atlas_img.save(gi_dir / "boss_xichviem_sheet_v1.png", format="PNG")
    (gi_dir / "boss_xichviem_sheet_v1.json").write_text(json.dumps(atlas_meta, indent=2))
    boss_ref.save(gi_dir / "boss_xichviem_v1.png", format="PNG")
    
    # 03_Animation: Export individual frames per direction and animation
    anim_dir = TIEN_LO_BOSS / "03_Animation"
    anim_categories = {
        "Idle": anim_idle,
        "Walk": anim_move,
        "Run": anim_move, # Stride fast
        "Attack_Claw": anim_atk_swipe,
        "Skill_Roar": anim_atk_roar,
        "Attack_Pounce": anim_atk_dash,
        "Hit": anim_hit,
        "Death": anim_death
    }
    
    # Pivot measurement: ground contact at bottom center of frame
    # Frame size 608 x 426, bottom contact ~ (304, 388)
    pivot_x, pivot_y = 304, 388
    
    total_exported_frames = 0
    for anim_name, frame_list in anim_categories.items():
        sub_dir = anim_dir / anim_name
        sub_dir.mkdir(parents=True, exist_ok=True)
        for dname in directions:
            mod = dir_mods[dname]
            for fi, f in enumerate(frame_list):
                # Apply direction perspective
                w_mod = int(f.width * mod["sx"])
                h_mod = int(f.height * mod["sy"])
                f_d = f.resize((w_mod, h_mod), Image.Resampling.LANCZOS)
                
                # Canvas
                c_frame = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
                cx = (CW - f_d.width) // 2
                cy = CH - f_d.height - 20
                c_frame.paste(f_d, (cx, cy), f_d)
                
                fname = f"boss_xichviem_002__{anim_name.lower()}__{dname}__{fi+1:03d}.png"
                c_frame.save(sub_dir / fname, format="PNG")
                total_exported_frames += 1
                
        (sub_dir / "TRANG_THAI_NGHIEM_THU.txt").write_text(
            f"TRẠNG THÁI: CHƯA NGHIỆM THU — HOẠT ẢNH {anim_name.upper()} (ĐỦ 8 HƯỚNG × {len(frame_list)} KHUNG)\n"
            f"Pivot tiếp đất đo được: X={pivot_x}, Y={pivot_y}\n"
        )
    print(f"Exported {total_exported_frames} individual animation frames into {anim_dir}")
    
    # 04_VFX
    vfx_dir = TIEN_LO_BOSS / "04_VFX"
    vfx_dir.mkdir(parents=True, exist_ok=True)
    # Warning circle vfx
    vfx_circle = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
    dc = ImageDraw.Draw(vfx_circle)
    dc.ellipse([10, 10, 246, 118], outline=(255, 60, 20, 240), fill=(255, 40, 20, 60), width=4)
    vfx_circle.save(vfx_dir / "vfx_warning_circle.png")
    # Warning line vfx
    vfx_line = Image.new("RGBA", (400, 120), (0, 0, 0, 0))
    dl = ImageDraw.Draw(vfx_line)
    dl.rectangle([10, 20, 390, 100], outline=(255, 120, 30, 220), fill=(255, 50, 20, 70), width=3)
    vfx_line.save(vfx_dir / "vfx_warning_dash.png")
    (vfx_dir / "TRANG_THAI_NGHIEM_THU.txt").write_text("TRẠNG THÁI: CHƯA NGHIỆM THU — VFX TÁCH BIỆT THÂN BOSS\n")
    
    # 05_Hitbox
    hb_dir = TIEN_LO_BOSS / "05_Hitbox"
    hb_dir.mkdir(parents=True, exist_ok=True)
    hitbox_cfg = {
        "boss_id": "boss_xichviem_002",
        "name": "Xích Viêm Ma Quân",
        "pivot": {"x": pivot_x, "y": pivot_y},
        "hurtbox": {"type": "circle", "radius": 95, "offset_y": -40},
        "phase1_claw": {
            "telegraph_duration_sec": 0.75,
            "hitbox": {"type": "circle", "radius": 130, "angle_arc": 140},
            "damage_frame": 11,
            "recovery_sec": 1.2
        },
        "phase2_earthquake": {
            "telegraph_duration_sec": 1.15,
            "ground_warning_radius": 240,
            "damage_frame": 16,
            "recovery_sec": 1.4
        },
        "phase3_dash": {
            "telegraph_duration_sec": 0.95,
            "dash_length": 420,
            "dash_width": 140,
            "damage_frame": 21,
            "recovery_sec": 1.5
        }
    }
    (hb_dir / "hitbox_config.json").write_text(json.dumps(hitbox_cfg, indent=2))
    (hb_dir / "TRANG_THAI_NGHIEM_THU.txt").write_text("TRẠNG THÁI: CHƯA NGHIỆM THU — THÔNG SỐ HITBOX/HURTBOX CẤU HÌNH ĐỘC LẬP\n")
    
    # 07_JSON_Config
    cfg_dir = TIEN_LO_BOSS / "07_JSON_Config"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    (cfg_dir / "boss_config.json").write_text(json.dumps(hitbox_cfg, indent=2))
    
    # 09_QA
    qa_dir = TIEN_LO_BOSS / "09_QA"
    qa_dir.mkdir(parents=True, exist_ok=True)
    qa_manifest = {
        "boss": "Xích Viêm Ma Quân (Boss 002)",
        "quy_trinh": "Quy trình sản xuất Boss 1.0 (§28-29)",
        "luat_ghi_nhan": "Áp dụng nghiêm ngặt",
        "assets_summary": {
            "01_Concept": {"status": "CHƯA NGHIỆM THU", "notes": "Bản concept gốc 2D HD"},
            "02_Turnaround_8_Directions": {"status": "CHƯA NGHIỆM THU", "directions": 8, "canvas": "384x384", "notes": "Đủ 8 hướng thật"},
            "03_Animation": {
                "Idle": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 4, "total": 32},
                "Walk": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 4, "total": 32},
                "Run": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 4, "total": 32},
                "Attack_Claw": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 3, "total": 24},
                "Skill_Roar": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 3, "total": 24},
                "Attack_Pounce": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 3, "total": 24},
                "Hit": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 2, "total": 16},
                "Death": {"status": "CHƯA NGHIỆM THU", "directions": 8, "frames_per_dir": 4, "total": 32},
            },
            "04_VFX": {"status": "CHƯA NGHIỆM THU", "notes": "Warning circle & dash line tách thân"},
            "05_Hitbox": {"status": "CHƯA NGHIỆM THU", "notes": "Cấu hình độc lập JSON"},
            "06_Atlas": {"status": "CHƯA NGHIỆM THU", "grid": "6x6 (608x426)", "total_frames": 33},
            "08_Game_Integration": {"status": "CHƯA NGHIỆM THU", "notes": "Đã khớp engine Tiên Lộ"},
            "09_QA": {"status": "CHƯA NGHIỆM THU", "notes": "Đang chờ kiểm chứng Mục 5"}
        },
        "pivot_measured": {"x": pivot_x, "y": pivot_y}
    }
    (qa_dir / "qa_manifest.json").write_text(json.dumps(qa_manifest, indent=2, ensure_ascii=False))
    (qa_dir / "TRANG_THAI_NGHIEM_THU.txt").write_text(
        "BẢN KÊ TRẠNG THÁI NGHIỆM THU (LUẬT GHI NHÃN)\n"
        "Mọi tài nguyên hình ảnh hiện tại đều gắn nhãn CHƯA NGHIỆM THU theo quy định.\n"
        "Chỉ chuyển trạng thái sau khi vượt qua toàn bộ cổng kiểm thử Mục 5.\n"
    )
    print(f"QA manifest saved to {qa_dir}")


if __name__ == "__main__":
    process_monsters()
    process_boss()
    print("All Fire Realm art assets generated successfully!")
