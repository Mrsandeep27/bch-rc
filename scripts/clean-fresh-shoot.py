"""
clean-fresh-shoot.py
=====================
Takes the raw iPhone shots from the 2026-06-04 fresh shoot
(public/fresh/<Car>/Photos/IMG_*.JPG) and runs each through Gemini Nano Banana
to produce clean studio-white product photos that swap out the AI-generated
color variants under public/products/colors/.

Pipeline (per job):
  - load the raw iPhone JPEG (sideways, with phone shadow + wall corner visible)
  - prompt Gemini to: rotate to driving orientation, remove background, place
    on seamless white studio, center with ~12% padding, square 1:1
  - save 1024x1024 JPEG q=88 at the output_path

Mapping picked because each fresh shot matches an existing color slot exactly:
  BMW white          -> colors/PRC-bmw-white.jpg
  Porsche green      -> colors/PRC-porsche-green.jpg
  Monster yellow     -> colors/PRC-monster-yellow.jpg
  Thar black         -> colors/PRC-thar-black.jpg
  F1 Ferrari red     -> colors/PRC-f1-classic-red.jpg

Requires: GEMINI_API_KEY in .env.local (already there per generate-all-images.py).
Run: python scripts/clean-fresh-shoot.py
"""

import io
import os
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

from google import genai
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
FRESH = REPO / "public" / "fresh"
COLORS = REPO / "public" / "products" / "colors"


