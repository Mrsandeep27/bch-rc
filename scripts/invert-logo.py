"""Take the Photoroom-cleaned black logo and produce a WHITE inverted version
(preserving the alpha channel) for use on dark backgrounds."""
from PIL import Image

src = "public/logo/prc-logo-clean.png"
dst_white = "public/logo/prc-logo-white.png"

img = Image.open(src).convert("RGBA")
w, h = img.size
print(f"source: {w}x{h}")

# Replace every opaque pixel's RGB with white. Keep the alpha exactly as-is.
pixels = img.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if a > 0:
            pixels[x, y] = (255, 255, 255, a)

img.save(dst_white)
print(f"wrote {dst_white}")

# Also produce tightly cropped versions of both (remove transparent padding for header use)
for source, out in [
    (src, "public/logo/prc-logo-black-tight.png"),
    (dst_white, "public/logo/prc-logo-white-tight.png"),
]:
    i = Image.open(source).convert("RGBA")
    # Use alpha threshold to ignore near-transparent stray pixels
    alpha = i.split()[-1]
    mask = alpha.point(lambda p: 255 if p > 30 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        continue
    pad = 18
    bx = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(i.width, bbox[2] + pad),
        min(i.height, bbox[3] + pad),
    )
    tight = i.crop(bx)
    tight.save(out)
    print(f"  {source} -> {out} ({tight.width}x{tight.height})")
