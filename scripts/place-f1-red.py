"""Place the 4 Gemini-UI hand-generated F1 red scenes at their PDP -v2 paths.
- Square to 1024
- Strip Gemini watermark via clone-patch (bottom-right corner)
- Composite real PRC logo on the hero (FE) top-right
- Save as WebP q=88
"""

from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

REPO = Path(__file__).resolve().parent.parent
DL = Path("C:/Users/H/Downloads")
OUT = REPO / "public" / "products" / "colors"
LOGO = REPO / "public" / "logo" / "prc-logo-white-tight.png"

JOBS = [
    # (source, dst-name, is-hero)
    (DL / "Gemini_Generated_Image_wimfsvwimfsvwimf.png", "PRC-f1-classic-red-2-v2.webp", False),  # FA
    (DL / "Gemini_Generated_Image_vfntymvfntymvfnt.png", "PRC-f1-classic-red-3-v2.webp", False),  # FC
    (DL / "Gemini_Generated_Image_2yj7t02yj7t02yj7.png", "PRC-f1-classic-red-4-v2.webp", False),  # FD
    (DL / "Gemini_Generated_Image_6rn0t66rn0t66rn0.png", "PRC-f1-classic-red-v2.webp",   True),   # FE hero
]


def strip_watermark(img: Image.Image) -> Image.Image:
    """Clone a 80x80 patch from 120 px to the left of the bottom-right
    corner over the Gemini sparkle watermark."""
    W, H = img.size
    src_box = (W - 200, H - 80, W - 120, H)
    patch = img.crop(src_box)
    mask = Image.new("L", patch.size, 255).filter(ImageFilter.GaussianBlur(8))
    img.paste(patch, (W - 80, H - 80), mask)
    return img


def composite_logo(img: Image.Image) -> Image.Image:
    """Paste the white PRC logo at top-right corner with 36 px padding."""
    logo = Image.open(LOGO).convert("RGBA")
    LOGO_W, PAD = 140, 36
    ratio = LOGO_W / logo.width
    logo = logo.resize((LOGO_W, int(logo.height * ratio)), Image.LANCZOS)
    out = img.convert("RGBA")
    out.alpha_composite(logo, (out.width - logo.width - PAD, PAD))
    return out.convert("RGB")


for src, dst_name, is_hero in JOBS:
    if not src.exists():
        print(f"MISSING: {src.name}")
        continue
    img = Image.open(src)
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    side = max(w, h)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    canvas = canvas.resize((1024, 1024), Image.LANCZOS)
    canvas = strip_watermark(canvas)
    if is_hero:
        canvas = composite_logo(canvas)
    dst = OUT / dst_name
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "WEBP", quality=88, method=6)
    tag = "HERO+LOGO" if is_hero else "ALT"
    print(f"OK [{tag}] {src.name} -> {dst.relative_to(REPO)} ({dst.stat().st_size // 1024} KB)")
