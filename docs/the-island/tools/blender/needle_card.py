"""Needle-spray card texture for the coastal conifers. No Blender needed: PIL only.

python3 tools/blender/needle_card.py

Why: the crowns were closed low-poly sprays, and at walking distance every bough read as
folded green paper (player walk, October 2026). Real conifer boughs are needles, and the
only way a game shows needles at this budget is a textured, alpha-tested card per bough.

What it draws: one bough seen from above, root at the bottom (v = 0), growing tip at the
top (v = 1). A central twig carries alternating side twiglets, each dense with short
needles fanned forward; needle colour runs from a dark blue-green inside to a lighter,
yellower new growth at the twiglet tips. Flat colour only — no baked lighting, matching
the asset contract — so the same card works in every stratum and under every grade.

Outputs (both 512 x 512, deterministic):
  assets/needle-card.jpg   albedo, drawn over the body green so an alpha-tested edge
                           never fringes black
  assets/needle-alpha.jpg  coverage (the alpha test reads this)
  tools/blender/needle-card-preview.png   the two composited over grey, for inspection
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

SRC = Path(__file__).resolve().parent
ROOT = SRC.parents[1]
SIZE = 512
SS = 4                     # supersample: drawn at 2048, box-filtered down
W = SIZE * SS
rng = random.Random(20261006)


def lerp(a, b, t):
    return a + (b - a) * t


def col(dark, light, t):
    return tuple(int(round(lerp(dark[i], light[i], t) * 255)) for i in range(3))


DARK = (0.040, 0.095, 0.070)       # inner shade
MID = (0.072, 0.168, 0.105)        # the body of the needle (the island's blue-green, low chroma)
LIGHT = (0.215, 0.330, 0.150)      # new growth at the tips
TWIG = (0.235, 0.153, 0.080)

rgb = Image.new('RGB', (W, W), col(MID, MID, 0))   # the backdrop IS the body green: edge texels blend green-to-green, no black fringe under the alpha test
alpha = Image.new('L', (W, W), 0)
drgb = ImageDraw.Draw(rgb)
dalpha = ImageDraw.Draw(alpha)


def needle(x0, y0, angle, length, width, shade):
    """A tapered needle: a thin quad from (x0, y0) along `angle`, in image pixels."""
    dx, dy = math.cos(angle), math.sin(angle)
    nx, ny = -dy * width / 2, dx * width / 2
    x1, y1 = x0 + dx * length, y0 + dy * length
    poly = [(x0 + nx, y0 + ny), (x0 - nx, y0 - ny), (x1 - nx * 0.25, y1 - ny * 0.25), (x1 + nx * 0.25, y1 + ny * 0.25)]
    drgb.polygon(poly, fill=shade)
    dalpha.polygon(poly, fill=255)


def twig(points, width, shade):
    for a, b in zip(points, points[1:]):
        drgb.line([a, b], fill=shade, width=max(1, int(width)))
        dalpha.line([a, b], fill=255, width=max(1, int(width)))


# image space: x across (u), y down. Root at the bottom edge, tip at the top edge.
cx = W * 0.5
root = (cx, W * 0.985)
tip = (cx + W * 0.03, W * 0.03)
# the main twig bows slightly to one side the way a drooping bough does
spine = [(lerp(root[0], tip[0], t) + math.sin(t * math.pi) * W * 0.035, lerp(root[1], tip[1], t)) for t in [i / 24 for i in range(25)]]
twig(spine, W * 0.009, col(TWIG, TWIG, 0))

N_SIDE = 30
for i in range(N_SIDE):
    t = (i + 0.5) / N_SIDE                         # 0 root → 1 tip along the spine
    side = -1 if i % 2 else 1
    sx, sy = spine[min(24, int(t * 24))]
    # side twiglets: longest a third of the way out, short at the root and at the tip
    reach = W * (0.10 + 0.36 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.8) * (0.9 + rng.random() * 0.2)
    ang = -math.pi / 2 + side * math.radians(62 - 18 * t) + rng.uniform(-0.08, 0.08)   # forward-swept, flatter near the tip
    ex, ey = sx + math.cos(ang) * reach, sy + math.sin(ang) * reach
    bend = side * reach * 0.12
    mid = ((sx + ex) / 2 + math.cos(ang + math.pi / 2) * bend, (sy + ey) / 2 + math.sin(ang + math.pi / 2) * bend)
    twig([(sx, sy), mid, (ex, ey)], W * 0.0045, col(TWIG, MID, 0.25))
    # needles along the twiglet, fanned forward on both sides
    n = int(15 + reach / W * 72)
    for k in range(n):
        u = (k + 0.5) / n
        # position on the bent twiglet
        a0 = (lerp(sx, mid[0], u * 2) if u < 0.5 else lerp(mid[0], ex, u * 2 - 1))
        a1 = (lerp(sy, mid[1], u * 2) if u < 0.5 else lerp(mid[1], ey, u * 2 - 1))
        # two ranks of needles a side: a flat lower rank and a steeper upper one, the way
        # a fir's needles comb out of the twig in more than one plane — this is what makes
        # the bough read dense instead of as a fishbone
        for s in (-1, 1):
            for rank, (spread0, lenk) in enumerate(((30, 1.0), (58, 0.82))):
                spread = math.radians(spread0 + 12 * rng.random())
                nang = ang + s * spread + rng.uniform(-0.14, 0.14)
                nlen = W * (0.042 + 0.030 * rng.random()) * lenk * (1.0 - 0.30 * u)
                nwid = W * (0.0050 + 0.0024 * rng.random())
                shade_t = min(1.0, 0.18 + 0.50 * u + 0.25 * t + 0.12 * rank + rng.uniform(-0.12, 0.12))
                needle(a0, a1, nang, nlen, nwid, col(DARK, LIGHT, shade_t))
    # a tuft of needles straight off the twiglet's end: the growing bud
    for k in range(9):
        nang = ang + rng.uniform(-0.65, 0.65)
        needle(ex, ey, nang, W * (0.036 + 0.022 * rng.random()), W * 0.0055, col(MID, LIGHT, 0.6 + 0.4 * rng.random()))

# the leader at the tip of the spine: a dense forward tuft
for k in range(60):
    nang = -math.pi / 2 + rng.uniform(-1.0, 1.0)
    needle(tip[0], tip[1] + W * 0.02, nang, W * (0.04 + 0.03 * rng.random()), W * 0.006, col(MID, LIGHT, 0.55 + 0.45 * rng.random()))

# down-sample with a box filter: the anti-aliasing the alpha test needs
rgb_s = rgb.resize((SIZE, SIZE), Image.BOX)
alpha_s = alpha.resize((SIZE, SIZE), Image.BOX)

bleed = rgb_s

out_rgb = ROOT / 'assets/needle-card.jpg'
out_a = ROOT / 'assets/needle-alpha.jpg'
bleed.save(out_rgb, quality=88, optimize=True, subsampling=0)
alpha_s.save(out_a, quality=92, optimize=True)

preview = Image.new('RGB', (SIZE * 2, SIZE), (96, 96, 96))
preview.paste(Image.composite(bleed, Image.new('RGB', (SIZE, SIZE), (96, 96, 96)), alpha_s), (0, 0))
preview.paste(alpha_s.convert('RGB'), (SIZE, 0))
preview.save(SRC / 'needle-card-preview.png')
cover = sum(1 for v in alpha_s.getdata() if v > 127) / float(SIZE * SIZE)
print({'card': out_rgb.stat().st_size, 'alpha': out_a.stat().st_size, 'coverage': round(cover, 3)})
