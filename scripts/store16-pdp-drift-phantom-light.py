"""
LIGHT PREMIUM regen for drift-phantom — 3 images (1-hero, 2-side, 4-lifestyle).
#3 detail is preserved (user approved). All scenes are bright, airy, premium.
"""
import os, sys, base64, json, urllib.request, urllib.error, time, concurrent.futures, pathlib

KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-3-pro-image-preview"

SRC_DIR = pathlib.Path(r"C:\Users\H\Downloads\prc-new-stores\1-16\RC Big Black Car\RC Big Black Car")
REFS = ["IMG_5153.JPG", "IMG_5156.JPG", "IMG_5164.JPG"]

OUT_DIR = pathlib.Path(r"C:\Users\H\Documents\GitHub\bch-rc\public\store16-images\drift-phantom")
OUT_DIR.mkdir(parents=True, exist_ok=True)

BODY_LOCK = (
    "PRESERVE THE EXACT 1:16 RC car shown in the reference photos: glossy piano-black "
    "BMW-style M4 GT3 race body, BMV Bank, Spengler, Bosch and Whale racing decals, "
    "blue-and-red BMW M tricolor stripes, large rear wing, bronze/copper-finish multi-spoke "
    "racing wheels with grey tyres, low-slung race car silhouette, small antennae on the roof. "
    "Keep the exact paint, decals, wheels and proportions identical to the reference photos. "
    "Do not redesign the car. Show as a premium 1:16 scale RC toy car. "
)

SCENES = [
    {
        "name": "1-hero",
        "aspect": "16:9",
        "prompt": (
            BODY_LOCK +
            "LIGHT PREMIUM HERO SHOT for a luxury product page — Apple-keynote aesthetic. "
            "Place this exact RC car at a low dramatic front-3/4 hero angle, positioned in the "
            "lower-right third of the frame, on a polished bright cream-white marble floor that "
            "softly reflects the underside of the car. Background: a clean bright luxury showroom "
            "with smooth pale ivory walls and a soft warm peach-to-white gradient backdrop, faint "
            "soft beams of warm morning daylight streaming in from the upper right. "
            "Lighting: large overhead diffused softbox key creating a clean bright glow across the "
            "scene, soft warm rim light from the right, gentle pastel fill from the left — no harsh "
            "shadows. Tiny suspended dust particles catching the warm light. Subtle clean reflection "
            "of the car on the polished marble. The glossy black paint catches highlights cleanly, "
            "the bronze wheels glow warm. "
            "LEFT 55% of frame is the soft warm ivory-peach gradient — clean bright negative space "
            "for hero text overlay. "
            "Shot on Phase One IQ4 150MP, 50mm Schneider at f/2.8, ISO 100. "
            "Hyperrealistic premium toy product advertisement, magazine cover quality, ultra-light "
            "airy luxury automotive aesthetic, 8K, 16:9 widescreen."
        )
    },
    {
        "name": "2-side",
        "aspect": "1:1",
        "prompt": (
            BODY_LOCK +
            "BRIGHT PREMIUM STUDIO SIDE PROFILE for an online luxury product page. "
            "Place this exact RC car in a perfect side profile (driver-side view), centered "
            "horizontally, on a seamless soft pearl-white to warm cream gradient infinity backdrop. "
            "Floor: smooth glossy white acrylic with a subtle soft reflection of the car. "
            "Lighting: large soft octabox key from camera-right at slight downward angle, "
            "bounce fill from the left, gentle hair light from above to catch the gloss on the "
            "bonnet and roof, warm soft golden rim along the upper edge of the car. No harsh "
            "shadows, soft elegant under-car shadow. The bronze wheels, BMW M tricolor stripe, "
            "and decals are crisp and luminous. "
            "Mood: airy, bright, premium, clean — like a luxury watch product shot. "
            "Shot on Hasselblad H6D-100c, 100mm at f/8 for tack-sharp focus across the car, ISO 100. "
            "Hyperrealistic premium e-commerce product photograph, 8K, square 1:1 ratio."
        )
    },
    {
        "name": "4-lifestyle",
        "aspect": "16:9",
        "prompt": (
            BODY_LOCK +
            "PREMIUM LIGHT LIFESTYLE shot of the car as a prized collector's display piece in a "
            "modern luxury Bangalore loft apartment at warm morning golden hour. "
            "Place the car at a slight 3/4 angle on a polished light-oak wood console table beside "
            "a tall floor-to-ceiling window, positioned in the lower-right quadrant. "
            "Background: soft-focus bright airy living-room with cream linen sofa, a tasteful "
            "abstract framed art print, a small monstera plant in a terracotta pot, and warm "
            "morning sunlight streaming through sheer linen curtains from the upper-right. "
            "City skyline silhouette through the window in soft bokeh. "
            "Lighting: warm soft golden-hour daylight from the right, gentle bounce fill from the "
            "left, soft dust motes floating in the light. The black paint catches the warm light "
            "elegantly, the bronze wheels glow. Bright, airy, optimistic, sophisticated mood — "
            "Architectural Digest magazine spread quality. "
            "LEFT 50% of frame is the soft-focus airy living-room with negative space for hero text. "
            "Shot on Sony A7R V, 35mm Zeiss Otus at f/2.0, ISO 200. "
            "Hyperrealistic premium miniature toy lifestyle product photography, 8K bright airy "
            "warm colour grade, 16:9 widescreen."
        )
    },
]

def encode_refs():
    return [
        {"inline_data": {"mime_type": "image/jpeg",
                         "data": base64.b64encode((SRC_DIR / f).read_bytes()).decode()}}
        for f in REFS
    ]

def generate(scene, ref_parts):
    out_path = OUT_DIR / f"{scene['name']}.png"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
    payload = {
        "contents": [{"parts": [{"text": scene["prompt"]}, *ref_parts]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": scene["aspect"], "imageSize": "2K"}
        }
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
                    out_path.write_bytes(base64.b64decode(d["data"]))
                    print(f"[OK] {scene['name']} ({scene['aspect']}) -> {out_path.name} in {round(time.time()-t)}s", flush=True)
                    return str(out_path)
            print(f"[NO_IMG] {scene['name']}: {json.dumps(r)[:200]}", flush=True)
            return None
        except urllib.error.HTTPError as e:
            print(f"[{scene['name']}] attempt {attempt+1}: HTTP {e.code}", flush=True)
            time.sleep(10)
        except Exception as e:
            print(f"[{scene['name']}] attempt {attempt+1} fail: {repr(e)[:120]}", flush=True)
            time.sleep(10)
    return None

if __name__ == "__main__":
    ref_parts = encode_refs()
    print(f"Regen 3 LIGHT premium scenes for drift-phantom (keeping #3 detail)...", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        results = list(ex.map(lambda s: generate(s, ref_parts), SCENES))
    saved = [r for r in results if r]
    print(f"\nDONE: {len(saved)}/{len(SCENES)} saved", flush=True)
    for r in saved:
        print(f"  - {r}", flush=True)
