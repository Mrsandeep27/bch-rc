"""Lighten the homepage payload — Syed flagged slow loads on 4G.

Two passes:

1. WebP source files in public/products/colors/ — re-encode at q=82 (was
   q=92 from yesterday's sharpening). The UnsharpMask edge transform
   persists through re-encoding (it's baked into the pixels), so visual
   sharpness is preserved while file weight drops ~30-40%.

2. MP4 hero videos in public/products/*.mp4 — re-encode with
   `-crf 28 -preset slow -an -movflags +faststart`. Strips audio (silent
   anyway), aggressive H.264 compression, fast-start metadata so the
   first frame paints before the rest downloads.

The Next.js Image quality 92→85 change in PDPClient.tsx and
ProductImage.tsx is the bigger user-facing win — this script reduces
the one-time source-fetch + first Image generation weight.
"""

import subprocess
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
COLORS = REPO / "public" / "products" / "colors"
PRODUCTS = REPO / "public" / "products"


def recompress_webps():
    files = sorted(COLORS.glob("*.webp"))
    total_before = total_after = 0
    for p in files:
        before = p.stat().st_size
        img = Image.open(p).convert("RGB")
        img.save(p, "WEBP", quality=82, method=6)
        after = p.stat().st_size
        total_before += before
        total_after += after
        delta_pct = round((after - before) / before * 100)
        print(f"WEBP {p.name:<46}  {before//1024:>3}KB -> {after//1024:>3}KB ({delta_pct:+}%)")
    print(f"\nWEBP totals: {total_before//1024} KB -> {total_after//1024} KB "
          f"({round((total_after-total_before)/total_before*100):+}%)\n")


def recompress_mp4s():
    files = sorted(PRODUCTS.glob("*.mp4"))
    total_before = total_after = 0
    for p in files:
        before = p.stat().st_size
        tmp = p.with_suffix(".tmp.mp4")
        cmd = [
            "ffmpeg", "-y", "-i", str(p),
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "slow",
            "-an",                       # drop audio
            "-movflags", "+faststart",   # metadata at start, plays sooner
            "-vf", "scale=-2:720",       # cap at 720p (was probably 1080p)
            str(tmp),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"FAIL {p.name}: {result.stderr[-200:]}")
            tmp.unlink(missing_ok=True)
            continue
        tmp.replace(p)
        after = p.stat().st_size
        total_before += before
        total_after += after
        delta_pct = round((after - before) / before * 100)
        print(f"MP4  {p.name:<28}  {before//1024:>4}KB -> {after//1024:>4}KB ({delta_pct:+}%)")
    if total_before:
        print(f"\nMP4 totals: {total_before//1024} KB -> {total_after//1024} KB "
              f"({round((total_after-total_before)/total_before*100):+}%)")


if __name__ == "__main__":
    print("=== WebP re-compress (q=82, no additional sharpening) ===\n")
    recompress_webps()
    print("=== MP4 re-encode (CRF 28, 720p, no audio, faststart) ===\n")
    recompress_mp4s()
