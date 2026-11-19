#!/usr/bin/env python3
"""Generate articulated 2D HD sprite sheet for Bạch Hổ Sơn Quân (§29 + §G.3).

Generates distinct poses:
- idle: 4 frames
- move: 4 frames
- telegraph_swipe: 2 frames
- attack_swipe: 3 frames
- telegraph_roar: 2 frames
- attack_roar: 3 frames
- telegraph_dash: 2 frames
- attack_dash: 3 frames
- hit: 2 frames
- phase_transition: 4 frames
- death: 4 frames
Total: 33 frames in a 6x6 grid (cell 608x426), atlas 3648x2556.
Preserves identity, art style, and lighting from original 1824x1278 sprite.
"""
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC_IMG = ROOT / "assets" / "boss" / "boss_bachho_sonquan_v1.png"
OUT_SHEET = ROOT / "assets" / "boss" / "boss_bachho_sheet_v1.png"
OUT_JSON = ROOT / "assets" / "boss" / "boss_bachho_sheet_v1.json"

CW, CH = 608, 426
COLS = 6
ROWS = 6

def create_boss_sheet():
    src = Image.open(SRC_IMG).convert("RGBA")
    sw, sh = src.size # 1824, 1278
    
    # We work on 912x639 for transformation precision, then resize to 608x426
    tw, th = 912, 639
    base = src.resize((tw, th), Image.Resampling.LANCZOS)
    arr_base = np.array(base, dtype=np.float32)
    
    # Segment masks on 912x639
    # Coordinates in 912x639:
    # Head: cx=175, cy=240, r=160
    # Front paw L: cx=150, cy=525, r=140
    # Front paw R: cx=325, cy=540, r=140
    # Body: cx=450, cy=325, r=220
    # Hind legs: cx=725, cy=500, r=180
    # Tail: cx=750, cy=150, r=160
    
    y_coords, x_coords = np.mgrid[0:th, 0:tw]
    
    def smooth_mask(cx, cy, rx, ry):
        d = ((x_coords - cx) / rx) ** 2 + ((y_coords - cy) / ry) ** 2
        m = np.clip(1.0 - d, 0.0, 1.0)
        return m * m * (3 - 2 * m) # smoothstep
    
    m_head = smooth_mask(175, 240, 150, 140)
    m_paw_fl = smooth_mask(150, 525, 120, 110)
    m_paw_fr = smooth_mask(325, 540, 130, 110)
    m_body = smooth_mask(450, 325, 200, 180)
    m_hind = smooth_mask(725, 500, 160, 130)
    m_tail = smooth_mask(750, 150, 150, 130)
    
    frames = []
    
    def warp_frame(transforms, effects=None, alpha_mult=1.0):
        # Apply segmented affine transforms
        # transforms: dict of segment -> (dx, dy, rot_deg, scale_x, scale_y)
        res = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        
        # Calculate displacement fields
        disp_x = np.zeros((th, tw), dtype=np.float32)
        disp_y = np.zeros((th, tw), dtype=np.float32)
        
        weights_map = {
            'head': (m_head, (175, 240)),
            'paw_fl': (m_paw_fl, (150, 525)),
            'paw_fr': (m_paw_fr, (325, 540)),
            'body': (m_body, (450, 325)),
            'hind': (m_hind, (725, 500)),
            'tail': (m_tail, (750, 150)),
        }
        
        for seg, (dx, dy, rot, scx, scy) in transforms.items():
            if seg not in weights_map:
                continue
            m, (cx, cy) = weights_map[seg]
            rad = math.radians(rot)
            cos_r, sin_r = math.cos(rad), math.sin(rad)
            
            # Relative coords from center
            rx = x_coords - cx
            ry = y_coords - cy
            
            # Inverse transform to pull pixels
            new_rx = (rx * cos_r + ry * sin_r) / scx - dx
            new_ry = (-rx * sin_r + ry * cos_r) / scy - dy
            
            disp_x += m * (new_rx - rx)
            disp_y += m * (new_ry - ry)
            
        # Global offset if present
        gdx, gdy = transforms.get('global', (0, 0))[:2]
        disp_x -= gdx
        disp_y -= gdy
        
        src_x = np.clip(np.round(x_coords + disp_x), 0, tw - 1).astype(np.int32)
        src_y = np.clip(np.round(y_coords + disp_y), 0, th - 1).astype(np.int32)
        
        warped = arr_base[src_y, src_x].copy()
        
        # Mask original alpha boundary so no border artifacts
        warped[:, :, 3] *= (arr_base[src_y, src_x, 3] > 10) * alpha_mult
        
        frame_img = Image.fromarray(warped.astype(np.uint8), "RGBA")
        
        if effects:
            effects(frame_img)
            
        return frame_img.resize((CW, CH), Image.Resampling.LANCZOS)
    
    # ---------------- Frame Definitions ----------------
    # 1. IDLE (4 frames) - breathing, tail flick, ear snarl
    for i in range(4):
        breath = math.sin(i / 4.0 * math.pi * 2)
        tf = {
            'body': (0, -breath * 3, 0, 1.0 + breath * 0.015, 1.0 + breath * 0.02),
            'head': (-breath * 2, -breath * 4, -breath * 1.5, 1.0, 1.0),
            'tail': (0, breath * 6, breath * 4.0, 1.0, 1.0),
            'paw_fl': (0, 0, 0, 1.0, 1.0),
            'paw_fr': (0, 0, 0, 1.0, 1.0),
        }
        frames.append(warp_frame(tf))
        
    # 2. MOVE (4 frames) - predatory stalk stride
    for i in range(4):
        phase = i / 4.0 * math.pi * 2
        stride = math.sin(phase)
        cstride = math.cos(phase)
        tf = {
            'global': (stride * 12, abs(cstride) * 6, 0, 1.0, 1.0),
            'body': (0, 8, -stride * 1.5, 1.02, 0.98),
            'head': (8, 12, stride * 2.0, 1.0, 1.0),
            'paw_fl': (stride * 22, -max(0, -cstride) * 14, -cstride * 6, 1.0, 1.0),
            'paw_fr': (-stride * 22, -max(0, cstride) * 14, cstride * 6, 1.0, 1.0),
            'hind': (-stride * 16, abs(stride) * 8, stride * 3, 1.0, 1.0),
            'tail': (-stride * 10, stride * 12, -stride * 8, 1.0, 1.0),
        }
        frames.append(warp_frame(tf))
        
    # 3. TELEGRAPH SWIPE (2 frames) - rearing back paw raised high
    # Frame 0: weight on back, front paw rising
    tf_ts0 = {
        'global': (10, -12, 0, 1.0, 1.0),
        'body': (5, -16, 4.0, 0.98, 1.02),
        'head': (0, -22, -4.0, 1.02, 1.02),
        'paw_fr': (10, -45, -18.0, 1.05, 1.05), # paw raised
        'paw_fl': (-5, 0, 2.0, 1.0, 1.0),
        'hind': (8, 6, 2.0, 1.0, 1.0),
        'tail': (-10, -14, -10.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_ts0))
    # Frame 1: claws raised high, glowing with silver aura
    def fx_telegraph_claw(img):
        draw = ImageDraw.Draw(img)
        # Silver/cyan energy gathering around right forepaw (approx 325, 480)
        cx, cy = 325, 460
        for r in [45, 30, 15]:
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(180, 240, 255, 160), width=3)
    tf_ts1 = {
        'global': (16, -24, 0, 1.0, 1.0),
        'body': (8, -28, 7.0, 0.97, 1.04),
        'head': (-4, -36, -7.0, 1.04, 1.04),
        'paw_fr': (20, -78, -32.0, 1.1, 1.1), # paw high in air
        'paw_fl': (-8, 2, 3.0, 1.0, 1.0),
        'hind': (12, 10, 4.0, 1.0, 1.0),
        'tail': (-15, -22, -16.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_ts1, effects=fx_telegraph_claw))
    
    # 4. ATTACK SWIPE (3 frames) - fierce downward claw slash with claw trail
    # Strike 0: forward lunge, paw slashing downward
    def fx_slash_arc1(img):
        draw = ImageDraw.Draw(img)
        # Cyan claw slash trails
        pts = [(160, 480), (120, 530), (80, 600)]
        for ox in [-15, 0, 15]:
            p = [(x + ox, y) for x, y in pts]
            draw.line(p, fill=(210, 245, 255, 230), width=6)
            draw.line(p, fill=(255, 255, 255, 255), width=2)
    tf_as0 = {
        'global': (-30, 12, 0, 1.0, 1.0),
        'body': (-25, 14, -5.0, 1.04, 0.96),
        'head': (-42, 22, 6.0, 1.0, 1.0),
        'paw_fr': (-65, 40, 35.0, 1.15, 1.1),
        'paw_fl': (-10, 5, 5.0, 1.0, 1.0),
        'hind': (-12, 0, -3.0, 1.0, 1.0),
        'tail': (25, 10, 14.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_as0, effects=fx_slash_arc1))
    
    # Strike 1: ground slam impact
    def fx_slash_impact(img):
        draw = ImageDraw.Draw(img)
        # Ground impact spark sparks
        for angle in range(0, 180, 30):
            rad = math.radians(angle)
            x1 = 120 + math.cos(rad) * 20
            y1 = 600 - math.sin(rad) * 15
            x2 = 120 + math.cos(rad) * 60
            y2 = 600 - math.sin(rad) * 45
            draw.line([(x1, y1), (x2, y2)], fill=(255, 220, 120, 220), width=3)
    tf_as1 = {
        'global': (-22, 16, 0, 1.0, 1.0),
        'body': (-18, 18, -3.0, 1.02, 0.98),
        'head': (-32, 24, 4.0, 1.0, 1.0),
        'paw_fr': (-45, 48, 20.0, 1.08, 1.0),
        'paw_fl': (-5, 6, 2.0, 1.0, 1.0),
        'hind': (-8, 4, -2.0, 1.0, 1.0),
        'tail': (18, 8, 10.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_as1, effects=fx_slash_impact))
    
    # Strike 2: recovery
    tf_as2 = {
        'global': (-10, 6, 0, 1.0, 1.0),
        'body': (-8, 8, -1.0, 1.0, 1.0),
        'head': (-15, 10, 2.0, 1.0, 1.0),
        'paw_fr': (-15, 15, 5.0, 1.0, 1.0),
        'paw_fl': (0, 0, 0, 1.0, 1.0),
        'hind': (-4, 2, 0, 1.0, 1.0),
        'tail': (10, 4, 4.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_as2))
    
    # 5. TELEGRAPH ROAR (2 frames) - chest expanding, red rings gathering
    def fx_telegraph_roar1(img):
        draw = ImageDraw.Draw(img)
        # Red aura gathering at jaws (approx 120, 280)
        cx, cy = 120, 270
        for r in [35, 22, 12]:
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 80, 60, 180), width=3)
    tf_tr0 = {
        'global': (14, -8, 0, 1.0, 1.0),
        'body': (10, -12, 3.0, 1.05, 1.04),
        'head': (8, -20, -12.0, 1.05, 1.05),
        'paw_fl': (0, 0, 0, 1.0, 1.0),
        'paw_fr': (0, 0, 0, 1.0, 1.0),
        'hind': (8, 4, 2.0, 1.0, 1.0),
        'tail': (-12, -8, -6.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_tr0, effects=fx_telegraph_roar1))
    
    def fx_telegraph_roar2(img):
        draw = ImageDraw.Draw(img)
        cx, cy = 110, 260
        for r in [55, 38, 20]:
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 50, 40, 220), width=4)
    tf_tr1 = {
        'global': (22, -14, 0, 1.0, 1.0),
        'body': (16, -18, 5.0, 1.08, 1.06),
        'head': (14, -30, -18.0, 1.08, 1.08),
        'paw_fl': (0, 0, 0, 1.0, 1.0),
        'paw_fr': (0, 0, 0, 1.0, 1.0),
        'hind': (12, 6, 3.0, 1.0, 1.0),
        'tail': (-18, -14, -10.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_tr1, effects=fx_telegraph_roar2))
    
    # 6. ATTACK ROAR (3 frames) - head thrusts forward, soundwave shockwaves erupt
    def fx_roar_burst1(img):
        draw = ImageDraw.Draw(img)
        cx, cy = 80, 280
        for r in [50, 90, 130, 170]:
            draw.arc([cx - r, cy - r, cx + r, cy + r], start=110, end=250, fill=(255, 60, 40, 230), width=6)
            draw.arc([cx - r, cy - r, cx + r, cy + r], start=110, end=250, fill=(255, 230, 120, 255), width=2)
    tf_ar0 = {
        'global': (-28, 8, 0, 1.0, 1.0),
        'body': (-22, 10, -4.0, 1.04, 0.96),
        'head': (-46, 18, 10.0, 1.12, 1.1),
        'paw_fl': (-10, 0, 0, 1.0, 1.0),
        'paw_fr': (-10, 0, 0, 1.0, 1.0),
        'hind': (-8, 4, -2.0, 1.0, 1.0),
        'tail': (24, 12, 14.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_ar0, effects=fx_roar_burst1))
    
    def fx_roar_burst2(img):
        draw = ImageDraw.Draw(img)
        cx, cy = 60, 290
        for r in [90, 150, 210]:
            draw.arc([cx - r, cy - r, cx + r, cy + r], start=105, end=255, fill=(255, 100, 40, 180), width=5)
    tf_ar1 = {
        'global': (-20, 6, 0, 1.0, 1.0),
        'body': (-16, 8, -2.0, 1.02, 0.98),
        'head': (-36, 14, 6.0, 1.08, 1.06),
        'paw_fl': (-5, 0, 0, 1.0, 1.0),
        'paw_fr': (-5, 0, 0, 1.0, 1.0),
        'hind': (-6, 2, -1.0, 1.0, 1.0),
        'tail': (18, 8, 10.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_ar1, effects=fx_roar_burst2))
    
    tf_ar2 = {
        'global': (-8, 2, 0, 1.0, 1.0),
        'body': (-6, 4, 0, 1.0, 1.0),
        'head': (-18, 6, 2.0, 1.02, 1.02),
        'paw_fl': (0, 0, 0, 1.0, 1.0),
        'paw_fr': (0, 0, 0, 1.0, 1.0),
        'hind': (-2, 0, 0, 1.0, 1.0),
        'tail': (8, 4, 4.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_ar2))
    
    # 7. TELEGRAPH DASH (2 frames) - ultra-low crouch coil, eyes blazing
    def fx_telegraph_dash(img):
        draw = ImageDraw.Draw(img)
        # Red eye glint on tiger eye (approx 135, 230)
        draw.ellipse([132, 227, 142, 237], fill=(255, 40, 20, 255))
        draw.line([(120, 232), (155, 232)], fill=(255, 100, 50, 220), width=3)
    tf_td0 = {
        'global': (10, 22, 0, 1.0, 1.0),
        'body': (6, 28, -4.0, 1.08, 0.88), # compressed low
        'head': (-6, 32, 6.0, 1.0, 0.92),
        'paw_fl': (8, 12, 10.0, 1.0, 0.9),
        'paw_fr': (12, 14, 12.0, 1.0, 0.9),
        'hind': (18, 26, -10.0, 1.04, 0.86),
        'tail': (-10, 34, -20.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_td0, effects=fx_telegraph_dash))
    
    tf_td1 = {
        'global': (18, 28, 0, 1.0, 1.0),
        'body': (10, 36, -6.0, 1.12, 0.82), # maximum coil
        'head': (-10, 40, 8.0, 1.0, 0.88),
        'paw_fl': (12, 16, 14.0, 1.0, 0.85),
        'paw_fr': (18, 20, 16.0, 1.0, 0.85),
        'hind': (26, 34, -14.0, 1.08, 0.82),
        'tail': (-16, 44, -26.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_td1, effects=fx_telegraph_dash))
    
    # 8. ATTACK DASH (3 frames) - horizontal leap charge with speed streaks
    def fx_dash_streaks1(img):
        draw = ImageDraw.Draw(img)
        # Speed streaks behind flanks
        for y in [240, 320, 400, 480]:
            draw.line([(400, y), (880, y)], fill=(255, 230, 180, 140), width=4)
            draw.line([(550, y+8), (880, y+8)], fill=(255, 120, 40, 100), width=2)
    tf_ad0 = {
        'global': (-55, -16, 0, 1.0, 1.0), # launched airborne
        'body': (-45, -20, -2.0, 1.16, 0.88), # elongated
        'head': (-70, -18, -4.0, 1.06, 0.95),
        'paw_fl': (-85, -10, 24.0, 1.1, 0.9),
        'paw_fr': (-65, -8, 20.0, 1.1, 0.9),
        'hind': (40, 14, 25.0, 1.15, 0.85), # stretched back
        'tail': (60, 4, 18.0, 1.1, 0.9),
    }
    frames.append(warp_frame(tf_ad0, effects=fx_dash_streaks1))
    
    def fx_dash_streaks2(img):
        draw = ImageDraw.Draw(img)
        for y in [260, 340, 420]:
            draw.line([(350, y), (850, y)], fill=(255, 240, 200, 120), width=3)
    tf_ad1 = {
        'global': (-42, -8, 0, 1.0, 1.0),
        'body': (-35, -10, -1.0, 1.12, 0.92),
        'head': (-55, -10, -2.0, 1.04, 0.98),
        'paw_fl': (-60, 8, 16.0, 1.05, 0.95),
        'paw_fr': (-45, 12, 14.0, 1.05, 0.95),
        'hind': (25, 18, 16.0, 1.08, 0.9),
        'tail': (45, 10, 12.0, 1.05, 0.95),
    }
    frames.append(warp_frame(tf_ad1, effects=fx_dash_streaks2))
    
    # Touchdown sliding
    tf_ad2 = {
        'global': (-20, 14, 0, 1.0, 1.0),
        'body': (-15, 16, 0, 1.04, 0.96),
        'head': (-28, 18, 2.0, 1.0, 1.0),
        'paw_fl': (-25, 24, 8.0, 1.0, 1.0),
        'paw_fr': (-20, 26, 8.0, 1.0, 1.0),
        'hind': (-5, 14, 4.0, 1.0, 1.0),
        'tail': (25, 16, 6.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_ad2))
    
    # 9. HIT / STAGGER (2 frames) - violent flinch back with red flash
    def fx_hit_flash(img):
        arr = np.array(img, dtype=np.float32)
        # Red tint overlay
        arr[:, :, 0] = np.clip(arr[:, :, 0] * 1.3 + 50, 0, 255)
        arr[:, :, 1] = np.clip(arr[:, :, 1] * 0.8, 0, 255)
        arr[:, :, 2] = np.clip(arr[:, :, 2] * 0.8, 0, 255)
        img.paste(Image.fromarray(arr.astype(np.uint8), "RGBA"))
    tf_h0 = {
        'global': (35, -12, 0, 1.0, 1.0),
        'body': (26, -16, 6.0, 0.95, 1.05),
        'head': (45, -28, -16.0, 0.94, 1.06), # head thrown back
        'paw_fl': (15, -10, -8.0, 1.0, 1.0),
        'paw_fr': (18, -12, -8.0, 1.0, 1.0),
        'hind': (12, 6, 4.0, 1.0, 1.0),
        'tail': (-25, -20, -15.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_h0, effects=fx_hit_flash))
    
    tf_h1 = {
        'global': (20, -6, 0, 1.0, 1.0),
        'body': (15, -8, 3.0, 0.98, 1.02),
        'head': (25, -14, -8.0, 0.98, 1.02),
        'paw_fl': (8, -4, -4.0, 1.0, 1.0),
        'paw_fr': (10, -5, -4.0, 1.0, 1.0),
        'hind': (6, 3, 2.0, 1.0, 1.0),
        'tail': (-15, -10, -8.0, 1.0, 1.0),
    }
    frames.append(warp_frame(tf_h1))
    
    # 10. PHASE TRANSITION (4 frames) - rearing roar with massive aura flare
    for i in range(4):
        p = i / 4.0
        rear_h = math.sin(p * math.pi) * 35
        def fx_transition_aura(img, p=p):
            draw = ImageDraw.Draw(img)
            # Radiant golden/crimson burst
            cx, cy = 400, 300
            for a in range(0, 360, 20):
                rad = math.radians(a + p * 45)
                r1 = 120 + math.sin(a * 3) * 20
                r2 = 280 + math.sin(a * 4 + p * 10) * 40
                draw.line([(cx + math.cos(rad) * r1, cy + math.sin(rad) * r1),
                          (cx + math.cos(rad) * r2, cy + math.sin(rad) * r2)],
                          fill=(255, int(160 + 80 * math.sin(p * math.pi)), 50, int(180 * math.sin(p * math.pi))),
                          width=4)
        tf_pt = {
            'global': (8, -rear_h, 0, 1.0, 1.0),
            'body': (5, -rear_h * 1.2, rear_h * 0.25, 0.96, 1.06),
            'head': (-10, -rear_h * 1.6, -rear_h * 0.35, 1.08, 1.08),
            'paw_fl': (10, -rear_h * 1.4, -rear_h * 0.4, 1.05, 1.05),
            'paw_fr': (15, -rear_h * 1.6, -rear_h * 0.45, 1.08, 1.08),
            'hind': (15, 8, 4.0, 1.0, 1.0),
            'tail': (-25, -rear_h * 0.8, -15.0, 1.0, 1.0),
        }
        frames.append(warp_frame(tf_pt, effects=fx_transition_aura))
        
    # 11. DEATH (4 frames) - collapse to ground, breathing out, dissolving spirit
    for i in range(4):
        p = i / 3.0 # 0.0, 0.33, 0.66, 1.0
        sink_y = p * 45
        flat_scy = 1.0 - p * 0.45
        flat_scx = 1.0 + p * 0.2
        def fx_death_particles(img, p=p):
            if p > 0.3:
                draw = ImageDraw.Draw(img)
                # Golden motes floating upwards
                np.random.seed(42 + int(p * 10))
                for _ in range(int(p * 40)):
                    px = np.random.randint(50, tw - 50)
                    py = np.random.randint(int(th * 0.3), th)
                    sz = np.random.randint(2, 6)
                    draw.ellipse([px, py, px + sz, py + sz], fill=(255, 235, 150, int(200 * p)))
        tf_dt = {
            'global': (-p * 15, sink_y, 0, 1.0, 1.0),
            'body': (0, sink_y * 1.1, 0, flat_scx, flat_scy),
            'head': (-p * 25, sink_y * 1.3, p * 8.0, 1.05, flat_scy),
            'paw_fl': (-p * 35, sink_y * 0.8, p * 20.0, flat_scx, flat_scy),
            'paw_fr': (-p * 30, sink_y * 0.8, p * 20.0, flat_scx, flat_scy),
            'hind': (p * 10, sink_y * 0.9, -p * 10.0, flat_scx, flat_scy),
            'tail': (p * 20, sink_y * 1.1, p * 15.0, flat_scx, flat_scy),
        }
        alpha_m = 1.0 if i < 3 else 0.75
        frames.append(warp_frame(tf_dt, effects=fx_death_particles, alpha_mult=alpha_m))
        
    print(f"Generated {len(frames)} frames.")
    assert len(frames) <= COLS * ROWS, f"Too many frames: {len(frames)} > {COLS * ROWS}"
    
    # Pack into atlas
    atlas = Image.new("RGBA", (CW * COLS, CH * ROWS), (0, 0, 0, 0))
    for idx, f in enumerate(frames):
        c = idx % COLS
        r = idx // COLS
        atlas.paste(f, (c * CW, r * CH))
        
    atlas.save(OUT_SHEET, format="PNG", optimize=True)
    print(f"Saved boss sheet: {OUT_SHEET} ({atlas.size})")
    
    # Metadata JSON
    meta = {
        "name": "boss_bachho_sheet_v1",
        "cellW": CW,
        "cellH": CH,
        "cols": COLS,
        "rows": ROWS,
        "total_frames": len(frames),
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
    OUT_JSON.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved boss metadata: {OUT_JSON}")

if __name__ == "__main__":
    create_boss_sheet()