def load_env_file(p: Path) -> None:
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
    print("ERROR: GEMINI_API_KEY missing (.env.local or env)", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"


# Each job: one fresh raw iPhone JPG -> one color-variant slot.
# Inputs picked after eyeballing each folder; rotation direction is "CCW" for
# all of these because the cars are shot with the camera turned right -> the
# car body sits at the top of the frame pointing right when phone is held in
# portrait. To bring back to driving orientation we rotate 90 deg counter-
# clockwise. Gemini handles the actual rotation; we just describe the goal.
JOBS = [
    # ---- BMW (3 colors) ----
    {
        "slug": "bmw-white",
        "input": FRESH / "BMW" / "Photos" / "IMG_3526.JPG",
        "output": COLORS / "PRC-bmw-white.jpg",
        "car": (
            "a 1:64 scale toy BMW M-style sport coupe RC car. THE BODY COLOR "
            "IS PURE WHITE / OFF-WHITE (#f1f1ef) — not black, not grey. The "
            "input photo is dimly lit so the white body may look slightly "
            "shadowed; render it as bright clean white in the output. The car "
            "has blue and red 'SUPER RACING' / 'SPEED 77' / 'Sport' racing "
            "stripes and decals down both sides, a large black rear wing, "
            "alloy-look 5-spoke chrome wheels, and working headlight LEDs"
        ),
    },
    {
        "slug": "bmw-blue",
        "input": FRESH / "BMW" / "Photos" / "IMG_3536.JPG",
        "output": COLORS / "PRC-bmw-blue.jpg",
        "car": (
            "a 1:64 scale toy BMW M-style sport coupe RC car. THE BODY COLOR "
            "IS LIGHT METALLIC BLUE (Gulf-livery style, similar to #5cbcd6) "
            "with a vertical ORANGE racing stripe running front-to-back down "
            "the centre of the bonnet and roof, an 'MNCZ' / 'Sports Tepes' "
            "circular logo on the door, large black rear wing, alloy chrome "
            "5-spoke wheels"
        ),
    },
    {
        "slug": "bmw-black",
        "input": FRESH / "BMW" / "Photos" / "IMG_3534.JPG",
        "output": COLORS / "PRC-bmw-black.jpg",
        "car": (
            "a 1:64 scale toy BMW M-style sport coupe RC car. THE BODY COLOR "
            "IS GLOSSY DEEP BLACK (#111827) with blue and red 'SUPER RACING' "
            "/ 'SPEED 77' / 'Sport' racing stripes and decals down both sides "
            "(SAME decals as the white BMW variant — only the body color "
            "differs), large black rear wing, alloy chrome 5-spoke wheels, "
            "headlight LEDs"
        ),
    },

    # ---- Porsche (4 colors — all iridescent chameleon paint, different base hues) ----
    {
        "slug": "porsche-dark-blue",
        "input": FRESH / "Porsche" / "Photos" / "IMG_3561.JPG",
        "output": COLORS / "PRC-porsche-dark-blue.jpg",
        "car": (
            "a 1:64 scale toy rally-style sport coupe RC car (model HG-5168). "
            "THE BODY COLOR IS DEEP IRIDESCENT DARK BLUE (#1e3a8a base) with "
            "chameleon paint that shifts to purple and pink at the edges. "
            "Racing 'Racing Sports' decals + number '90' on the door, sport "
            "alloy wheels, low front splitter"
        ),
    },
    {
        "slug": "porsche-green",
        "input": FRESH / "Porsche" / "Photos" / "IMG_3548.JPG",
        "output": COLORS / "PRC-porsche-green.jpg",
        "car": (
            "a 1:64 scale toy rally-style sport coupe RC car (model HG-5168), "
            "iridescent green / chameleon-green body that shifts to blue and "
            "yellow at the edges, side livery + racing decals, sport wheels, "
            "low front splitter"
        ),
    },
    {
        "slug": "porsche-yellow",
        "input": FRESH / "Porsche" / "Photos" / "IMG_3555.JPG",
        "output": COLORS / "PRC-porsche-yellow.jpg",
        "car": (
            "a 1:64 scale toy rally-style sport coupe RC car (model HG-5168). "
            "THE BODY COLOR IS BRIGHT YELLOW (#facc15) base with subtle "
            "iridescent chameleon shifts to green at the panel seams. White "
            "'High Speed RC Racing' decals down the door, sport alloy wheels"
        ),
    },
    {
        "slug": "porsche-multi",
        "input": FRESH / "Porsche" / "Photos" / "IMG_3541.JPG",
        "output": COLORS / "PRC-porsche-multi.jpg",
        "car": (
            "a 1:64 scale toy rally-style sport coupe RC car (model HG-5168). "
            "THE BODY IS A FULL RAINBOW-SHIFTING IRIDESCENT CHAMELEON PAINT "
            "showing dark teal, purple, gold and orange highlights across the "
            "panels (multi-colour oil-slick finish). 'HG-5168' / '96' racing "
            "decals visible, sport alloy wheels"
        ),
    },

    # ---- Monster Truck (6 colors) ----
    {
        "slug": "monster-blue-68",
        "input": FRESH / "MonsterTruck" / "Photos" / "IMG_3512.JPG",
        "output": COLORS / "PRC-monster-blue-68.jpg",
        "car": (
            "a 1:64 scale toy monster truck RC car. THE BODY COLOR IS LIGHT "
            "METALLIC TEAL-BLUE (#1e40af-ish, slightly lighter and brighter). "
            "Big white '#68' number circle on the side door, 'OFF-ROAD' and "
            "'Trasped' style decals, oversized black rubber off-road tyres "
            "with chrome 5-spoke rims, lifted suspension, roof headlight bar"
        ),
    },
    {
        "slug": "monster-blue",
        "input": FRESH / "MonsterTruck" / "Photos" / "IMG_3507.JPG",
        "output": COLORS / "PRC-monster-blue.jpg",
        "car": (
            "a 1:64 scale toy monster truck RC car. THE BODY COLOR IS BRIGHT "
            "ROYAL BLUE (#2563eb) with colourful 'OFF-ROAD' decals across the "
            "body sides. Oversized black rubber off-road tyres with chrome "
            "rims, lifted suspension, roof headlight bar, front winch"
        ),
    },
    {
        "slug": "monster-yellow",
        "input": FRESH / "MonsterTruck" / "Photos" / "IMG_3500.JPG",
        "output": COLORS / "PRC-monster-yellow.jpg",
        "car": (
            "a 1:64 scale toy yellow monster truck RC car with oversized black "
            "rubber off-road tyres, '4x4' decals, roll cage / roof headlight "
            "bar, raised lifted suspension"
        ),
    },
    {
        "slug": "monster-white-red",
        "input": FRESH / "MonsterTruck" / "Photos" / "IMG_3520.JPG",
        "output": COLORS / "PRC-monster-white-red.jpg",
        "car": (
            "a 1:64 scale toy monster truck RC car. THE BODY IS WHITE with "
            "RED side accents and blue 'POWER' / 'Speed' / '4x4' decals "
            "running across the doors. Oversized black rubber off-road tyres "
            "with chrome rims, lifted suspension"
        ),
    },
    {
        "slug": "monster-multi",
        "input": FRESH / "MonsterTruck" / "Photos" / "IMG_3514.JPG",
        "output": COLORS / "PRC-monster-multi.jpg",
        "car": (
            "a 1:64 scale toy monster truck RC car. THE BODY IS COVERED IN "
            "COLOURFUL GRAFFITI / STREET-ART PRINT (orange, yellow, green, "
            "blue swatches mixed across the panels) with bold 'OFF-ROAD' "
            "decals. Oversized black rubber off-road tyres with chrome rims, "
            "lifted suspension"
        ),
    },
    {
        "slug": "monster-red-orange",
        "input": FRESH / "MonsterTruck" / "Photos" / "IMG_3494.JPG",
        "output": COLORS / "PRC-monster-red-orange.jpg",
        "car": (
            "a 1:64 scale toy monster truck RC car. THE BODY IS GLOSSY RED "
            "fading into ORANGE highlights (red-to-orange gradient) with "
            "'POWER 20' and 'Travel Through' style racing decals. Oversized "
            "black rubber off-road tyres with chrome rims, lifted suspension, "
            "roof headlight bar"
        ),
    },

    # ---- Thar (4 colors — black is Wrangler body, blue/yellow/white are Toyota Land Cruiser body
    #      User confirmed using both bodies anyway) ----
    {
        "slug": "thar-black",
        "input": FRESH / "Thar" / "Photos" / "IMG_3570.JPG",
        "output": COLORS / "PRC-thar-black.jpg",
        "car": (
            "a 1:64 scale toy Mahindra Thar-style / Jeep Wrangler-style off-"
            "road SUV RC car, glossy black body with yellow 'EXTREME CROSSING' "
            "/ 'FEARLESS' decals, chrome bull-bar and side steps, spare tyre "
            "on the rear, alloy off-road wheels"
        ),
    },
    {
        "slug": "thar-blue",
        "input": FRESH / "Thar" / "Photos" / "IMG_3563.JPG",
        "output": COLORS / "PRC-thar-blue.jpg",
        "car": (
            "a 1:64 scale toy off-road SUV RC car in the Toyota Land Cruiser "
            "style (boxy body, twin headlamps, 'TOYOTA' badged front). THE "
            "BODY IS METALLIC LIGHT BLUE (#5cbcd6, Gulf-livery style) with a "
            "vertical ORANGE racing stripe running front-to-back. 'CROSS-"
            "COUNTRY' / 'MNCZ' circular logo on the door, alloy chrome wheels"
        ),
    },
    {
        "slug": "thar-yellow",
        "input": FRESH / "Thar" / "Photos" / "IMG_3578.JPG",
        "output": COLORS / "PRC-thar-yellow.jpg",
        "car": (
            "a 1:64 scale toy off-road SUV RC car in the Toyota Land Cruiser "
            "style (boxy body, twin headlamps, 'TOYOTA' badged front). THE "
            "BODY IS BRIGHT METALLIC YELLOW (#facc15) with 'Adventure' "
            "cursive script + 'EXPLORERS 1970' triangular badge in black on "
            "the door, alloy chrome wheels"
        ),
    },
    {
        "slug": "thar-white",
        "input": FRESH / "Thar" / "Photos" / "IMG_3573.JPG",
        "output": COLORS / "PRC-thar-white.jpg",
        "car": (
            "a 1:64 scale toy off-road SUV RC car in the Toyota Land Cruiser "
            "style (boxy body, twin headlamps, 'TOYOTA' badged front). THE "
            "BODY IS GLOSSY OFF-WHITE (#f1f1ef) with blue 'POWER' / 'Speed' "
            "/ '4x4' decals across the door, alloy chrome wheels"
        ),
    },

    # ---- F1 Classic (2 colors) ----
    {
        "slug": "f1-classic-red",
        "input": FRESH / "F1" / "Photos" / "IMG_3585.JPG",
        "output": COLORS / "PRC-f1-classic-red.jpg",
        "car": (
            "a 1:64 scale toy Formula 1 race car (Ferrari-style red livery), "
            "open-wheel chassis, exposed front and rear wings, low aero body, "
            "low-profile racing tyres, prancing-horse style racing decals"
        ),
    },
    {
        "slug": "f1-classic-white",
        "input": FRESH / "F1" / "Photos" / "IMG_3588.JPG",
        "output": COLORS / "PRC-f1-classic-white.jpg",
        "car": (
            "a 1:64 scale toy Formula 1 race car in WHITE livery with RED "
            "accent stripes and 'OHX' / 'Win Lucky' / 'Victory' racing decals "
            "(Honda-style white edition). Open-wheel chassis, exposed front "
            "and rear wings, low aero body, low-profile racing tyres. "
            "Render as a CLEAN SIDE-PROFILE view (3/4 angle from the front-"
            "left like a hero product shot) to match the other F1 color "
            "variants — NOT a head-on / front-only view"
        ),
    },
]


def build_prompt(car_description: str) -> str:
    return (
        f"Edit this raw iPhone product photo of {car_description}.\n\n"
        "Tasks:\n"
        "(1) Rotate the image so the car sits horizontally in normal driving "
        "orientation (wheels on the ground). The raw photo was shot with the "
        "phone turned sideways so the car currently appears rotated 90 degrees.\n"
        "(2) Completely remove the background — the cream/grey wall corner, "
        "the floor, any iPhone-cast shadow and any wall edges — replace with a "
        "seamless pure white studio backdrop, RGB 250,250,250, no gradient.\n"
        "(3) Center the car perfectly in the frame, leaving roughly 12 percent "
        "padding on all four sides so the car reads as a hero subject.\n"
        "(4) Output a perfectly square 1:1 aspect ratio.\n"
        "(5) Preserve the car's exact body color, all decals, the wheel and "
        "headlight detail. Do NOT recolor, add new decals, or alter the model. "
        "This is a faithful cleanup, not a recolor.\n"
        "(6) Add a very subtle soft contact shadow under the wheels so the car "
        "doesn't look like it's floating, but the background stays pure white "
        "everywhere else.\n\n"
        "Output: a clean e-commerce hero shot of the same car, ready to drop "
        "into a product page color picker."
    )


def call_gemini(prompt: str, input_image_path: Path) -> bytes | None:
    """Returns raw image bytes from Gemini, or None if the response had no image."""
    contents: list = [Image.open(input_image_path), prompt]
    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=contents)
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return part.inline_data.data
            print(f"  -> no image in response (attempt {attempt + 1})")
        except Exception as e:
            print(f"  -> error (attempt {attempt + 1}): {e}")
            time.sleep(2 * (attempt + 1))
    return None


