"""Strip the small Gemini-AI sparkle watermark from the bottom-right corner
of a generated image by cloning the patch immediately to its left over it.
Outputs the cleaned image to a new -v{n+1} cache-busted path."""

import sys
from pathlib import Path
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "public" / "products" / "colors" / "PRC-thar-black-v4.webp"
DST = REPO / "public" / "products" / "colors" / "PRC-thar-black-v5.webp"

img = Image.open(SRC).convert("RGB")
W, H = img.size  # 1024 x 1024

# Watermark is a small sparkle in the bottom-right corner. Approximate box.
WM_BOX = (W - 80, H - 80, W, H)            # destination — covers the watermark
SRC_BOX = (W - 200, H - 80, W - 120, H)    # source — patch 120 px to the LEFT, same vertical strip

patch = img.crop(SRC_BOX)

# Soft-feathered mask so the cloned patch blends instead of showing a hard seam.
mask = Image.new("L", patch.size, 255)
mask = mask.filter(ImageFilter.GaussianBlur(8))

img.paste(patch, (WM_BOX[0], WM_BOX[1]), mask)
img.save(DST, "WEBP", quality=88, method=6)
print(f"OK {DST.relative_to(REPO)} ({DST.stat().st_size // 1024} KB)")
