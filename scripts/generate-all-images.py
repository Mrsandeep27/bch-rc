"""
generate-all-images.py
=======================
Generates / cleans all imagery for the PRC Cars home page in one pass.

Pipeline:
  1. EDIT  — for the 4 cars we shot ourselves (BMW, Porsche, Thar, Monster),
             take one raw iPhone photo, send to Gemini Nano Banana with an
             image-edit prompt: rotate upright, remove background, place on
             clean studio white seamless, square 1:1 crop.
  2. GEN   — for the 4 Trasped variants we don't own photos of (F1 Classic,
             F1 Ferrari, Beetle, F1+Driver), generate from-scratch product
             hero shots described in detail to mirror real Trasped HG4 models.
  3. GEN   — for the 4 FeatureCarousel tiles (Drift / Pocket / USB-C / Race),
             generate atmospheric concept images that visually describe the
             feature line, sized for tile background usage.

Outputs land in public/products/PRC-{slug}.jpg  and
              public/features/{slug}.jpg

Requires:  GEMINI_API_KEY env var (paid key — image-gen model is gated).
Run:       python scripts/generate-all-images.py
"""

import base64
import os
import sys
import time
from pathlib import Path

# Force UTF-8 on Windows stdout to prevent cp1252 crashes on em-dash etc.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

from google import genai
from google.genai import types
from PIL import Image
import io

# --- Config -----------------------------------------------------------------

REPO = Path(__file__).resolve().parent.parent
RAW_PHOTOS_DIR = REPO / "public" / "products"
OUT_PRODUCTS = REPO / "public" / "products"
OUT_FEATURES = REPO / "public" / "features"
OUT_FEATURES.mkdir(parents=True, exist_ok=True)

# Model: Gemini's image gen / edit model.
# `gemini-3-pro-image-preview` confirmed working in earlier hero-gen runs.
MODEL = "gemini-3-pro-image-preview"

def load_env_file(env_path: Path) -> None:
    """Tiny dotenv loader — pulls KEY=value lines into os.environ if not already set."""
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


# Load .env.local from repo root (gitignored) before reading the env var
load_env_file(Path(__file__).resolve().parent.parent / ".env.local")

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY env var not set (also missing from .env.local).", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=API_KEY)

# --- EDIT JOBS (own photos -> cleaned product shot) --------------------------

EDIT_JOBS = [
    {
        "slug": "bmw",
        "input": RAW_PHOTOS_DIR / "bmw" / "photos" / "IMG_3194.JPG",
        "output": OUT_PRODUCTS / "PRC-bmw.jpg",
        "prompt": (
            "Edit this product photo of a toy 1:64 scale BMW M-style sport coupe "
            "RC car (white body with red+blue racing stripes saying 'SUPER RACING'). "
            "Tasks: (1) rotate image 90 degrees clockwise so car is in horizontal "
            "driving orientation, (2) completely remove the cluttered background "
            "(toy display boxes, shelves, surfaces) and replace with seamless pure "
            "white studio backdrop (RGB 250,250,250), (3) center the car perfectly, "
            "leaving roughly 12% padding on all sides, (4) output a perfectly square "
            "1:1 aspect ratio, (5) keep the car's original colors, decals, and details "
            "intact — just clean the background. Output: clean e-commerce hero shot "
            "ready for product page."
        ),
    },
    {
        "slug": "porsche",
        "input": RAW_PHOTOS_DIR / "porsche" / "photos" / "IMG_3185.JPG",
        "output": OUT_PRODUCTS / "PRC-porsche.jpg",
        "prompt": (
            "Edit this product photo of a toy 1:64 scale rally-style RC car "
            "(blue body with 'Racing Sports' decals, model number HG-5168 visible). "
            "Tasks: (1) rotate image 90 degrees clockwise so car faces horizontally, "
            "(2) remove the cluttered toy-shop background completely and replace "
            "with seamless pure white studio backdrop, (3) center the car with 12% "
            "padding all sides, (4) make output square 1:1, (5) preserve the car's "
            "blue color, racing decals, and detail. Output: premium e-commerce "
            "product photo with clean white background."
        ),
    },
    {
        "slug": "thar",
        "input": RAW_PHOTOS_DIR / "thar" / "photos" / "IMG_3167.JPG",
        "output": OUT_PRODUCTS / "PRC-thar.jpg",
        "prompt": (
            "Edit this product photo of a toy 1:64 scale Thar-style off-road "
            "SUV (black body with yellow 'EXTREME CROSSING' / 'FEARLESS' decals, "
            "spare tire on roof and rear). Tasks: (1) rotate image 90 degrees "
            "clockwise to upright driving orientation, (2) completely remove the "
            "messy display-shelf background and replace with seamless pure white "
            "studio backdrop, (3) center the truck with 12% padding, (4) square "
            "1:1 aspect ratio, (5) keep all original colors, decals, the spare "
            "tire, and detail intact. Output: clean product hero shot."
        ),
    },
    {
        "slug": "monster",
        "input": RAW_PHOTOS_DIR / "monster-truck" / "photos" / "IMG_3156.JPG",
        "output": OUT_PRODUCTS / "PRC-monster.jpg",
        "prompt": (
            "Edit this product photo of a toy 1:64 scale red Monster Truck "
            "(oversized black rubber tyres, red body, headlight bar on roof, "
            "racing decals). Tasks: (1) rotate image 90 degrees clockwise to "
            "upright orientation, (2) remove background (display boxes, shelves) "
            "and replace with pure white seamless studio backdrop, (3) center "
            "the truck with 12% padding, (4) square 1:1 ratio, (5) preserve "
            "the red body color, big tyres, headlight bar, and all decals. "
            "Output: dramatic clean product photo, slight 3/4 angle preferred."
        ),
    },
]

