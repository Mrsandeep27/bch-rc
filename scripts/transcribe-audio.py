"""
transcribe-audio.py
====================
Transcribes a WhatsApp voice note (or any audio file Gemini accepts) using
the same GEMINI_API_KEY already in .env.local.

Usage:
    python scripts/transcribe-audio.py "<path to .ogg / .mp3 / .wav / .m4a>"
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
    print("Usage: python transcribe-audio.py <audio file path>", file=sys.stderr)
    sys.exit(1)

audio_path = Path(sys.argv[1])
if not audio_path.exists():
    print(f"ERROR: file not found: {audio_path}", file=sys.stderr)
    sys.exit(1)

mime_map = {
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
}
ext = audio_path.suffix.lower()
mime = mime_map.get(ext, "audio/ogg")

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-2.5-flash"

print(f"Transcribing {audio_path.name} ({mime}, {audio_path.stat().st_size // 1024} KB)")
print(f"Model: {MODEL}")
print()

audio_bytes = audio_path.read_bytes()

prompt = (
    "Transcribe this audio recording verbatim. The speaker may be using "
    "English, Hindi, or a mix (Hinglish / Bangalore code-switching). "
    "Preserve their actual words. If a phrase is in Hindi, provide both "
    "the original (in Devanagari or Roman script as spoken) AND an English "
    "translation on the next line. Output ONLY the transcript -- no preamble, "
    "no summary, no commentary."
)

resp = client.models.generate_content(
    model=MODEL,
    contents=[
        types.Part.from_bytes(data=audio_bytes, mime_type=mime),
        prompt,
    ],
)

print("--- TRANSCRIPT ---")
print(resp.text)
print("--- END ---")
