"""
3 creative hero banners for PRC 1:16 — no playbook references, pure cinematic.
Generates 16:9 hero banners via gemini-3-pro-image-preview.
"""
import os, sys, base64, json, urllib.request, urllib.error, time, concurrent.futures, pathlib

KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-3-pro-image-preview"
OUT_DIR = pathlib.Path(r"C:\Users\H\Documents\GitHub\bch-rc\public\hero-banners")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SCENES = [
    {
        "name": "1-tokyo-tunnel-drift",
        "prompt": (
            "Cinematic ultra-photorealistic hero banner: a 1:16 scale RC drift car "
            "in glossy candy apple red with black accents, captured mid-slide through "
            "an underground Tokyo highway tunnel at night. Massive plumes of white tire smoke "
            "billowing behind it, neon pink and electric blue light streaks racing past on both "
            "tunnel walls, wet glossy asphalt reflecting magenta and cyan glow. Car shot from "
            "a dramatic low rear three-quarter angle, frozen at the apex of the drift. "
            "Headlights blazing, brake lights smearing into long red streaks. "
            "Anime Initial-D meets cyberpunk aesthetic. "
            "Shot on Sony A7R V, 24mm anamorphic lens at f/1.8, ISO 800, 1/250 shutter. "
            "Cinematic color grade with deep blacks and crushed shadows, slight film grain, "
            "atmospheric haze, lens flare. Hyperdetailed metallic paint, photoreal rubber tyres, "
            "8K commercial automotive advertisement. Empty negative space in upper-left for hero text overlay. "
            "Aspect ratio 16:9 widescreen cinematic."
        )
    },
    {
        "name": "2-monsoon-mumbai-night",
        "prompt": (
            "Cinematic hero banner: a 1:16 scale RC drift car in matte black with carbon fiber "
            "hood and aggressive neon green underglow LEDs, parked on a rain-soaked Mumbai street "
            "at 2 AM. Heavy monsoon rain falling, fat raindrops bouncing off the car's roof, "
            "water beading on glossy paint. Reflections of yellow taxi signs, red Bollywood movie "
            "posters, and chai stall lights smearing across the wet tarmac. "
            "Vada-pav cart in the soft-blurred background with steam rising. "
            "Shot from a low front three-quarter angle, the car commanding the frame. "
            "Dramatic chiaroscuro lighting — one harsh streetlamp from the right casting deep shadows, "
            "neon underglow casting an eerie green halo on the wet ground beneath. "
            "Mumbai-noir atmosphere, gritty street energy, Wong-Kar-Wai cinematography. "
            "Shot on ARRI Alexa Mini LF, 35mm Master Prime at f/1.4, ISO 1600, 1/60 shutter. "
            "Hyperrealistic miniature toy car photography, ultra-sharp detail on the car, "
            "shallow depth of field on the background. "
            "8K premium commercial advertisement. 16:9 widescreen."
        )
    },
    {
        "name": "3-cosmic-void-neon",
        "prompt": (
            "Surreal cinematic hero banner: a 1:16 scale RC drift car in vibrant electric "
            "neon green with iridescent holographic chrome accents, floating weightlessly "
            "in an infinite dark cosmic void. The car is suspended at a 15-degree dynamic angle "
            "as if mid-jump, with hyper-stylized neon ribbon trails of magenta, cyan, and "
            "electric blue spiraling around it like ribbons of light. Distant galaxy nebula in "
            "deep purple and pink fills the far background. "
            "Tiny suspended dust particles glittering like stars catch the rim light. "
            "Volumetric god rays of magenta light streaming from above-left. "
            "The car's body has a wet, ultra-glossy clearcoat that reflects the neon ribbons "
            "across its surface in liquid chrome highlights. "
            "Hyper-futuristic, retro-synthwave, Daft Punk meets Cyberpunk 2077 aesthetic. "
            "Shot on Phase One IQ4 150MP, 80mm at f/4, studio render quality. "
            "Negative space on the right side for product copy. Hyperdetailed, "
            "8K commercial product hero shot, premium poster-art quality, 16:9 cinematic."
        )
    },
]

def generate(scene):
    out_path = OUT_DIR / f"{scene['name']}.png"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
    payload = {
        "contents": [{"parts": [{"text": scene["prompt"]}]}],
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
            body = e.read().decode("utf-8", errors="ignore")[:300] if hasattr(e, "read") else ""
            print(f"[{scene['name']}] attempt {attempt+1}: HTTP {e.code} {body}", flush=True)
            time.sleep(8)
        except Exception as e:
            print(f"[{scene['name']}] attempt {attempt+1} fail: {repr(e)[:150]}", flush=True)
            time.sleep(8)
    return None

if __name__ == "__main__":
    print(f"Generating {len(SCENES)} hero banners in parallel...", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        results = list(ex.map(generate, SCENES))
    saved = [r for r in results if r]
    print(f"\nDONE: {len(saved)}/{len(SCENES)} saved", flush=True)
    for r in saved:
        print(f"  - {r}", flush=True)
