"""Place the Gemini-UI generated Monster Truck scenes at their PDP -v2 paths.

Pass colour slug as CLI arg + 4 download filenames (in MA/MC/MD/ME order).
Auto-handles: square to 1024, strip Gemini watermark, composite real PRC
logo on the hero (ME), save WebP q=88.

Usage:
  python scripts/place-monster.py <colour-slug> <MA-file> <MC-file> <MD-file> <ME-file>
e.g.:
  python scripts/place-monster.py yellow Gemini_..._qemn7t.png Gemini_..._nmhphn.png Gemini_..._cjw0lu.png Gemini_..._r2l0le.png
"""

import sys
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

REPO = Path(__file__).resolve().parent.parent
DL = Path("C:/Users/H/Downloads")
OUT = REPO / "public" / "products" / "colors"
LOGO = REPO / "public" / "logo" / "prc-logo-white-tight.png"


def strip_watermark(img: Image.Image) -> Image.Image:
    W, H = img.size
    src_box = (W - 200, H - 80, W - 120, H)
    patch = img.crop(src_box)
    mask = Image.new("L", patch.size, 255).filter(ImageFilter.GaussianBlur(8))
    img.paste(patch, (W - 80, H - 80), mask)
    return img


def composite_logo(img: Image.Image) -> Image.Image:
    logo = Image.open(LOGO).convert("RGBA")
    LOGO_W, PAD = 140, 36
    ratio = LOGO_W / logo.width
    logo = logo.resize((LOGO_W, int(logo.height * ratio)), Image.LANCZOS)
    out = img.convert("RGBA")
    out.alpha_composite(logo, (out.width - logo.width - PAD, PAD))
    return out.convert("RGB")


def process(src_path: Path, dst: Path, is_hero: bool):
    img = Image.open(src_path)
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    side = max(w, h)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    canvas = canvas.resize((1024, 1024), Image.LANCZOS)
    canvas = strip_watermark(canvas)
    if is_hero:
        canvas = composite_logo(canvas)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "WEBP", quality=88, method=6)
    tag = "HERO+LOGO" if is_hero else "ALT"
    print(f"OK [{tag}] {src_path.name} -> {dst.relative_to(REPO)} ({dst.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 6:
        sys.exit("Usage: place-monster.py <colour> <MA> <MC> <MD> <ME>")
    colour = sys.argv[1]
    ma, mc, md, me = sys.argv[2:6]
    process(DL / ma, OUT / f"PRC-monster-{colour}-2-v2.webp", False)  # MA -> -2
    process(DL / mc, OUT / f"PRC-monster-{colour}-3-v2.webp", False)  # MC -> -3
    process(DL / md, OUT / f"PRC-monster-{colour}-4-v2.webp", False)  # MD -> -4
    process(DL / me, OUT / f"PRC-monster-{colour}-v2.webp",   True)   # ME hero