def save_image(raw: bytes, output_path: Path, target_size: tuple[int, int] = (1024, 1024)) -> None:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail(target_size, Image.LANCZOS)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "JPEG", quality=88, optimize=True)
    print(f"  OK  {output_path.relative_to(REPO)}  ({output_path.stat().st_size // 1024} KB)")


def main() -> int:
    # Optional slug filter: `python clean-fresh-shoot.py --only bmw-white,porsche-green`
    only: set[str] | None = None
    if "--only" in sys.argv:
        i = sys.argv.index("--only")
        only = {s.strip() for s in sys.argv[i + 1].split(",") if s.strip()}

    jobs = [j for j in JOBS if only is None or j["slug"] in only]

    print(f"Gemini key:  {API_KEY[:8]}...{API_KEY[-4:]}")
    print(f"Model:       {MODEL}")
    print(f"Jobs:        {len(jobs)}" + (f" (filtered from {len(JOBS)} via --only)" if only else "") + "\n")

    failed: list[str] = []
    for j in jobs:
        print(f"[{j['slug']}]  {j['input'].name} -> {j['output'].name}")
        if not j["input"].exists():
            print(f"  X  input missing: {j['input']}")
            failed.append(j["slug"])
            continue
        raw = call_gemini(build_prompt(j["car"]), j["input"])
        if raw:
            save_image(raw, j["output"])
        else:
            print(f"  X  skipped {j['slug']} -- no usable image returned")
            failed.append(j["slug"])

    print()
    if failed:
        print(f"DONE with {len(failed)} failure(s): {', '.join(failed)}")
        return 1
    print("DONE - all 5 color variants regenerated from real photos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
