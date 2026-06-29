#!/usr/bin/env python3
"""
Scrape all product images (full-res, incl. variant images) from competitor
Shopify product pages into organized folders.

Authorized use: the operator has confirmed permission with the supplier — these
are images of the same physical 1:16 product PRC stocks.

Shopify exposes <product-url>.json with the complete media list at original
resolution (no _NxN size suffix), so we pull from there instead of scraping
<img> tags. Falls back to regex over the HTML for non-Shopify pages.

Usage:
    python scripts/scrape-competitor-images.py
"""

import json
import os
import re
import sys
import time
import urllib.parse

import requests

DEST = r"C:\Users\H\Downloads\prc-new-stores\competitor-images"

# (folder-label, product-url) — 1:16 competitor products ONLY
PRODUCTS = [
    ("toykoo-1-16",
     "https://toykoo.in/products/high-speed-drift-remote-control-car-25-km-h-4x4-led-light-2-4g-1-16"),
    ("highgeartoys-1-16",
     "https://highgeartoys.com/products/hgt-rs-pro-drift-rc-car-1-16-copy"),
    ("snooplay-1-16",
     "https://snooplay.in/products/remote-control-4x4-drift-racing-car-with-4-spare-wheels-2-4ghz-frequency-light-sound-1-16-scale-5-12-years-assorted-colors-1"),
    ("daddydrones-1-16",
     "https://www.daddydrones.in/s925-116-scale-4wd-rc-drift-car-%E2%80%93-gtr-racing-model-24g-remote-control-car"),
    ("shopbefikar-1-16",
     "https://shopbefikar.com/product/high-speed-drift-remote-control-car-30-km-h-led-lights-full-proportional-control-2-4g-116/"),
]

# URLs containing any of these are junk (logos, icons, UI chrome) — never product photos
JUNK = re.compile(
    r"(logo|favicon|/icons?/|[-_]icon|cropped|brand|sprite|placeholder|loader|"
    r"spinner|/flags?/|wp-includes|emoji|avatar|/badge|payment|trustbadge|"
    r"thumb|swatch|/menu|banner-|/theme/|gif$)",
    re.I,
)
MIN_BYTES = 25 * 1024  # drop anything smaller than 25KB (icons/thumbnails)

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
}


def clean_url(u: str) -> str:
    """Strip query/fragment so we can append .json cleanly."""
    p = urllib.parse.urlparse(u)
    return urllib.parse.urlunparse((p.scheme, p.netloc, p.path, "", "", ""))


def upgrade_res(src: str) -> str:
    """Drop size suffix (Shopify _700x700 OR WooCommerce -700x700) to get the original."""
    src = src.split("?")[0]
    if src.startswith("//"):
        src = "https:" + src
    # both underscore (Shopify) and hyphen (WooCommerce) size suffixes
    src = re.sub(r"[-_]\d+x\d+(?=\.\w+$)", "", src)
    src = re.sub(r"_(pico|icon|thumb|small|compact|medium|large|grande|original)(?=\.\w+$)", "", src)
    return src


def shopify_images(base: str) -> list[str]:
    """Return full-res image URLs from a Shopify product .json, or [] if not Shopify."""
    try:
        r = requests.get(base + ".json", headers=HEADERS, timeout=20)
        if r.status_code != 200 or "application/json" not in r.headers.get("content-type", ""):
            return []
        data = r.json().get("product", {})
    except Exception:
        return []
    urls = []
    for img in data.get("images", []):
        src = img.get("src")
        if src:
            urls.append(upgrade_res(src))
    # variant featured images sometimes differ
    for v in data.get("variants", []):
        fi = v.get("featured_image") or {}
        if fi.get("src"):
            urls.append(upgrade_res(fi["src"]))
    # de-dup + drop junk, preserve order
    seen, out = set(), []
    for u in urls:
        if u not in seen and not JUNK.search(u):
            seen.add(u)
            out.append(u)
    return out


def html_images(base: str) -> list[str]:
    """Pull product image URLs out of raw HTML (WooCommerce / generic).

    Prefers the actual product gallery so cross-sell / related-product images
    don't leak in. Order of preference:
      1. WooCommerce gallery (data-large_image="...")
      2. og:image meta (main product image)
      3. broad uploads/cdn scan (last resort)
    """
    try:
        r = requests.get(base, headers=HEADERS, timeout=20)
        html = r.text
    except Exception:
        return []

    gallery = re.findall(r'data-large_image="([^"]+)"', html)
    og = re.findall(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I)
    og += re.findall(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image', html, re.I)

    raw = gallery + og
    if not raw:  # last resort: whole-page scan
        raw = [u for u in re.findall(r'https?://[^\s"\'<>]+?\.(?:jpg|jpeg|png|webp)', html, re.I)
               if re.search(r"(uploads|cdn|/shop/|/files/|product)", u, re.I)]

    seen, out = set(), []
    for u in raw:
        if u.startswith("//"):
            u = "https:" + u
        if JUNK.search(u):
            continue
        u = upgrade_res(u)
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def download(urls: list[str], folder: str) -> tuple[int, int]:
    os.makedirs(folder, exist_ok=True)
    ok = fail = 0
    for i, u in enumerate(urls, 1):
        ext = os.path.splitext(urllib.parse.urlparse(u).path)[1] or ".jpg"
        out = os.path.join(folder, f"{i:02d}{ext}")
        if os.path.exists(out) and os.path.getsize(out) > 0:
            ok += 1
            continue
        try:
            r = requests.get(u, headers=HEADERS, timeout=30)
            if r.status_code == 200 and len(r.content) >= MIN_BYTES:
                with open(out, "wb") as f:
                    f.write(r.content)
                ok += 1
                print(f"    {i:02d}  {len(r.content)//1024:>5} KB  {u}")
            elif r.status_code == 200:
                print(f"    --  skip tiny ({len(r.content)//1024}KB)  {u}")
            else:
                fail += 1
                print(f"    {i:02d}  FAIL {r.status_code}  {u}")
        except Exception as e:  # noqa: BLE001
            fail += 1
            print(f"    {i:02d}  ERR {e}  {u}")
        time.sleep(0.3)
    return ok, fail


def main() -> int:
    os.makedirs(DEST, exist_ok=True)
    for label, url in PRODUCTS:
        base = clean_url(url)
        print(f"\n=== {label}\n    {base}")
        urls = shopify_images(base)
        source = "shopify.json"
        if not urls:
            urls = html_images(base)
            source = "html-fallback"
        print(f"    via {source}: {len(urls)} images")
        if not urls:
            print("    !! no images found")
            continue
        folder = os.path.join(DEST, label)
        ok, fail = download(urls, folder)
        print(f"    -> {ok} saved, {fail} failed  ({folder})")
    print(f"\nDone. Root: {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
