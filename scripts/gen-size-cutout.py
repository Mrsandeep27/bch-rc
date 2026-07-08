"""
Cut out the two "Shop by size" cars onto a TRANSPARENT background so each car
can burst out of the top of a clean circle (the Petronas-towers effect) in
src/components/ShopBySize.tsx.

Reuses the repo's Gemini image pipeline (gemini-3-pro-image-preview) — same
model + REST shape as scripts/one-shot-ecom.py. The car is preserved exactly
(photo-edit task); ONLY the background is removed.

Usage:
    python scripts/gen-size-cutout.py                # transparent-bg attempt
    python scripts/gen-size-cutout.py --bg magenta   # fallback: flat chroma + key

Reads GEMINI_API_KEY from the environment or, failing that, straight out of
.env.local (so the key is never echoed to a shell). Outputs:
    public/sizes/<scale>-raw.png   raw model output (kept for inspection)
    public/sizes/<scale>.png       trimmed cutout used by the component
"""
import os, sys, base64, json, urllib.request, urllib.error, time, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENV = ROOT / ".env.local"
OUT = ROOT / "public" / "sizes"
MODEL = "gemini-3-pro-image-preview"
MODE = "magenta" if "--bg" in sys.argv and "magenta" in sys.argv else "transparent"
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
REPROCESS = "--reprocess" in sys.argv  # skip Gemini, re-key the existing *-raw.png


def load_key() -> str:
    k = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if k:
        return k.strip()
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            name, _, val = line.partition("=")
            if name.strip() in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
                return val.strip().strip('"').strip("'")
    return ""


KEY = load_key()

CARS = [
    {
        "name": "1-64",
        "src": ROOT / "public" / "products" / "PRC-bmw.webp",
        "desc": (
            "a small 1:64-scale white BMW M4 GT3-style die-cast RC toy car with blue/red "
            "'SUPER RACING' and 'SPEED 77 Sport' livery, a black roof, a black rear wing and "
            "silver five-spoke wheels, at a 3/4 front-left angle"
        ),
    },
    {
        "name": "1-16",
        "src": ROOT / "public" / "store16-images" / "drift-inferno" / "1-hero.webp",
        "desc": (
            "a larger 1:16-scale red-and-black GT-R-style RC drift car with 'MDTLN' and racing "
            "sponsor decals, a tall black rear wing, a black front splitter, two roof antennae and "
            "bronze/gold multi-spoke wheels, at a 3/4 front-left angle"
        ),
    },
]


def prompt_for(desc: str) -> str:
    keep = (
        "Photo-edit task, NOT generation. Take THIS exact RC car photograph and isolate the car. "
        f"The car is {desc}. "
        "CRITICAL — DO NOT MODIFY THE CAR: keep every decal, sticker, sponsor logo, number and text "
        "EXACTLY as in the input, character-for-character. Keep the exact body shape, body kit, spoiler, "
        "wing, splitter, antennae, proportions, paint colours, livery and graphics identical. Keep the "
        "wheels (rim design, spoke count, finish, tyre size) unchanged. Keep the same car-to-camera angle "
        "and pose. The car must look like the REAL photographed product, crisp and hyperrealistic, true-to-life colour. "
        "Remove any remote/transmitter/hands/props. The car must be fully inside the frame, centred, with a "
        "small even margin all around, and no part cropped off. "
    )
    if MODE == "magenta":
        return keep + (
            "The car must FLOAT against a perfectly flat, uniform, solid pure magenta screen, RGB(255,0,255). "
            "EVERY pixel that is not the physical car body, wheels, wing, splitter or antennae must be solid pure "
            "magenta — including the area directly BENEATH and around the car. "
            "ABSOLUTELY NO floor, NO ground plane, NO glossy surface, NO mirror reflection of the car, NO drop "
            "shadow, NO gradient, NO vignette, NO checkerboard. Do not draw any reflection or shadow under the "
            "wheels. Just the car on flat solid magenta, nothing else."
        )
    return keep + (
        "Remove the entire background, floor, shadow, reflection and props completely and output the car on a "
        "FULLY TRANSPARENT background (real alpha channel) — nothing behind or beneath it. PNG with transparency."
    )


