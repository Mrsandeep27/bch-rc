"""
generate-color-variants.py
===========================
Generates per-color variant heroes for the 5 visible SKUs. Edits each SKU's
existing hero shot so the body / chassis / studio lighting stay identical and
only the color/livery changes.

Output: public/products/colors/PRC-<slug>-<color-slug>.jpg  (1024x1024 JPEG q=88)

Color list matches Syed's inventory (see src/lib/products.ts colors[]).
Inventory stock numbers intentionally NOT used in any prompt -- they're
storefront-internal data only.
"""

import io
import os
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

from google import genai
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
PROD = REPO / "public" / "products"
OUT = PROD / "colors"
OUT.mkdir(parents=True, exist_ok=True)


def load_env_file(p: Path):
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


load_env_file(REPO / ".env.local")
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY missing", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"


# (sku_slug, hero_filename, [(color_slug, color_paint_description), ...])
JOBS = [
    (
        "bmw",
        "PRC-bmw.jpg",
        [
            ("white", "PRISTINE GLOSS WHITE body with subtle blue and red M-stripe racing decals along the side, BMW M-style coupe"),
            ("blue", "BMW-style M-blue (deep electric blue) body with white M-stripe racing accents, glossy paint, BMW M-style coupe"),
            ("black", "PIANO BLACK body with red M-stripe racing accents along the side, glossy paint, BMW M-style coupe"),
        ],
    ),
    (
        "porsche",
        "PRC-porsche.jpg",
        [
            ("dark-blue", "DARK MIDNIGHT NAVY BLUE body, Porsche 911 GT3 silhouette, glossy paint, racing decals minimal"),
            ("green", "PORSCHE RACING GREEN (deep British racing green) body, Porsche 911 GT3 silhouette, glossy paint"),
            ("yellow", "BRIGHT RACING YELLOW body, Porsche 911 GT3 silhouette, glossy paint, black wheel rims"),
            ("multi", "RAINBOW MULTI-COLOUR LIVERY body with orange, yellow, green, and blue color blocks in racing stripes pattern, Porsche 911 GT3 silhouette, glossy paint"),
        ],
    ),
    (
        "thar",
        "PRC-thar.jpg",
        [
            ("blue", "BRIGHT ROYAL BLUE body, Mahindra Thar-style off-road SUV with black soft-top roof, spare tyre on rear, glossy paint"),
            ("yellow", "BRIGHT SAFFRON YELLOW body, Mahindra Thar-style off-road SUV with black soft-top roof, spare tyre on rear, glossy paint"),
            ("white", "PRISTINE WHITE body, Mahindra Thar-style off-road SUV with black soft-top roof, spare tyre on rear, glossy paint"),
            ("black", "JET BLACK body, Mahindra Thar-style off-road SUV with matte black soft-top roof, spare tyre on rear, satin paint"),
        ],
    ),
    (
        "monster",
        "PRC-monster.jpg",
        [
            ("blue-68", "DEEP COBALT BLUE Monster Truck body with white racing number 68 decal on the side door, oversized black rubber tyres"),
            ("blue", "BRIGHT ROYAL BLUE Monster Truck body with white racing decals, oversized black rubber tyres"),
            ("yellow", "BRIGHT SAFFRON YELLOW Monster Truck body with black racing decals, oversized black rubber tyres"),
            ("white-red", "WHITE Monster Truck body with bold RED racing stripes and flames along the sides, oversized black rubber tyres"),
            ("multi", "RAINBOW MULTI-COLOUR LIVERY Monster Truck body with orange, yellow, green, and blue color blocks in flame pattern, oversized black rubber tyres"),
            ("red-orange", "DEEP RED-TO-ORANGE FADE flame paint job Monster Truck body, oversized black rubber tyres"),
        ],
    ),
    (
        "f1-classic",
        "PRC-f1-classic.jpg",
        [
            ("white", "PRISTINE WHITE F1 Formula 1 race car body with minimal red and silver accents, open exposed wheels with black tyres, aero kit, racing decals"),
            ("red", "FERRARI RED Formula 1 race car body with white and yellow accents, open exposed wheels with black tyres, aero kit"),
        ],
    ),
]

ANGLE_PROMPT = (
    "Generate the SAME EXACT CAR BODY as the input hero photo -- same shape, "
    "same chassis, same wheels, same camera angle (three-quarter front, slightly "
    "above eye level), same pure white studio backdrop, same studio lighting and "
    "soft shadow underneath. DO NOT change the body shape, wheels, or angle. "
    "ONLY change the paint job / livery to: {paint}. "
    "The result must look like the same toy car repainted, photographed in the "
    "same shoot. Premium e-commerce product photography. Square 1:1 aspect."
)


def call_gemini(prompt: str, input_image: Path) -> bytes | None:
    contents = [Image.open(input_image), prompt]
    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=contents)
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return part.inline_data.data
            print(f"    no image (attempt {attempt+1})")
        except Exception as e:
            print(f"    error (attempt {attempt+1}): {e}")
            time.sleep(2 * (attempt + 1))
    return None


def save_image(raw: bytes, output: Path):
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((1024, 1024), Image.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output, "JPEG", quality=88, optimize=True)
    print(f"    OK {output.name} ({output.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    print(f"Gemini: {API_KEY[:8]}...{API_KEY[-4:]} | Model: {MODEL}")
    total = sum(len(colors) for _, _, colors in JOBS)
    done = 0
    for sku_slug, hero_name, colors in JOBS:
        hero = PROD / hero_name
        if not hero.exists():
            print(f"\n[{sku_slug}] SKIP (hero missing: {hero_name})")
            continue
        print(f"\n[{sku_slug}] hero={hero_name}  variants={len(colors)}")
        for color_slug, paint_desc in colors:
            done += 1
            out_path = OUT / f"PRC-{sku_slug}-{color_slug}.jpg"
            print(f"  [{done}/{total}] {color_slug} -> {out_path.name}")
            prompt = ANGLE_PROMPT.format(paint=paint_desc)
            raw = call_gemini(prompt, hero)
            if raw:
                save_image(raw, out_path)
            else:
                print(f"    SKIPPED")
    print("\nDone.")
