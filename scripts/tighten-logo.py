"""
Logo cleanup pipeline.
Gemini baked checkerboard 'transparency' as actual pixels. This script:
  1. Removes the checkerboard via LUMINANCE → ALPHA mapping (preserves anti-aliased edges).
  2. Crops to tight bounds.
  3. Saves clean PNG with real transparency.

For the WHITE logo:
  bright pixels (wordmark) become opaque, dark pixels (checkerboard) become transparent.

For the BLACK logo:
  dark pixels (wordmark) become opaque, bright pixels (checkerboard) become transparent.
"""
from PIL import Image
import os

# (source, output, mode)
# mode = "white_on_dark" or "black_on_light"
INPUTS = [
    ("public/logo/prc-clean-transparent.png", "public/logo/prc-tight-white.png", "white"),
    ("public/logo/prc-on-light.png", "public/logo/prc-tight-dark.png", "black"),
]


def map_alpha(r: int, g: int, b: int, mode: str) -> tuple[int, int, int, int]:
    lum = (r + g + b) // 3
    if mode == "white":
        # Wordmark is white (lum~255). Checkerboard is gray (lum~180/200).
        # Keep pixels above 210 fully, ramp down to 165 = invisible.
        if lum >= 215:
            return (255, 255, 255, 255)
        if lum >= 170:
            t = (lum - 170) / (215 - 170)  # 0..1
            a = int(255 * t)
            return (255, 255, 255, a)
        return (0, 0, 0, 0)
    else:  # "black"
        # Wordmark is black (lum~0). Checkerboard is light gray (lum~210/235).
        # Keep pixels below 50 fully, ramp to 130 = invisible.
        if lum <= 50:
            return (0, 0, 0, 255)
        if lum <= 130:
            t = 1 - (lum - 50) / (130 - 50)
            a = int(255 * t)
            return (0, 0, 0, a)
        return (0, 0, 0, 0)


for src, dst, mode in INPUTS:
    if not os.path.isfile(src):
        print(f"missing: {src}")
        continue
    img = Image.open(src).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            pixels[x, y] = map_alpha(r, g, b, mode)

    bbox = img.getbbox()
    if bbox is None:
        print(f"  nothing kept for {src}")
        continue
    pad = 25
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(w, bbox[2] + pad)
    bottom = min(h, bbox[3] + pad)
    tight = img.crop((left, top, right, bottom))
    tight.save(dst)
    print(f"{src} -> {dst}  ({tight.width}x{tight.height})")
