"""
scrape-instagram-ugc.py
========================
Pulls latest posts (photos + reels) from the PRC Cars Instagram accounts via
Apify's Instagram Scraper actor, downloads media to /public/ugc/, and writes
a JSON manifest the UgcGrid component reads.

Requires APIFY_TOKEN in .env.local.

Usage:
    python scripts/scrape-instagram-ugc.py
"""

import io
import json
import os
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

REPO = Path(__file__).resolve().parent.parent
UGC_DIR = REPO / "public" / "ugc"
MANIFEST_PATH = REPO / "src" / "lib" / "ugc-manifest.json"


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
TOKEN = os.environ.get("APIFY_TOKEN")
if not TOKEN:
    print("ERROR: APIFY_TOKEN missing in .env.local", file=sys.stderr)
    print("Get one at https://console.apify.com/account/integrations", file=sys.stderr)
    sys.exit(1)

ACCOUNTS = ["164prccars", "pocketrccar"]
POSTS_PER_ACCOUNT = 9  # fetch a bit more than the 6-tile grid for variety
ACTOR = "apify~instagram-scraper"  # https://apify.com/apify/instagram-scraper


def call_apify(payload: dict) -> list[dict]:
    """Run the actor synchronously and return its dataset items."""
    import urllib.request
    import urllib.error

    url = (
        f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items"
        f"?token={TOKEN}"
    )
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    print(f"  POST {ACTOR} (this may take 30-60s)...")
    try:
        with urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode('utf-8')[:500]}", file=sys.stderr)
        return []


def download(url: str, dest: Path):
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=60) as r:
        dest.write_bytes(r.read())
    print(f"    saved {dest.name} ({dest.stat().st_size // 1024} KB)")


def shorten_caption(caption: str, max_len: int = 60) -> str:
    if not caption:
        return ""
    # First line only, strip hashtags & emojis-heavy parts trailing
    first = caption.split("\n", 1)[0].strip()
    if len(first) <= max_len:
        return first
    return first[: max_len - 1].rstrip() + "…"


def likes_str(n: int) -> str:
    if n >= 1000:
        k = n / 1000
        return f"{k:.1f}K" if k % 1 else f"{int(k)}K"
    return str(n)


def main():
    UGC_DIR.mkdir(parents=True, exist_ok=True)
    all_cards: list[dict] = []

    for handle in ACCOUNTS:
        print(f"\n[{handle}] fetching {POSTS_PER_ACCOUNT} posts...")
        items = call_apify(
            {
                "directUrls": [f"https://www.instagram.com/{handle}/"],
                "resultsType": "posts",
                "resultsLimit": POSTS_PER_ACCOUNT,
                "addParentData": False,
            }
        )
        print(f"  got {len(items)} items")
        for i, item in enumerate(items):
            kind = item.get("type", "Image")  # Image / Video / Sidecar
            is_video = kind == "Video"
            # For reels: prefer the actual video stream, fall back to thumbnail.
            # Apify's `videoUrl` is the .mp4 CDN URL; `displayUrl` is the poster.
            if is_video:
                video_url = item.get("videoUrl")
                poster_url = item.get("displayUrl")
                # Download video AND save poster as a backup .jpg so the grid
                # has a fallback even if the .mp4 fetch fails.
                ext = ".mp4"
                local_name = f"{handle}-{i:02d}{ext}"
                local_path = UGC_DIR / local_name
                poster_path = UGC_DIR / f"{handle}-{i:02d}.jpg"
                try:
                    if video_url:
                        download(video_url, local_path)
                    if poster_url:
                        download(poster_url, poster_path)
                except Exception as e:
                    print(f"    SKIP {local_name}: {e}")
                    continue
                src = f"/ugc/{local_name}" if local_path.exists() and local_path.stat().st_size > 5000 else f"/ugc/{handle}-{i:02d}.jpg"
            else:
                media_url = item.get("displayUrl")
                if not media_url:
                    continue
                local_name = f"{handle}-{i:02d}.jpg"
                local_path = UGC_DIR / local_name
                try:
                    download(media_url, local_path)
                except Exception as e:
                    print(f"    SKIP {local_name}: {e}")
                    continue
                src = f"/ugc/{local_name}"

            all_cards.append(
                {
                    "src": src,
                    "handle": handle,
                    "caption": shorten_caption(item.get("caption", "")),
                    "likes": likes_str(item.get("likesCount") or 0),
                    "isVideo": is_video,
                    "url": item.get("url"),
                }
            )
        time.sleep(1)

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(all_cards, indent=2), encoding="utf-8")
    print(f"\nWrote manifest: {MANIFEST_PATH.relative_to(REPO)}")
    print(f"Cards: {len(all_cards)}")
    print(f"Media dir: {UGC_DIR.relative_to(REPO)}")


if __name__ == "__main__":
    main()
