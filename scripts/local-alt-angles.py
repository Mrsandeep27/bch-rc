"""
local-alt-angles.py
====================
Builds per-color alt-angle thumbnails directly from the raw 2026-06-04 fresh
shoot (public/fresh/<Car>/Photos/IMG_NNNN.JPG), without Gemini. Pipeline:

  1. EXIF auto-rotate (iPhone shots come tagged but stored landscape)
  2. Force upright orientation if the EXIF tag was missing
  3. rembg (U2NET) removes the wall/floor background, keeping only the car
  4. Tight crop around the non-transparent pixels (the car) + 8% padding
  5. Resize so the long edge is 1024 px
  6. Composite onto a pure white 1024x1024 square
  7. Save JPEG quality 88

Outputs land at: public/products/colors/PRC-<sku>-<color>-{2,3,4}.jpg
"""

import io
import os
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

import numpy as np
from PIL import Image, ImageOps
from rembg import remove, new_session

# u2net_human_seg is human-only. u2net (default) handles arbitrary objects
# including toy cars. Created once and reused across all 54 jobs.
_RB_SESSION = new_session("u2net")

REPO = Path(__file__).resolve().parent.parent
FRESH = REPO / "public" / "fresh"
COLORS = REPO / "public" / "products" / "colors"

OUTPUT_SIZE = (1024, 1024)
# Box the car fits inside on the final canvas. 780/1024 = 76% fill, leaving
# ~12% padding on each side — matches Gemini's output framing.
SUBJECT_BOX = (780, 780)
BG_RGB = (250, 250, 250)


# (sku_slug, color_slug, car_folder_under_fresh, [IMG numbers for the 3 alts])
JOBS = [
    # BMW
    ("bmw", "white",  "BMW",         ["3523", "3525", "3527"]),
    ("bmw", "blue",   "BMW",         ["3535", "3537", "3539"]),
    ("bmw", "black",  "BMW",         ["3531", "3532", "3533"]),

    # Porsche (all bodies are chameleon iridescent; alts use neighbouring frames
    # in the IMG sequence which capture the same dominant hue)
    ("porsche", "dark-blue", "Porsche", ["3557", "3558", "3559"]),
    ("porsche", "green",     "Porsche", ["3546", "3547", "3549"]),
    ("porsche", "yellow",    "Porsche", ["3552", "3553", "3554"]),
    ("porsche", "multi",     "Porsche", ["3540", "3542", "3544"]),

    # Monster Truck (Blue #68 has been removed from catalog; not generated)
    ("monster", "blue",        "MonsterTruck", ["3506", "3508", "3509"]),
    ("monster", "yellow",      "MonsterTruck", ["3498", "3499", "3501"]),
    ("monster", "white-red",   "MonsterTruck", ["3519", "3521", "3522"]),
    ("monster", "multi",       "MonsterTruck", ["3513", "3515", "3516"]),
    ("monster", "red-orange",  "MonsterTruck", ["3493", "3495", "3496"]),

    # Thar (black is Wrangler body, others are Toyota Land Cruiser body -
    # user confirmed mixing is OK)
    ("thar", "blue",   "Thar", ["3562", "3564", "3565"]),
    ("thar", "yellow", "Thar", ["3577", "3579", "3580"]),
    ("thar", "white",  "Thar", ["3572", "3574", "3575"]),
    ("thar", "black",  "Thar", ["3568", "3569", "3571"]),

    # F1 Classic
    ("f1-classic", "red",   "F1", ["3582", "3583", "3584"]),
    ("f1-classic", "white", "F1", ["3589", "3590", "3591"]),
]


def crop_to_alpha(img: Image.Image, pad_pct: float = 0.08) -> Image.Image:
    """After rembg, the background is fully transparent (alpha=0). Crop to
    the bbox of non-transparent pixels (the car), then expand by pad_pct."""
    bbox = img.getbbox()  # bbox of non-zero alpha
    if not bbox:
        return img
    left, top, right, bottom = bbox
    w, h = img.size
    sw, sh = right - left, bottom - top
    px = int(sw * pad_pct)
    py = int(sh * pad_pct)
    return img.crop((
        max(0, left - px),
        max(0, top - py),
        min(w, right + px),
        min(h, bottom + py),
    ))


def process_one(src: Path, dst: Path) -> str | None:
    if not src.exists():
        return f"missing src: {src}"
    img = Image.open(src)
    # Apply EXIF orientation so the iPhone-stored rotation is materialised.
    img = ImageOps.exif_transpose(img)
    # If still wider than tall (landscape), rotate 90 CCW so the car sits
    # upright. Fallback for shots where the EXIF tag is missing.
    if img.width > img.height:
        img = img.rotate(-90, expand=True)
    img = img.convert("RGB")
    # Remove the wall + floor + shadow using U2NET via rembg. Returns RGBA
    # where alpha=0 wherever the model decided "not subject".
    cutout = remove(img, session=_RB_SESSION)
    # Tight crop around the cutout subject (only 2% pre-pad — the real
    # breathing room comes from sizing into SUBJECT_BOX below).
    cutout = crop_to_alpha(cutout, pad_pct=0.02)
    # Fit the car inside SUBJECT_BOX (780x780) so it occupies ~76% of the
    # final 1024x1024 canvas — leaving generous white margin matching the
    # Gemini-cleaned hero variants. Preserves aspect + alpha.
    cutout.thumbnail(SUBJECT_BOX, Image.LANCZOS)
    # Composite onto a pure white square: paste the RGBA cutout onto a white
    # canvas using the alpha channel as mask — alpha=0 stays white, alpha=255
    # gets the car pixels, fractional alpha edges feather softly.
    canvas = Image.new("RGB", OUTPUT_SIZE, BG_RGB)
    offset = ((OUTPUT_SIZE[0] - cutout.width) // 2, (OUTPUT_SIZE[1] - cutout.height) // 2)
    canvas.paste(cutout, offset, cutout if cutout.mode == "RGBA" else None)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "JPEG", quality=88, optimize=True)
    return None


def main() -> int:
    total = 0
    failed: list[str] = []
    for sku, color, car_folder, imgs in JOBS:
        for i, img_num in enumerate(imgs, start=2):
            src = FRESH / car_folder / "Photos" / f"IMG_{img_num}.JPG"
            dst = COLORS / f"PRC-{sku}-{color}-{i}.jpg"
            err = process_one(src, dst)
            if err:
                print(f"  X  PRC-{sku}-{color}-{i}.jpg  -> {err}")
                failed.append(f"{sku}-{color}-{i}")
            else:
                kb = dst.stat().st_size // 1024
                print(f"  OK PRC-{sku}-{color}-{i}.jpg  ({kb} KB)  <- IMG_{img_num}")
                total += 1
    print(f"\nDONE. {total} alt-angle files written.")
    if failed:
        print(f"FAILED ({len(failed)}): {', '.join(failed)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
