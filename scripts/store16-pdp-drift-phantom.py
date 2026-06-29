"""
Premium PDP images for drift-phantom (BLACK BMW-style 1:16 RC drift car).
Uses 3 source reference photos for multi-angle product understanding.
Outputs 4 images to public/store16-images/drift-phantom/.
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
    "Do not redesign the car, do not change the colours, do not move the decals. "
    "Show as a high-fidelity 1:16 scale RC toy car of premium quality. "
)

SCENES = [
    {
        "name": "1-hero",
        "aspect": "16:9",
        "prompt": (
            BODY_LOCK +
            "PREMIUM CINEMATIC HERO SHOT for a luxury product page. "
            "Place this exact RC car at a low dramatic front-3/4 hero angle, positioned in the "
            "lower-right third of the frame, on a glossy obsidian-black floor that reflects the "
            "underside of the car. Background: a deep dark luxury showroom with rich black-to-deep "
            "purple gradient walls, subtle warm amber rim-light strips on the back wall. "
            "Lighting: dramatic warm-amber rim light from behind, cool soft key light from front-left "
            "catching the gloss on the bonnet and front bumper, faint volumetric haze in the air. "
            "Subtle reflection of the car on the polished floor. The car's red brake lights and "
            "Spengler decal pop. LEFT 55% of frame is dark gradient negative space for hero text overlay. "
            "Shot on Phase One IQ4 150MP, 50mm Schneider at f/2.8, ISO 200. "
            "Hyperrealistic premium toy product advertisement, magazine cover quality, 8K, "
            "cinematic luxury automotive grade, 16:9 widescreen."
        )
    },
    {
        "name": "2-side",
        "aspect": "1:1",
        "prompt": (
            BODY_LOCK +
            "CLEAN E-COMMERCE STUDIO SIDE PROFILE shot for an online store. "
            "Place this exact RC car in a perfect side profile (driver-side view), centered horizontally, "
            "on a seamless soft-grey to off-white gradient infinity backdrop. Floor: smooth matte light-grey. "
            "Lighting: large softbox key from camera-right, soft fill from left, subtle hair light from above "
            "to highlight the glossy bonnet and roof line. No harsh shadows, very subtle soft drop shadow under "
            "the car. The bronze wheels and BMW M tricolor stripe are perfectly visible. "
            "Mood: clean, premium, Apple-style product photography, ultra-minimal. "
            "Shot on Hasselblad H6D-100c, 100mm at f/8 for tack-sharp focus across the car, ISO 100. "
            "Hyperrealistic product e-commerce photograph, 8K, square 1:1 ratio."
        )
    },
    {
        "name": "3-detail",
        "aspect": "1:1",
        "prompt": (
            BODY_LOCK +
            "MACRO PREMIUM DETAIL SHOT focusing on the front-right corner of the car. "
            "Frame tightly on the front wheel, brake disc detail, lower front splitter, and the "
            "BMW M tricolor blue-red side decal — show the texture of the bronze multi-spoke racing wheel, "
            "the gloss of the black paint reflecting subtle blue and amber colour cast, and the crispness "
            "of the decals. Rest of the car softly blurred in bokeh. "
            "Lighting: cinematic side rim-light from the right edge, deep cool-blue shadow on the left side. "
            "Background: pitch-black gradient out of focus. "
            "Mood: ultra-premium, like a high-end watch macro ad. "
            "Shot on Canon EOS R5 with 100mm L macro at f/3.5, ISO 400. "
            "Hyperrealistic product macro photograph, 8K, square 1:1 ratio."
        )
    },
    {
        "name": "4-lifestyle",
        "aspect": "16:9",
        "prompt": (
            BODY_LOCK +
            "CINEMATIC LIFESTYLE HERO of the car parked on wet glossy night-time city asphalt in a "
            "premium urban setting (think: empty plaza outside a luxury hotel in Bangalore or Mumbai at 11 PM). "
            "Car positioned in the lower-right quadrant at a slight 3/4 angle. Background: out-of-focus "
            "warm amber sodium streetlamps, soft glowing neon signs in deep bokeh, subtle distant city tower "
            "silhouettes. Light rain mist hanging in the air, soft puddle reflections of warm amber and cool "
            "blue lights on the wet ground beneath the car. The black paint catches highlights from the streetlamps. "
            "Mood: premium, sophisticated drift culture, GQ magazine spread quality. "
            "LEFT 50% of frame is moody atmospheric bokeh negative space for hero text overlay. "
            "Shot on ARRI Alexa 35, 35mm Master Prime at f/1.8, ISO 1600. "
            "Hyperrealistic premium miniature toy lifestyle product photography, 8K cinematic colour grade, "
            "16:9 widescreen."
        )
    },
]

def encode_refs():
    parts = []
    for fname in REFS:
        path = SRC_DIR / fname
        b64 = base64.b64encode(path.read_bytes()).decode()
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64}})
    return parts

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
            body = ""
            try: body = e.read().decode("utf-8", errors="ignore")[:150]
            except: pass
            print(f"[{scene['name']}] attempt {attempt+1}: HTTP {e.code} {body}", flush=True)
            time.sleep(10)
        except Exception as e:
            print(f"[{scene['name']}] attempt {attempt+1} fail: {repr(e)[:120]}", flush=True)
            time.sleep(10)
    return None

if __name__ == "__main__":
    ref_parts = encode_refs()
    print(f"Loaded {len(ref_parts)} ref photos. Generating {len(SCENES)} PDP images in parallel...", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(lambda s: generate(s, ref_parts), SCENES))
    saved = [r for r in results if r]
    print(f"\nDONE: {len(saved)}/{len(SCENES)} saved to {OUT_DIR}", flush=True)
    for r in saved:
        print(f"  - {r}", flush=True)
