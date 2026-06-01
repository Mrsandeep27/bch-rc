"""
Quick one-off: regenerate features/drift.jpg WITHOUT baked-in text so the tile
matches the other 3 (image-only background, text rendered in the glass card
overlay in code).
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


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
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
    print("ERROR: GEMINI_API_KEY missing.", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"

PROMPT = (
    "Cinematic atmospheric image: a tiny 1:64 scale toy RC car drifting on a "
    "glossy marble or polished tile floor, viewed from above and at an angle. "
    "Tire smoke and motion blur curve behind the car showing the drift arc. "
    "Deep moody lighting with red rim accents on the smoke. The car is in the "
    "lower-right portion of the frame leaving the upper-left empty as negative "
    "space. Vertical 4:5 portrait aspect ratio. "
    "CRITICAL: This image must contain ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, "
    "NO TYPOGRAPHY, NO CAPTIONS of any kind anywhere in the frame. Pure "
    "photographic imagery only. Premium automotive product photography style."
)

OUTPUT = REPO / "public" / "features" / "drift.jpg"

print(f"Regenerating {OUTPUT.relative_to(REPO)} (text-free this time)...")

for attempt in range(3):
    try:
        resp = client.models.generate_content(model=MODEL, contents=[PROMPT])
        for part in resp.candidates[0].content.parts:
            if getattr(part, "inline_data", None) and part.inline_data.data:
                img = Image.open(io.BytesIO(part.inline_data.data)).convert("RGB")
                img.thumbnail((1024, 1280), Image.LANCZOS)
                OUTPUT.parent.mkdir(parents=True, exist_ok=True)
                img.save(OUTPUT, "JPEG", quality=88, optimize=True)
                print(f"OK  saved ({OUTPUT.stat().st_size // 1024}KB)")
                sys.exit(0)
        print(f"  no image returned (attempt {attempt+1})")
    except Exception as e:
        print(f"  error (attempt {attempt+1}): {e}")
        time.sleep(2 * (attempt + 1))

print("FAILED after 3 attempts", file=sys.stderr)
sys.exit(1)