def gen(car) -> "pathlib.Path | None":
    src = car["src"]
    out_raw = OUT / f"{car['name']}-raw.png"
    b64 = base64.b64encode(src.read_bytes()).decode()
    mime = "image/webp" if src.suffix.lower() == ".webp" else "image/jpeg"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
    payload = {
        "contents": [{"parts": [
            {"text": prompt_for(car["desc"])},
            {"inline_data": {"mime_type": mime, "data": b64}},
        ]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": "1:1", "imageSize": "2K"},
        },
    }
    data = json.dumps(payload).encode()
    for attempt in range(6):
        t = time.time()
        try:
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            r = json.loads(urllib.request.urlopen(req, timeout=300).read())
            for p in r["candidates"][0]["content"]["parts"]:
                d = p.get("inlineData") or p.get("inline_data")
                if d:
                    out_raw.write_bytes(base64.b64decode(d["data"]))
                    print(f"[OK] {out_raw.name} in {round(time.time()-t)}s", flush=True)
                    return out_raw
            print(f"[NO_IMG] {car['name']}: {json.dumps(r)[:300]}", flush=True)
            return None
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="ignore")[:200]
            print(f"  attempt {attempt+1}: HTTP {e.code} {body}", flush=True)
            time.sleep(8)
        except Exception as e:
            print(f"  attempt {attempt+1} fail: {repr(e)[:140]}", flush=True)
            time.sleep(8)
    return None


def _trim_reflection(im):
    """Gemini often paints a mirror reflection of the car on a glossy floor; the
    chroma key can't remove it (it isn't magenta). But it sits BELOW the car with
    a clean transparent gap, so we keep only the top contiguous band of content
    and drop everything past the first big vertical gap in the lower half."""
    w, h = im.size
    ad = im.getchannel("A").load()
    step = max(1, w // 400)

    def filled(y):
        return sum(1 for x in range(0, w, step) if ad[x, y] > 25)

    rows = [filled(y) for y in range(h)]
    top = next((y for y in range(h) if rows[y] > 2), 0)
    GAP = max(14, h // 60)
    empty = 0
    cut = h
    for y in range(top, h):
        if rows[y] <= 1:
            empty += 1
            if empty >= GAP:
                cut = y - empty + 1
                break
        else:
            empty = 0
    # only trim when the gap is in the lower half AND real content lives below it
    if cut < h and cut > h * 0.45 and any(rows[y] > 2 for y in range(cut, h)):
        print(f"  [trim] removed reflection below y={cut} (of {h})", flush=True)
        return im.crop((0, 0, w, cut))
    return im


def postprocess(raw: pathlib.Path, name: str) -> None:
    try:
        from PIL import Image
    except ImportError:
        print(f"[WARN] Pillow missing — leaving {raw.name} unprocessed", flush=True)
        return
    im = Image.open(raw).convert("RGBA")

    if MODE == "magenta":
        if max(im.size) > 1400:
            scale = 1400 / max(im.size)
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if r > 150 and b > 150 and g < 120 and (r - g) > 55 and (b - g) > 55:
                    px[x, y] = (r, g, b, 0)              # background → clear
                elif r > g and b > g and (min(r, b) - g) > 45:
                    px[x, y] = (min(r, g + 28), g, min(b, g + 28), a)  # despill fringe
        im = _trim_reflection(im)
    else:
        lo, _ = im.getchannel("A").getextrema()
        if lo >= 10:
            print(f"[OPAQUE] {name}: model returned no transparency (alpha_min={lo}). "
                  f"Re-run with: python scripts/gen-size-cutout.py --bg magenta", flush=True)
            return

    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    final = OUT / f"{name}.png"
    im.save(final)
    print(f"[CUT] {final.relative_to(ROOT)}  size={im.size}", flush=True)


def main() -> int:
    if not KEY and not REPROCESS:
        print("ERROR: GEMINI_API_KEY not found in environment or .env.local.\n"
              "Add a line  GEMINI_API_KEY=your_key_here  to .env.local and re-run.", flush=True)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"mode={MODE}  model={MODEL}  out={OUT.relative_to(ROOT)}", flush=True)
    cars = [c for c in CARS if not ONLY or c["name"] == ONLY]
    ok = 0
    for car in cars:
        print(f"\n— {car['name']} ← {car['src'].relative_to(ROOT)}", flush=True)
        if REPROCESS:
            raw = OUT / f"{car['name']}-raw.png"
            if not raw.exists():
                print(f"  [skip] {raw.name} missing", flush=True)
                continue
        else:
            raw = gen(car)
        if raw:
            postprocess(raw, car["name"])
            ok += 1
    print(f"\nDone: {ok}/{len(cars)} generated.", flush=True)
    return 0 if ok == len(cars) else 2


if __name__ == "__main__":
    raise SystemExit(main())