# --- GEN JOBS (variants we don't own — pure text-to-image) -----------------

GEN_JOBS = [
    {
        "slug": "f1-classic",
        "output": OUT_PRODUCTS / "PRC-f1-classic.jpg",
        "prompt": (
            "A clean product photo of a 1:64 scale toy RC car: a Formula 1 race "
            "car in the style of Trasped HG4-218. Yellow + black livery, open-wheel "
            "with exposed front and rear wings, aero bodywork, low-profile racing "
            "tires, alloy die-cast body. Pure white seamless studio backdrop. "
            "Centered with 12% padding, perfectly square 1:1 aspect ratio, "
            "soft even lighting, slight 3/4 angle, premium e-commerce hero shot. "
            "Toy size is about 7cm long — render the car at hero scale on the canvas."
        ),
    },
    {
        "slug": "f1-ferrari",
        "output": OUT_PRODUCTS / "PRC-f1-ferrari.jpg",
        "prompt": (
            "A clean product photo of a 1:64 scale toy RC car: a Formula 1 race "
            "car in the style of Trasped HG4-234, white Ferrari-livery edition. "
            "White body with red Ferrari-style accents, exposed open wheels, "
            "detailed aero kit, rear wing, alloy die-cast body, slight 3/4 angle "
            "view. Pure white seamless studio backdrop, centered with 12% padding, "
            "perfectly square 1:1 ratio, soft even lighting, premium hero shot "
            "matching a luxury e-commerce product page."
        ),
    },
    {
        "slug": "beetle",
        "output": OUT_PRODUCTS / "PRC-beetle.jpg",
        "prompt": (
            "A clean product photo of a 1:64 scale toy RC car: a VW Beetle-style "
            "drift car in the style of Trasped HG4-216. Round curved roof, classic "
            "Beetle body shape, pink + chrome accents or red body with white roof, "
            "small headlights, alloy die-cast body. Pure white seamless studio "
            "backdrop, centered with 12% padding, perfectly square 1:1, soft "
            "lighting, slight 3/4 front-angle, premium e-commerce hero shot."
        ),
    },
    {
        "slug": "f1-driver",
        "output": OUT_PRODUCTS / "PRC-f1-driver.jpg",
        "prompt": (
            "A clean product photo of a 1:64 scale premium toy RC car: a Formula 1 "
            "Leclerc-style race car with a tiny mounted driver figurine wearing "
            "racing helmet sitting in cockpit. Red Ferrari-style F1 livery, exposed "
            "wheels, detailed aero, driver figure clearly visible at the wheel. "
            "Pure white seamless studio backdrop, centered with 12% padding, "
            "perfectly square 1:1, soft cinematic lighting, slight 3/4 angle, "
            "premium collector-grade hero shot."
        ),
    },
]

# --- FEATURE CAROUSEL JOBS -------------------------------------------------

