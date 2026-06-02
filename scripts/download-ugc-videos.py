"""
download-ugc-videos.py
=======================
Reads the existing ugc-manifest.json (which has Instagram post URLs from the
Apify scrape) and downloads the actual reel videos via yt-dlp. Re-encodes to
a web-friendly H.264 MP4 if ffmpeg is available; otherwise saves the raw
download. Updates the manifest src fields to point at the new .mp4 files.

Usage:
    python scripts/download-ugc-videos.py
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

import yt_dlp  # type: ignore

REPO = Path(__file__).resolve().parent.parent
UGC_DIR = REPO / "public" / "ugc"
MANIFEST_PATH = REPO / "src" / "lib" / "ugc-manifest.json"

UGC_DIR.mkdir(parents=True, exist_ok=True)
manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

FFMPEG = shutil.which("ffmpeg")
print(f"ffmpeg: {FFMPEG or 'NOT FOUND — videos saved as raw download'}")


def download_one(url: str, out_stem: Path) -> Path | None:
    """Use yt-dlp to fetch the reel; return raw download path or None.

    Downloads to <stem>.raw.<ext> to avoid colliding with the final <stem>.mp4
    that ffmpeg will write to.
    """
    raw_template = str(out_stem) + ".raw.%(ext)s"
    opts = {
        "outtmpl": raw_template,
        "format": "best[ext=mp4]/best",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "merge_output_format": "mp4",
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
    except Exception as e:
        print(f"    ERROR: {e}")
        return None
    for ext in (".mp4", ".webm", ".mkv", ".mov"):
        candidate = Path(str(out_stem) + ".raw" + ext)
        if candidate.exists() and candidate.stat().st_size > 50_000:
            return candidate
    return None


def reencode(raw: Path, dest: Path) -> bool:
    """Run ffmpeg to web-optimize. If raw is already a small-enough mp4
    (Instagram reels usually are <2MB H.264), skip ffmpeg and just move."""
    raw_kb = raw.stat().st_size // 1024
    if raw.suffix.lower() == ".mp4" and raw_kb < 2500:
        # Already small + mp4 — just rename, no re-encode needed
        shutil.move(str(raw), str(dest))
        return True
    if not FFMPEG:
        if raw.suffix.lower() == ".mp4":
            shutil.move(str(raw), str(dest))
            return True
        return False
    cmd = [
        FFMPEG,
        "-y",
        "-i",
        str(raw),
        "-vf",
        "scale='if(gt(iw,720),720,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "24",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        str(dest),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        if raw != dest and raw.exists():
            raw.unlink()
        return True
    except subprocess.CalledProcessError as e:
        print(f"    ffmpeg failed: {e.stderr.decode('utf-8', errors='ignore')[:200]}")
        return False


updated: list[dict] = []
for i, card in enumerate(manifest):
    url = card.get("url")
    if not url:
        updated.append(card)
        continue
    poster_jpg = REPO / ("public" + card["src"])  # current /ugc/<handle>-NN.jpg
    stem = poster_jpg.with_suffix("")  # /ugc/<handle>-NN
    print(f"[{i + 1}/{len(manifest)}] {url}")
    raw = download_one(url, stem)
    if not raw:
        print(f"    skipped — keeping poster")
        updated.append(card)
        continue
    final = stem.with_suffix(".mp4")
    ok = reencode(raw, final)
    if not ok:
        print(f"    re-encode failed — keeping poster")
        if final.exists():
            final.unlink()
        updated.append(card)
        continue
    size_kb = final.stat().st_size // 1024
    print(f"    OK {final.name} ({size_kb} KB)")
    new_card = {**card, "src": f"/ugc/{final.name}", "poster": card["src"]}
    updated.append(new_card)

MANIFEST_PATH.write_text(json.dumps(updated, indent=2), encoding="utf-8")
print(f"\nManifest updated: {sum(1 for c in updated if c['src'].endswith('.mp4'))}/{len(updated)} videos")
