"""Crush the bandwidth-heavy videos that caused the 43 GB Jun-21 spike.

Root cause: the autoplay hero video (6.3 MB desktop / 3.2 MB mobile) downloads
fully on EVERY homepage visit; plus UGC videos (4-9 MB) autoplay on scroll.

This re-encodes them to a fraction of the size with no visible loss for a
muted, gradient-overlaid background loop:
  -c:v libx264 -crf 30 -preset slow -an -movflags +faststart -pix_fmt yuv420p

Hero desktop  → 1280px wide, mobile → 720px wide.
UGC           → 720p tall, capped.

Idempotent-ish: writes to a temp file then replaces, so re-runs just re-crush.
"""

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# (path, scale filter) — scale=-2 keeps aspect ratio, even dimension.
JOBS = [
    ("public/hero/drift.mp4", "scale=1280:-2"),
    ("public/hero/drift-mobile.mp4", "scale=720:-2"),
]
# All served UGC mp4s (the _orig/ folder is deleted separately).
JOBS += [(str(p.relative_to(REPO)), "scale=-2:720")
         for p in sorted((REPO / "public" / "ugc").glob("*.mp4"))]


def crush(rel: str, vf: str) -> None:
    src = REPO / rel
    if not src.exists():
        print(f"SKIP {rel} (missing)")
        return
    before = src.stat().st_size
    tmp = src.with_suffix(".tmp.mp4")
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-c:v", "libx264", "-crf", "30", "-preset", "slow",
        "-an", "-movflags", "+faststart", "-pix_fmt", "yuv420p",
        "-vf", vf,
        str(tmp),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL {rel}: {r.stderr[-200:]}")
        tmp.unlink(missing_ok=True)
        return
    tmp.replace(src)
    after = src.stat().st_size
    pct = round((after - before) / before * 100)
    print(f"OK  {rel:<40} {before//1024:>5}KB -> {after//1024:>5}KB ({pct:+}%)")


if __name__ == "__main__":
    total_before = total_after = 0
    for rel, vf in JOBS:
        p = REPO / rel
        if p.exists():
            total_before += p.stat().st_size
        crush(rel, vf)
        if p.exists():
            total_after += p.stat().st_size
    print(f"\nVideos: {total_before//1024//1024} MB -> {total_after//1024//1024} MB")
