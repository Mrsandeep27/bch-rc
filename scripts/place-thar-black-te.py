"""One-shot: take the user's Gemini-UI hand-generated Thar black TE hero,
PIL-composite the real PRC logo onto the reserved top-right corner, save as
the cache-busted v2 webp the PDP reads."""

from pathlib import Path
from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parent.parent
SRC = Path("C:/Users/H/Downloads/Gemini_Generated_Image_8kqfun8kqfun8kqf.png")
DST = REPO / "public" / "products" / "colors" / "PRC-thar-black-v4.webp"
LOGO = REPO / "public" / "logo" / "prc-logo-white-tight.png"

img = Image.open(SRC)
img = ImageOps.exif_transpose(img).convert("RGB")
# Square 1024×1024
w, h = img.size
side = max(w, h)
canvas = Image.new("RGB", (side, side), (255, 255, 255))
canvas.paste(img, ((side - w) // 2, (side - h) // 2))
canvas = canvas.resize((1024, 1024), Image.LANCZOS)

# Composite real PRC logo top-right with 36px padding, ~140px wide.
logo = Image.open(LOGO).convert("RGBA")
LOGO_W, PAD = 140, 36
ratio = LOGO_W / logo.width
logo = logo.resize((LOGO_W, int(logo.height * ratio)), Image.LANCZOS)
out = canvas.convert("RGBA")
out.alpha_composite(logo, (out.width - logo.width - PAD, PAD))
out = out.convert("RGB")

DST.parent.mkdir(parents=True, exist_ok=True)
out.save(DST, "WEBP", quality=88, method=6)
print(f"OK {DST.relative_to(REPO)} ({DST.stat().st_size // 1024} KB)")
