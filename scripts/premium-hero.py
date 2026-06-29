#!/usr/bin/env python3
"""
Faithful premium hero shots for PRC 1:16 cars.

Instead of generative AI (which redraws the car), this keeps the REAL product:
  1. background-remove the actual phone photo (rembg / u2net),
  2. trim to the car, place it on a clean studio gradient,
  3. add a soft contact shadow + faint reflection.

The car stays pixel-for-pixel the real product — only the creased-paper
backdrop is replaced. No API key needed.

Usage:
    python scripts/premium-hero.py <src.jpg> <out.png> [rotate_degrees]
        rotate_degrees: CCW rotation applied before cutout (0/90/180/270).
"""

import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from rembg import remove, new_session

CANVAS = (1600, 1600)          # square PDP hero
CAR_WIDTH_FRAC = 0.80          # car fills this fraction of canvas width
CENTER_Y_FRAC = 0.46           # car vertical center (slightly above middle)
BG_CENTER = (238, 238, 240)    # soft light-grey, brighter behind the car
BG_EDGE = (202, 203, 208)      # gently darker toward edges

_session = new_session("u2net")


def radial_bg(size):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h * 0.42
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    d = d / d.max()
    d = np.clip(d ** 1.15, 0, 1)
    bg = np.zeros((h, w, 3), np.uint8)
    for i in range(3):
        bg[..., i] = (BG_CENTER[i] * (1 - d) + BG_EDGE[i] * d).astype(np.uint8)
    return Image.fromarray(bg, "RGB")


def cutout(src_path, rot):
    im = ImageOps.exif_transpose(Image.open(src_path)).convert("RGBA")
    if rot:
        im = im.rotate(rot, expand=True)
    out = remove(im, session=_session, alpha_matting=True,
                 alpha_matting_foreground_threshold=240,
                 alpha_matting_background_threshold=15,
                 alpha_matting_erode_size=10)
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def build(src_path, out_path, rot=0):
    car = cutout(src_path, rot)
    canvas = radial_bg(CANVAS).convert("RGBA")
    cw, ch = car.size
    target_w = int(CANVAS[0] * CAR_WIDTH_FRAC)
    scale = target_w / cw
    car = car.resize((target_w, int(ch * scale)), Image.LANCZOS)
    cw, ch = car.size
    cx = (CANVAS[0] - cw) // 2
    cy = int(CANVAS[1] * CENTER_Y_FRAC - ch / 2)

    # --- soft contact shadow from the alpha, squashed under the car ---
    alpha = car.split()[3]
    shadow = Image.new("L", car.size, 0)
    shadow.paste(alpha, (0, 0))
    shadow = shadow.resize((cw, max(1, int(ch * 0.18))), Image.LANCZOS)
    sh_canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    sh_layer = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    sh_mask = Image.new("L", CANVAS, 0)
    sh_y = cy + ch - int(ch * 0.06)
    sh_mask.paste(shadow, (cx, sh_y))
    sh_mask = sh_mask.filter(ImageFilter.GaussianBlur(28))
    sh_mask = sh_mask.point(lambda p: int(p * 0.45))
    sh_layer.putalpha(sh_mask)
    sh_black = Image.new("RGBA", CANVAS, (15, 15, 18, 255))
    sh_black.putalpha(sh_mask)
    canvas = Image.alpha_composite(canvas, sh_black)

    # --- faint reflection ---
    refl = car.transpose(Image.FLIP_TOP_BOTTOM)
    fade = Image.new("L", refl.size, 0)
    fa = np.linspace(70, 0, refl.size[1]).astype(np.uint8)
    fade = Image.fromarray(np.tile(fa[:, None], (1, refl.size[0])), "L")
    ra = ImageOps.invert(refl.split()[3].point(lambda p: 255 - p))  # keep car alpha
    refl_alpha = Image.composite(fade, Image.new("L", refl.size, 0), refl.split()[3])
    refl.putalpha(refl_alpha)
    canvas.alpha_composite(refl, (cx, cy + ch))

    # --- the car ---
    canvas.alpha_composite(car, (cx, cy))

    canvas.convert("RGB").save(out_path, quality=95)
    print(f"saved {out_path}  (car {cw}x{ch} on {CANVAS[0]}x{CANVAS[1]})")


if __name__ == "__main__":
    src = sys.argv[1]
    out = sys.argv[2]
    rot = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    build(src, out, rot)