FEATURE_JOBS = [
    {
        "slug": "drift",
        "output": OUT_FEATURES / "drift.jpg",
        "prompt": (
            "Cinematic atmospheric image: a tiny 1:64 scale toy RC car drifting "
            "on a glossy marble or polished tile floor, viewed from above and at "
            "an angle. Tire smoke and motion blur curve behind the car showing "
            "the drift arc. Deep moody lighting with red rim accents. Vertical "
            "tile aspect ratio (4:5 portrait), used as background for text overlay "
            "with the words 'Slides on any smooth floor.' The car should be in the "
            "lower-right third leaving the upper-left empty for text. Premium "
            "automotive photography style."
        ),
    },
    {
        "slug": "pocket",
        "output": OUT_FEATURES / "pocket.jpg",
        "prompt": (
            "Cinematic close-up: a tiny 1:64 scale toy RC car sitting in the palm "
            "of an adult open hand, hand held against a deep matte-black background. "
            "Single-source warm side lighting illuminates the hand and car. The "
            "small scale of the car is the hero — comparable to a Hot Wheels die-cast. "
            "Vertical 4:5 portrait aspect ratio, hand and car positioned lower-right "
            "with upper-left empty space for headline text. Cinematic shallow depth "
            "of field, premium product photography."
        ),
    },
    {
        "slug": "usbc",
        "output": OUT_FEATURES / "usbc.jpg",
        "prompt": (
            "Cinematic close-up: USB-C charging cable plugged into a tiny 1:64 "
            "scale toy RC car, deep cool-blue moody background, a small glowing "
            "LED indicator on the car shows it's charging. The cable curves "
            "elegantly out of frame. Vertical 4:5 portrait aspect ratio. Car and "
            "cable in lower-right third, upper-left empty for headline text. "
            "Premium tech-product photography aesthetic with blue accent glow."
        ),
    },
    {
        "slug": "race",
        "output": OUT_FEATURES / "race.jpg",
        "prompt": (
            "Cinematic action shot: three tiny 1:64 scale toy RC cars racing "
            "side-by-side on a polished hardwood or marble floor, motion blur "
            "trailing behind each car, race-track ambiance with a finish line "
            "visible in soft focus far back. Deep moody background with red "
            "accent lighting. Vertical 4:5 portrait aspect ratio. Cars positioned "
            "lower-right third, upper-left negative space for headline text. "
            "High-end automotive racing photography style."
        ),
    },
]

# --- Engine ----------------------------------------------------------------


def call_gemini(prompt: str, input_image_path: Path | None = None) -> bytes | None:
    """Returns raw image bytes (JPG/PNG) from Gemini, or None if the response had no image."""
    contents: list = [prompt]
    if input_image_path:
        contents.insert(0, Image.open(input_image_path))

    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=contents)
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return part.inline_data.data
            print(f"  -> no image in response (attempt {attempt+1})")
        except Exception as e:
            print(f"  -> error (attempt {attempt+1}): {e}")
            time.sleep(2 * (attempt + 1))
    return None


def save_image(raw: bytes, output_path: Path, target_size: tuple[int, int] = (1024, 1024)):
    """Re-encode as optimized JPEG at target size."""
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail(target_size, Image.LANCZOS)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "JPEG", quality=88, optimize=True)
    print(f"  OK saved {output_path.relative_to(REPO)} ({output_path.stat().st_size // 1024}KB)")


def run_jobs(jobs: list[dict], kind: str, with_input: bool):
    print(f"\n=== {kind} ({len(jobs)} jobs) ===")
    for j in jobs:
        print(f"[{j['slug']}] {kind}…")
        input_path = j.get("input") if with_input else None
        raw = call_gemini(j["prompt"], input_path)
        if raw:
            # Feature tiles get portrait 4:5, products get square 1:1
            size = (1024, 1280) if "features" in str(j["output"]) else (1024, 1024)
            save_image(raw, j["output"], target_size=size)
        else:
            print(f"  X skipped {j['slug']} -- no usable image returned")


if __name__ == "__main__":
    print(f"Gemini key:  {API_KEY[:8]}…{API_KEY[-4:]}")
    print(f"Model:       {MODEL}")
    run_jobs(EDIT_JOBS, "EDIT (own photos)", with_input=True)
    run_jobs(GEN_JOBS, "GEN (Trasped variants)", with_input=False)
    run_jobs(FEATURE_JOBS, "GEN (feature tiles)", with_input=False)
    print("\nDone. Outputs in public/products/PRC-*.jpg and public/features/*.jpg")
