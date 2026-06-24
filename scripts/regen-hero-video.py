"""Re-encode the hero drift loop from the 1080x1920 master for crisp mobile.

Why this exists (supersedes the drift entries in shrink-videos.py):
  The earlier crush pass downscaled the hero to 720px-wide (mobile) / 900px-wide
  (desktop) at CRF 30. On a modern 3x-DPI phone the storefront paints the loop
  full-bleed (object-cover, min-h-100svh), so a 720px source gets upscaled ~1.6x
  and the aggressive CRF mush is magnified -> soft, blocky smoke. The biggest
  perceptual win is simply encoding at NATIVE 1080 width so it maps ~1:1 to real
  device pixels; a slightly lower CRF then cleans up the tire-smoke gradients
  that H.264 bands worst.

Master:  ./Rc Cars Driving.mp4  (1080x1920, 60fps, ~14.8 Mbps)
Outputs (30fps is plenty for a muted background loop and halves the bitrate):
  public/hero/drift-mobile.mp4  1080x1920 CRF 29  (~4.6 MB)  <= phones, the file that matters
  public/hero/drift.mp4         1080x1920 CRF 27  (~5.6 MB)  <= desktop fallback (cropped by object-cover)

Settings: libx264 high profile, preset slow, yuv420p, +faststart (so the moov
atom is up front and the loop starts streaming before the full file lands),
audio stripped (the loop is always muted). Writes a temp file then replaces, so
a re-run just re-encodes idempotently.
"""

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MASTER = REPO / "Rc Cars Driving.mp4"

# (output path relative to repo, crf)
JOBS = [
    ("public/hero/drift-mobile.mp4", 29),
    ("public/hero/drift.mp4", 27),
]

SCALE = "scale=1080:1920:flags=lanczos,fps=30"


def encode(rel: str, crf: int) -> None:
    dst = REPO / rel
    tmp = dst.with_suffix(".tmp.mp4")
    cmd = [
        "ffmpeg", "-y", "-i", str(MASTER),
        "-an",
        "-vf", SCALE,
        "-c:v", "libx264", "-profile:v", "high",
        "-crf", str(crf), "-preset", "slow",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(tmp),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL {rel}: {r.stderr[-300:]}")
        tmp.unlink(missing_ok=True)
        return
    before = dst.stat().st_size if dst.exists() else 0
    tmp.replace(dst)
    after = dst.stat().st_size
    print(f"OK  {rel:<32} {before//1024:>5}KB -> {after//1024:>5}KB  (CRF {crf})")


if __name__ == "__main__":
    if not MASTER.exists():
        print(f"ERROR: master not found at {MASTER}", file=sys.stderr)
        sys.exit(1)
    for rel, crf in JOBS:
        encode(rel, crf)
