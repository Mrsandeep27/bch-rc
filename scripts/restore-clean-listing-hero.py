"""
Restore the clean white-bg BMW shot at /products/PRC-bmw.webp so listing
cards (homepage grid, recently-viewed, social-proof toast, sticky CTA,
bundle upsell, checkout) show a clean product photo. The cinematic Scene E
stays at /products/colors/PRC-bmw-white.webp so the PDP gallery still shows
the dramatic hero when a user lands on the product page.
"""

from pathlib import Path
from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parent.parent
SRC = Path("C:/Users/H/Downloads/Gemini_Generated_Image_wk21gewk21gewk21.png")
DST = REPO / "public" / "products" / "PRC-bmw.webp"

if not SRC.exists():
    raise SystemExit(f"Source not found: {SRC}")

img = Image.open(SRC)
img = ImageOps.exif_transpose(img).convert("RGB")
w, h = img.size
side = max(w, h)
canvas = Image.new("RGB", (side, side), (255, 255, 255))
canvas.paste(img, ((side - w) // 2, (side - h) // 2))
canvas = canvas.resize((1024, 1024), Image.LANCZOS)
DST.parent.mkdir(parents=True, exist_ok=True)
canvas.save(DST, "WEBP", quality=88, method=6)
print(f"OK {DST.relative_to(REPO)} ({DST.stat().st_size // 1024} KB)")
