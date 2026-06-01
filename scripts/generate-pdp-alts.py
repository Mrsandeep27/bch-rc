"""
generate-pdp-alts.py
=====================
Generates 3 additional gallery images per SKU for the PDP, matching the hero
shot's studio-white style. Outputs:

  /public/products/PRC-<slug>-2.jpg  -- top-down overhead
  /public/products/PRC-<slug>-3.jpg  -- in-hand / scale-comparison
  /public/products/PRC-<slug>-4.jpg  -- detail close-up (LED / wheels / livery)

Inputs the existing PRC-<slug>.jpg hero so Gemini stays consistent on the
specific car body & colors instead of inventing a new one.

Requires: GEMINI_API_KEY in .env.local or env.
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
OUT = REPO / "public" / "products"


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

# Slug -> (hero path, friendly product description)
SKUS = [
    ("bmw", "white BMW M-style sport coupe with red+blue racing stripes and 'SUPER RACING' decals"),
    ("porsche", "blue rally-style sport car with 'Racing Sports' decals and racing number"),
    ("thar", "black + yellow off-road SUV with 'EXTREME CROSSING' decals, spare tyre on roof"),
    ("monster", "red Monster Truck with oversized black rubber tyres, headlight bar, number 20 decal"),
    ("f1-classic", "yellow + black Formula 1 race car, exposed open wheels, aero kit"),
    ("f1-ferrari", "white-livery Ferrari-style Formula 1 race car with red accents, exposed wheels"),
    ("beetle", "pink metallic VW Beetle-style classic body with chrome trim, round roof"),
    ("f1-driver", "red Ferrari-style F1 with seated driver figurine in racing helmet at the wheel"),
]

# Angle suffix -> prompt template fragment
ANGLES = [
    (
        "2",
        "TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down). Show the roof, "
        "windshield, and full footprint of the toy car. Same pure white studio "
        "backdrop, centered with 12% padding, perfectly square 1:1 ratio.",
    ),
    (
        "3",
        "SCALE-IN-HAND shot: the same toy car sitting in the palm of an adult hand "
        "(realistic human hand, no jewelry, neutral skin tone), photographed against "
        "a soft warm gradient backdrop (cream to peach). The car should appear "
        "comically small in the palm to emphasize the 1:64 pocket-size. Slightly "
        "above the hand, three-quarter angle, soft natural lighting, premium "
        "lifestyle product photo. Square 1:1.",
    ),
    (
        "4",
        "DETAIL CLOSE-UP: zoom into the front of the toy car showing the LED "
        "headlights (lit up bright white/blue), front wheel rim, and front decals "
        "in sharp focus. Background tastefully blurred. Same studio-white backdrop. "
        "Premium macro product photography. Square 1:1.",
    ),
]

BASE_PROMPT_PREFIX = (
    "Premium e-commerce product photography of a 1:64 scale toy RC car. "
    "The specific car: {desc}. "
)


def call_gemini(prompt: str, input_image: Path) -> bytes | None:
    """Edit the existing hero so the new shot is the SAME car body, not a different one."""
    contents = [Image.open(input_image), prompt]
    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=contents)
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return part.inline_data.data
            print(f"    no image in response (attempt {attempt+1})")
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
    for slug, desc in SKUS:
        hero = OUT / f"PRC-{slug}.jpg"
        if not hero.exists():
            print(f"\n[{slug}] SKIP (hero missing: {hero.name})")
            continue
        print(f"\n[{slug}] hero -> {hero.name}")
        for suffix, angle_prompt in ANGLES:
            out_path = OUT / f"PRC-{slug}-{suffix}.jpg"
            print(f"  [{suffix}] generating...")
            prompt = BASE_PROMPT_PREFIX.format(desc=desc) + (
                "Generate a new angle of THIS SAME EXACT CAR (do not change its color, "
                "decals, or body shape). " + angle_prompt + " The output must visually "
                "match the input hero photo as if it were taken in the same shoot."
            )
            raw = call_gemini(prompt, hero)
            if raw:
                save_image(raw, out_path)
            else:
                print(f"    SKIPPED")
    print("\nDone.")
