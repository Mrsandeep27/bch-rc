"""
3 cinematic hero banners using REAL DARES product photo as image-to-image reference.
Negative space on LEFT for hero text overlay. 16:9 widescreen.
"""
import os, sys, base64, json, urllib.request, urllib.error, time, concurrent.futures, pathlib

KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-3-pro-image-preview"
REF_PHOTO = pathlib.Path(r"C:\Users\H\Downloads\ChatGPT Image Jun 25, 2026, 03_01_40 AM.png")
OUT_DIR = pathlib.Path(r"C:\Users\H\Documents\GitHub\bch-rc\public\hero-banners")
OUT_DIR.mkdir(parents=True, exist_ok=True)

BODY_LOCK = (
    "PRESERVE THE EXACT 1:16 RC CAR shown in the reference photo without altering it: "
    "white body with blue front quarters and roof, bold red and blue 'DARES' racing-livery "
    "decals along the side, vapor/V14 stickers, black mesh grille, black wheels with grey "
    "tyres, low-profile race-car silhouette, small antennae sticking up. KEEP the exact "
    "livery, decals, paint scheme, proportions, and toy-scale 1:16 size. "
    "Do not change colours. Do not redesign the car. "
)

SCENES = [
    {
        "name": "dares-v2-1-pastel-studio",
        "prompt": (
            BODY_LOCK +
            "Place this exact RC car parked at a soft 3/4 angle on a seamless pastel pink and "
            "powder blue gradient infinity backdrop, positioned in the lower-right third of the frame. "
            "Bright airy professional product studio lighting — soft diffused beauty-dish key from "
            "front-left, gentle fill, and a soft pastel rim-light. Clean glossy white floor surface "
            "with a delicate soft reflection of the car beneath it. The mood is light, bright, "
            "cheerful, fresh — premium consumer-product magazine aesthetic. Tiny soft drifting "
            "pastel light particles. "
            "LEFT 55% of the frame is clean pastel pink-blue gradient — pure clean negative space "
            "for hero text overlay. "
            "Shot on Phase One IQ4 150MP, 100mm macro at f/4. Hyperrealistic miniature toy product "
            "photography, no harsh shadows, ultra-clean modern e-commerce ad style, 8K, "
            "16:9 widescreen."
        )
    },
    {
        "name": "dares-v2-2-rooftop-sunset",
        "prompt": (
            BODY_LOCK +
            "Place this exact RC car parked at a slight 3/4 angle on a smooth light concrete "
            "rooftop in Bangalore at warm golden-hour sunset, positioned in the lower-right quadrant. "
            "Background: a hazy soft peach, pink and pale-gold Indian skyline with silhouetted "
            "apartment towers and palm trees, gentle sun flare from the upper right. "
            "Warm golden light bathing the entire scene, glossy paint and red/blue decals glowing in the light, "
            "long soft shadow falling to the left. Bright, airy, optimistic mood — no dark zones. "
            "Tiny dust motes floating in the sunlight. "
            "LEFT 55% of the frame is calm warm peach-pink gradient sky — clean negative space for "
            "hero text overlay. "
            "Shot on Sony A7R V, 35mm Zeiss Otus at f/1.8. Premium cinematic lifestyle product "
            "advertisement, hyperrealistic toy photography, 8K, warm bright golden-hour colour grade, "
            "16:9 widescreen."
        )
    },
    {
        "name": "dares-v2-3-beach-morning",
        "prompt": (
            BODY_LOCK +
            "Place this exact RC car parked at a slight 3/4 angle on smooth bright wet sand at "
            "a sunny tropical Goa beach in the late morning, positioned in the lower-right quadrant. "
            "Background: a soft turquoise calm sea melting into a pale baby-blue sky with fluffy "
            "white clouds, a single distant palm tree silhouette on the far right, gentle ocean "
            "waves blurred in the bokeh. Bright clean sunlight from upper-left catching the glossy "
            "paint and DARES racing decals, casting a clean soft shadow on the wet sand. "
            "Tiny water droplets and reflective wet-sand shimmer beneath the car. "
            "Mood is fresh, vibrant, light, summery — sky-blue and white dominate the palette. "
            "LEFT 55% of the frame is clean baby-blue sky and turquoise sea — pure negative space "
            "for hero text overlay. "
            "Shot on Sony A7R V, 50mm Zeiss at f/2.2. Hyperrealistic miniature toy product "
            "lifestyle photography, ultra-bright airy commercial coastal advertisement, 8K, "
            "16:9 widescreen."
        )
    },
]

def encode_ref():
    return base64.b64encode(REF_PHOTO.read_bytes()).decode()

REF_MIME = "image/png"

def generate(scene, ref_b64):
    out_path = OUT_DIR / f"{scene['name']}.png"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
    payload = {
        "contents": [{"parts": [
            {"text": scene["prompt"]},
            {"inline_data": {"mime_type": REF_MIME, "data": ref_b64}}
        ]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}
        }
    }
    data = json.dumps(payload).encode()
    for attempt in range(5):
        t = time.time()
        try:
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            r = json.loads(urllib.request.urlopen(req, timeout=300).read())
            for p in r["candidates"][0]["content"]["parts"]:
                d = p.get("inlineData") or p.get("inline_data")
                if d:
                    out_path.write_bytes(base64.b64decode(d["data"]))
                    print(f"[OK] {scene['name']} -> {out_path} in {round(time.time()-t)}s", flush=True)
                    return str(out_path)
            print(f"[NO_IMG] {scene['name']}: {json.dumps(r)[:200]}", flush=True)
            return None
        except urllib.error.HTTPError as e:
            body = ""
            try: body = e.read().decode("utf-8", errors="ignore")[:200]
            except: pass
            print(f"[{scene['name']}] attempt {attempt+1}: HTTP {e.code} {body}", flush=True)
            time.sleep(8)
        except Exception as e:
            print(f"[{scene['name']}] attempt {attempt+1} fail: {repr(e)[:150]}", flush=True)
            time.sleep(8)
    return None

if __name__ == "__main__":
    ref_b64 = encode_ref()
    print(f"Loaded ref photo ({len(ref_b64)} chars). Generating {len(SCENES)} banners...", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        results = list(ex.map(lambda s: generate(s, ref_b64), SCENES))
    saved = [r for r in results if r]
    print(f"\nDONE: {len(saved)}/{len(SCENES)} saved", flush=True)
    for r in saved:
        print(f"  - {r}", flush=True)
