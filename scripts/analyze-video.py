"""
analyze-video.py
================
Sends a video/image to Gemini 2.5 Pro and asks for a structured description
focused on errors, console messages, UI bugs. Uses the same GEMINI_API_KEY
already in .env.local.

Usage:
    python scripts/analyze-video.py "<path to .mp4 / .mov / .webm / .png / .jpg>"
    python scripts/analyze-video.py "<path>" "<custom prompt>"
"""

import os
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

from google import genai
from google.genai import types

REPO = Path(__file__).resolve().parent.parent


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

if len(sys.argv) < 2:
    print("Usage: python analyze-video.py <media file> [custom prompt]", file=sys.stderr)
    sys.exit(1)

media_path = Path(sys.argv[1])
custom_prompt = sys.argv[2] if len(sys.argv) > 2 else None

if not media_path.exists():
    print(f"ERROR: file not found: {media_path}", file=sys.stderr)
    sys.exit(1)

mime_map = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
ext = media_path.suffix.lower()
mime = mime_map.get(ext)
if not mime:
    print(f"ERROR: unsupported extension {ext}", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-2.5-pro"

size_kb = media_path.stat().st_size // 1024
print(f"Analyzing {media_path.name} ({mime}, {size_kb} KB)")
print(f"Model: {MODEL}")
print()

media_bytes = media_path.read_bytes()

default_prompt = (
    "Look at this recording. The person is showing me an error or bug "
    "happening on a website / app. Report:\n"
    "1. EXACT error text shown on screen (verbatim, including any HTTP "
    "status codes, stack traces, or toast messages).\n"
    "2. The URL or page they're on, if visible.\n"
    "3. The action they took just before the error (button clicked, form "
    "submitted, etc.).\n"
    "4. Any other relevant UI state — selected payment method, cart total, "
    "form field values that look wrong, network requests in dev tools, etc.\n"
    "5. Your best one-sentence diagnosis of the root cause.\n"
    "Be precise. Quote text verbatim. No filler."
)

prompt = custom_prompt or default_prompt

resp = client.models.generate_content(
    model=MODEL,
    contents=[
        types.Part.from_bytes(data=media_bytes, mime_type=mime),
        prompt,
    ],
)

print("--- ANALYSIS ---")
print(resp.text)
print("--- END ---")
