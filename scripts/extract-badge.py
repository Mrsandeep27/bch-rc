"""
Extract the circular PRC Cars badge from the BCH-given screenshot.
Hard-coded crop coordinates (badge center ~295,570, radius ~205 in 590x1270 source).
"""
from PIL import Image, ImageDraw
import os

src = "public/logo/prc-original.jpeg"
if not os.path.isfile(src):
    raise SystemExit(f"missing: {src}")

img = Image.open(src).convert("RGB")
w, h = img.size
print(f"source: {w}x{h}")

# Use proportional positioning so it works even if exact dims differ a bit.
cx = w // 2
cy = int(h * 0.45)
r = int(min(w, h) * 0.35)

sq_box = (cx - r, cy - r, cx + r, cy + r)
print(f"square crop box: {sq_box}")

cropped = img.crop(sq_box).convert("RGBA")
cw, ch = cropped.size

# Circular mask: outside circle becomes transparent
mask = Image.new("L", (cw, ch), 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, cw, ch), fill=255)
cropped.putalpha(mask)

cropped.save("public/logo/prc-badge.png")
print(f"wrote public/logo/prc-badge.png ({cw}x{ch})")

# Favicon sizes
for sz in (512, 192, 32):
    out = f"public/logo/prc-favicon-{sz}.png"
    cropped.resize((sz, sz), Image.LANCZOS).save(out)
    print(f"wrote {out}")
