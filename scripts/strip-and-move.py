"""Strip Gemini sparkle watermark + move to model folder.
Run with no args. Edit JOBS to change mappings."""
from pathlib import Path
from PIL import Image, ImageFilter

DL = Path(r"C:\Users\H\Downloads")
OUT = Path(r"C:\Users\H\Documents\GitHub\bch-rc\public\store16-images")

JOBS = [
    # (downloaded filename, target subfolder, target slot name, strip_watermark)
    ("Gemini_Generated_Image_c3qo9jc3qo9jc3qo.png",       "dares-phantom", "1-hero.png",      True),
    ("ChatGPT Image Jun 26, 2026, 05_32_28 PM.png",       "dares-phantom", "2-side.png",      False),
    ("Gemini_Generated_Image_m57evzm57evzm57e.png",       "dares-phantom", "3-detail.png",    True),
    ("Gemini_Generated_Image_rnki8frnki8frnki.png",       "dares-phantom", "4-lifestyle.png", True),
]

def strip_watermark(src_path, dst_path):
    img = Image.open(src_path).convert("RGB")
    W, H = img.size
    # Sparkle is bottom-right; scale the box to image size.
    wm_w = max(80, W // 12)
    wm_h = max(80, H // 12)
    wm_box = (W - wm_w, H - wm_h, W, H)
    src_box = (W - wm_w * 2, H - wm_h, W - wm_w, H)
    patch = img.crop(src_box).resize((wm_w, wm_h))
    mask = Image.new("L", patch.size, 255).filter(ImageFilter.GaussianBlur(10))
    img.paste(patch, (wm_box[0], wm_box[1]), mask)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst_path, "PNG")

import shutil
for fname, model, slot, strip in JOBS:
    src = DL / fname
    dst = OUT / model / slot
    if not src.exists():
        print(f"[MISS] {src.name}")
        continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    if strip:
        strip_watermark(src, dst)
    else:
        shutil.copy(src, dst)
    print(f"[OK] {src.name} -> {model}/{slot} ({dst.stat().st_size // 1024} KB)")

print("DONE")
