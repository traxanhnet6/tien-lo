#!/usr/bin/env python3
"""Drawn utility icons for the combat HUD: basic sword, dodge, defend,
interact. All coordinates are in FINAL icon pixels (216) and scaled by
the supersample factor at draw time — one unit discipline throughout.
No emoji, no text glyphs."""
import math
from PIL import Image, ImageDraw

OUT = "/home/hatch/workspace/game-tien-lo-agy1/assets/hud"
SIZE = 216
SS = 4

def C():
    return Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))

def save(im, name):
    im.resize((SIZE, SIZE), Image.LANCZOS).save(f"{OUT}/{name}")
    print("icon", name, "(drawn)")

def X(v):  # final px -> supersampled px
    return v * SS

# ---------------------------------------------------------------- sword
im = C(); d = ImageDraw.Draw(im)
# Blade along the diagonal from top-right tip (178,26) to guard (74,132).
tip = (X(182), X(22)); b1 = (X(88), X(118)); b2 = (X(70), X(100))
d.polygon([tip, b1, b2], fill=(219, 231, 240, 255))
d.line([tip, (X(79), X(109))], fill=(148, 165, 182, 255), width=X(3))
d.line([(X(158), X(46)), (X(83), X(105))], fill=(248, 252, 255, 255), width=X(2))
# Guard: gold bar perpendicular to the blade at (79,109).
gx, gy = X(79), X(109)
d.line([(gx - X(26), gy + X(26)), (gx + X(26), gy - X(26))], fill=(212, 175, 55, 255), width=X(9))
d.ellipse([gx - X(8), gy - X(8), gx + X(8), gy + X(8)], fill=(255, 216, 92, 255))
# Grip down-left to pommel (46,142), with wrap rings.
hx, hy = X(47), X(141)
d.line([(gx, gy), (hx, hy)], fill=(74, 47, 28, 255), width=X(13))
for t in (0.25, 0.55, 0.85):
    px, py = gx + (hx - gx) * t, gy + (hy - gy) * t
    d.line([(px - X(7), py + X(5)), (px + X(5), py - X(7))], fill=(140, 102, 54, 255), width=X(3))
d.ellipse([hx - X(8), hy - X(8), hx + X(8), hy + X(8)], fill=(212, 175, 55, 255))
# Red tassel from the pommel.
for sway in (-7, 0, 7):
    pts = [(hx + X(sway) * (s / 34) + X(math.sin(s / 9) * 1.6), hy + X(6) + X(s)) for s in range(0, 35, 3)]
    d.line(pts, fill=(198, 32, 46, 255), width=X(4))
save(im, "icon_basic.png")

# ---------------------------------------------------------------- dodge
im = C(); d = ImageDraw.Draw(im)
# Three speed arcs sweeping behind (left of) a leaping figure.
for r, wdt, alpha in ((86, 11, 200), (62, 12, 225), (38, 13, 255)):
    d.arc([X(108 - r), X(108 - r), X(108 + r), X(108 + r)], start=140, end=235,
          fill=(86, 178, 255, alpha), width=X(wdt))
# Leaping figure (head + dynamic strokes), leaning right.
hx, hy = X(140), X(58)
d.ellipse([hx - X(15), hy - X(15), hx + X(15), hy + X(15)], fill=(228, 243, 255, 255))
hip = (X(112), X(104))
d.line([(hx - X(4), hy + X(13)), hip], fill=(228, 243, 255, 255), width=X(15))          # torso
d.line([hip, (X(158), X(128))], fill=(228, 243, 255, 255), width=X(12))                  # front leg
d.line([(X(158), X(128)), (X(146), X(168))], fill=(190, 224, 255, 255), width=X(11))     # front shin
d.line([hip, (X(66), X(140))], fill=(190, 224, 255, 255), width=X(12))                   # trailing leg
d.line([(X(122), X(84)), (X(168), X(98))], fill=(228, 243, 255, 255), width=X(11))       # arm forward
d.line([(X(122), X(84)), (X(84), X(64))], fill=(190, 224, 255, 255), width=X(11))        # arm back
save(im, "icon_dodge.png")

# ---------------------------------------------------------------- defend
im = C(); d = ImageDraw.Draw(im)
cx = 108
shield = [(cx - 66, 22), (cx + 66, 22), (cx + 66, 96), (cx + 40, 152), (cx, 188), (cx - 40, 152), (cx - 66, 96)]
d.polygon([(X(x), X(y)) for x, y in shield], fill=(79, 97, 113, 255))
inset = [(cx + (x - cx) * 0.82, 30 + (y - 30) * 0.86) for x, y in shield]
d.polygon([(X(x), X(y)) for x, y in inset], fill=(124, 146, 163, 255))
d.line([(X(x), X(y)) for x, y in shield + [shield[0]]], fill=(212, 175, 55, 255), width=X(6), joint="curve")
d.line([(X(cx), X(34)), (X(cx), X(168))], fill=(212, 175, 55, 190), width=X(5))
d.ellipse([X(cx - 21), X(84), X(cx + 21), X(126)], fill=(255, 216, 92, 255))
d.ellipse([X(cx - 12), X(93), X(cx + 12), X(117)], fill=(178, 134, 34, 255))
save(im, "icon_defend.png")

# ---------------------------------------------------------------- interact
im = C(); d = ImageDraw.Draw(im)
d.rounded_rectangle([X(26), X(48), X(190), X(140)], radius=X(26),
                    fill=(242, 228, 180, 255), outline=(150, 112, 30, 255), width=X(5))
d.polygon([(X(66), X(136)), (X(104), X(136)), (X(72), X(176))], fill=(242, 228, 180, 255))
d.line([(X(66), X(138)), (X(72), X(174))], fill=(150, 112, 30, 255), width=X(4))
d.line([(X(104), X(138)), (X(72), X(174))], fill=(150, 112, 30, 255), width=X(4))
for k in (-1, 0, 1):
    dx = 108 + k * 34
    d.ellipse([X(dx - 9), X(85), X(dx + 9), X(103)], fill=(96, 74, 22, 255))
save(im, "icon_interact.png")
print("done")
