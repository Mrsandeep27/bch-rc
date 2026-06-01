"""
Logo improvement pipeline using Gemini.
Usage:  GEMINI_API_KEY=xxx python scripts/improve-logo.py public/logo/prc-original.png

Steps:
1. Vision-analyze the logo (composition, balance, exact hex colors, design feedback).
2. Generate clean variants via Gemini image edit (gemini-3-pro-image):
   - Transparent background (white wordmark version)
   - Inverted (black wordmark for light backgrounds)
   - Red-accent variant (red car silhouette for brand-match if needed)
3. Save all outputs to public/logo/

Requires: requests (or just urllib stdlib).
"""

import base64
import json
import os
import sys
import urllib.request

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    print("ERR: set GEMINI_API_KEY", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python scripts/improve-logo.py <path-to-logo.png>")
    sys.exit(1)

LOGO_PATH = sys.argv[1]
OUT_DIR = os.path.dirname(LOGO_PATH) or "."

if not os.path.isfile(LOGO_PATH):
    print(f"ERR: not found: {LOGO_PATH}", file=sys.stderr)
    sys.exit(1)

with open(LOGO_PATH, "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode("ascii")

mime = "image/png" if LOGO_PATH.lower().endswith(".png") else "image/jpeg"


def call_gemini(model: str, parts: list, accept_image: bool = False):
    body = {"contents": [{"parts": parts}]}
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={API_KEY}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"_error": e.code, "_body": e.read().decode("utf-8", errors="replace")}


# Step 1 — vision analysis
print("=" * 60)
print("STEP 1: Vision analysis (gemini-flash-latest)")
print("=" * 60)
vision_prompt = """Analyze this logo in detail. Provide:

1. **Composition** — what's in it, layout, balance
2. **Typography** — describe the wordmark (weight, geometry, character quirks)
3. **Iconography** — describe the car silhouette + motion lines
4. **Exact hex colors** (every distinct color you can identify, with rough % coverage)
5. **Design strengths** (what works)
6. **Design weaknesses** (what could be cleaner)
7. **3 concrete improvements** for use on a high-conversion e-commerce site
8. **Best 3 background colors** to pair this logo with (hex codes)
9. **Recommended use sizes** (e.g. min icon px, favicon viability)
10. **Whether this logo would benefit from vectorization** (yes/no + why)

Output as plain markdown sections."""

resp = call_gemini(
    "gemini-flash-latest",
    [
        {"text": vision_prompt},
        {"inline_data": {"mime_type": mime, "data": img_b64}},
    ],
)

if "_error" in resp:
    print(f"Vision call failed: {resp['_error']}\n{resp['_body'][:500]}")
else:
    try:
        analysis = resp["candidates"][0]["content"]["parts"][0]["text"]
        out_md = os.path.join(OUT_DIR, "LOGO_ANALYSIS.md")
        with open(out_md, "w", encoding="utf-8") as f:
            f.write("# PRC Cars logo — Gemini analysis\n\n")
            f.write(analysis)
        print(f"Wrote {out_md} ({len(analysis)} chars)")
    except (KeyError, IndexError):
        print("Unexpected vision response:")
        print(json.dumps(resp, indent=2)[:1500])

# Step 2 — image variant generation
print()
print("=" * 60)
print("STEP 2: Variant generation (gemini-3-pro-image-preview)")
print("=" * 60)


def save_image_from_response(resp: dict, out_path: str) -> bool:
    """Walk response, find inline image, write PNG."""
    if "_error" in resp:
        print(f"  Edit call failed: {resp['_error']}\n{resp['_body'][:300]}")
        return False
    try:
        parts = resp["candidates"][0]["content"]["parts"]
        for p in parts:
            if "inline_data" in p or "inlineData" in p:
                data = p.get("inline_data") or p.get("inlineData")
                img_bytes = base64.b64decode(data["data"])
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                print(f"  Wrote {out_path} ({len(img_bytes)} bytes)")
                return True
        print(f"  No image in response. Got text-only:")
        print(f"  {parts[0].get('text', '')[:200]}")
    except (KeyError, IndexError) as e:
        print(f"  Parse error: {e}")
    return False


variants = [
    (
        "prc-clean-transparent.png",
        "Take this logo and produce a perfectly cleaned version with: (a) crisp edges, (b) pure transparent background instead of any opaque background, (c) keep the white wordmark and white car silhouette intact, (d) remove any noise, JPEG artifacts, or background bleed. Output ONLY the logo on transparency. Square 1024x1024 canvas.",
    ),
    (
        "prc-on-light.png",
        "Take this logo and produce an inverted version for use on a LIGHT BACKGROUND: convert the white wordmark and white car silhouette to BLACK. Keep the same layout, same letterforms, same car shape and motion lines. Output the black version on a transparent background. Square 1024x1024 canvas.",
    ),
    (
        "prc-red-accent.png",
        "Take this logo and produce a variant where the car silhouette and motion lines are RED (#E11D2A) instead of white. Keep the PRC wordmark white. Keep the black circular badge. Maintain all other proportions and styling. Square 1024x1024 canvas.",
    ),
]

for fname, prompt in variants:
    print(f"\nGenerating: {fname}")
    out = os.path.join(OUT_DIR, fname)
    resp = call_gemini(
        "gemini-3-pro-image-preview",
        [
            {"text": prompt},
            {"inline_data": {"mime_type": mime, "data": img_b64}},
        ],
    )
    save_image_from_response(resp, out)

print()
print("=" * 60)
print("DONE")
print("=" * 60)
print(f"Open {OUT_DIR}/ to see analysis + 3 variants.")
