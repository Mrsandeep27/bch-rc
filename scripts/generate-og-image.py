"""
generate-og-image.py
=====================
Generates a 1200x630 Open Graph share card for pocketrccars.com using the
existing BMW hero shot as the input. Output: /public/og-image.jpg

This is the image previewed when the site link is shared on WhatsApp,
Twitter, LinkedIn, Slack, iMessage, etc.
"""

import io
import os
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

from google import genai
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
HERO_INPUT = REPO / "public" / "products" / "PRC-bmw.jpg"
OUT = REPO / "public" / "og-image.jpg"


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

if not HERO_INPUT.exists():
    print(f"ERROR: hero input not found: {HERO_INPUT}", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"

prompt = (
    "Create a 1200x630 Open Graph share card for a premium D2C e-commerce "
    "site selling 1:64 scale RC drift cars. The brand is 'PRC Cars' "
    "(Pocket RC Cars). Use the input image as the hero subject. "
    "\n\nComposition: dramatic dark background (deep matte black with subtle "
    "racing-red rim lighting), the toy car positioned in the right half (3/4 "
    "front three-quarter view, headlights glowing). Left half: bold white "
    "display-font text reading 'Drift. Race. Pocket.' on the top, smaller "
    "secondary text below in lighter weight reading 'Mini RC Drift Cars from "
    "Rs.1,299 · COD pan-India · Ships in 24 hrs from Bangalore'. Bottom-left "
    "corner: a bright red brand badge with 'PRC' lockup. "
    "\n\nStyle: premium D2C e-commerce hero, cinematic lighting, motion-blur "
    "tire smoke wisps from the car, slight chromatic aberration for energy. "
    "Aspect ratio strictly 1200x630 (landscape, wider than tall). High "
    "contrast, readable on small mobile previews. Match the in-product feel: "
    "matte black, racing red (#E11D2A), pure white text."
)


def call_gemini(prompt: str, input_image: Path) -> bytes | None:
    contents = [Image.open(input_image), prompt]
    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=contents)
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return part.inline_data.data
            print(f"  no image (attempt {attempt + 1})")
        except Exception as e:
            print(f"  error (attempt {attempt + 1}): {e}")
    return None


print(f"Gemini: {API_KEY[:8]}...{API_KEY[-4:]} | Model: {MODEL}")
print(f"Input:  {HERO_INPUT.name}")
print("Generating OG share card...")

raw = call_gemini(prompt, HERO_INPUT)
if not raw:
    print("FAILED — Gemini returned no image", file=sys.stderr)
    sys.exit(1)

img = Image.open(io.BytesIO(raw)).convert("RGB")
# Hard-resize to exactly 1200x630 (OG spec; Twitter falls back to 2:1)
img = img.resize((1200, 630), Image.LANCZOS)
img.save(OUT, "JPEG", quality=88, optimize=True)
print(f"OK saved: {OUT.relative_to(REPO)} ({OUT.stat().st_size // 1024} KB)")
