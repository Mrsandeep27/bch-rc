"""
Scrape product SPECS / DESCRIPTIONS (not images) from the same competitor
Shopify products we pulled imagery from. Shopify exposes <product-url>.json with
title, body_html (description), tags, options and variants — everything we need
to write accurate copy + a spec table for the 1:16 PDP.

Output: scripts/out/competitor-specs.json  (+ a readable .txt digest)
"""

import json
import os
import re
import html
import urllib.request

LINKS = [
    ("toykoo-drift", "https://toykoo.in/products/high-speed-drift-remote-control-car-25-km-h-4x4-led-light-2-4g-1-16"),
    ("highgear-drift", "https://highgeartoys.com/products/hgt-rs-pro-drift-rc-car-1-16-copy"),
    ("snooplay-drift", "https://snooplay.in/products/remote-control-4x4-drift-racing-car-with-4-spare-wheels-2-4ghz-frequency-light-sound-1-16-scale-5-12-years-assorted-colors-1"),
    ("shopbefikar-drift", "https://shopbefikar.com/product/high-speed-drift-remote-control-car-30-km-h-led-lights-full-proportional-control-2-4g-116/"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT_DIR, exist_ok=True)


def strip_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s, flags=re.S | re.I)
    s = re.sub(r"<li[^>]*>", "\n• ", s, flags=re.I)
    s = re.sub(r"<(br|/p|/div|/h\d|/tr)[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def base(url: str) -> str:
    return url.split("?")[0].split("#")[0].rstrip("/")


def fetch_json(url: str):
    req = urllib.request.Request(base(url) + ".json", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as r:
        if "application/json" not in r.headers.get("content-type", ""):
            return None
        return json.load(r).get("product", {})


results = {}
digest = []
for name, url in LINKS:
    try:
        p = fetch_json(url)
        if not p:
            print(f"[skip] {name}: not Shopify json")
            continue
        opts = {o.get("name"): o.get("values") for o in p.get("options", [])}
        prices = sorted({v.get("price") for v in p.get("variants", []) if v.get("price")})
        rec = {
            "title": p.get("title"),
            "vendor": p.get("vendor"),
            "type": p.get("product_type"),
            "tags": p.get("tags"),
            "options": opts,
            "prices": prices,
            "description": strip_html(p.get("body_html", "")),
        }
        results[name] = rec
        digest.append(
            f"### {name} — {url}\n"
            f"TITLE: {rec['title']}\n"
            f"TYPE: {rec['type']}  VENDOR: {rec['vendor']}\n"
            f"PRICES: {rec['prices']}\n"
            f"OPTIONS: {json.dumps(opts, ensure_ascii=False)}\n"
            f"TAGS: {rec['tags']}\n"
            f"DESCRIPTION:\n{rec['description']}\n"
        )
        print(f"[ok] {name}: {rec['title']}")
    except Exception as e:
        print(f"[err] {name}: {e}")

with open(os.path.join(OUT_DIR, "competitor-specs.json"), "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
with open(os.path.join(OUT_DIR, "competitor-specs.txt"), "w", encoding="utf-8") as f:
    f.write("\n\n".join(digest))

print(f"\nSaved {len(results)} products → scripts/out/competitor-specs.json / .txt")
