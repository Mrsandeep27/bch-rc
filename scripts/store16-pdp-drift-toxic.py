"""
Premium e-commerce PDP images for drift-toxic (NEON GREEN) via Gemini 3 Pro Image.
Preserves exact car decals (unlike ChatGPT which hallucinates new ones).
"""
import os, sys, base64, json, urllib.request, urllib.error, time, concurrent.futures, pathlib

KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-3-pro-image-preview"

SRC_DIR = pathlib.Path(r"C:\Users\H\Downloads\prc-new-stores\1-16\RC Drift Green Car\RC Drift Green Car")
OUT_DIR = pathlib.Path(r"C:\Users\H\Documents\GitHub\bch-rc\public\store16-images\drift-toxic")
OUT_DIR.mkdir(parents=True, exist_ok=True)

JOBS = [
    {"out": "1-hero.png",      "refs": ["IMG_5184.JPG", "IMG_5185.JPG"]},
    {"out": "2-side.png",      "refs": ["IMG_5186.JPG", "IMG_5187.JPG"]},
    {"out": "3-detail.png",    "refs": ["IMG_5188.JPG", "IMG_5189.JPG"]},
    {"out": "4-lifestyle.png", "refs": ["IMG_5190.JPG", "IMG_5191.JPG"]},
]

PROMPT = (
    "RELIGHT and RECOMPOSE THIS exact RC car photograph — do not generate a new car. "
    "CRITICAL — DO NOT MODIFY THE CAR: "
    "Keep every single decal, sticker, sponsor logo, number, and text on the car EXACTLY as shown "
    "in the input image, character-for-character. Do not invent new decals. Do not add or remove "
    "any sponsor logos. Keep the exact body shape, body kit, spoiler, splitter, wing, antennae, and "
    "proportions identical to the input. Keep the exact neon-green paint colour, livery pattern, "
    "and graphic edges identical. Keep the wheels: exact rim design, spoke count, finish colour, "
    "tyre size — unchanged. Keep the same car-to-camera angle and pose. "
    "ONLY CHANGE THESE THINGS: "
    "Background → seamless soft light-grey gradient (brighter directly behind the car, gently darker "
    "toward the edges). Floor → subtly reflective light surface with a soft realistic contact shadow "
    "and a faint mirror reflection beneath the car. Lighting → bright, clean, even softbox lighting "
    "with one crisp highlight along the roofline. True-to-life colour temperature. "
    "REMOVE → any remote control / transmitter / hands / background props / clutter visible in the input. "
    "OUTPUT STYLE: hyperrealistic studio e-commerce product photograph that looks like it was shot on "
    "a Hasselblad with a 100mm lens at f/8, 4K, ultra-detailed. Must look like a REAL photographed "
    "product, NOT a CGI render and NOT a redesigned car. Low 3/4 hero angle. "
    "Treat this as a photo-edit task, not a generation task. The car in the output must be visually "
    "identical to the car in the input — only the studio environment around it changes."
)

def encode(fname):
    return {"inline_data": {"mime_type": "image/jpeg",
                            "data": base64.b64encode((SRC_DIR / fname).read_bytes()).decode()}}

def run_job(job):
    out_path = OUT_DIR / job["out"]
    ref_parts = [encode(f) for f in job["refs"]]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
    payload = {
        "contents": [{"parts": [{"text": PROMPT}, *ref_parts]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": "1:1", "imageSize": "2K"}
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
                    print(f"[OK] {job['out']} <- {job['refs']} in {round(time.time()-t)}s", flush=True)
                    return str(out_path)
            print(f"[NO_IMG] {job['out']}: {json.dumps(r)[:200]}", flush=True)
            return None
        except urllib.error.HTTPError as e:
            print(f"[{job['out']}] attempt {attempt+1}: HTTP {e.code}", flush=True)
            time.sleep(10)
        except Exception as e:
            print(f"[{job['out']}] attempt {attempt+1} fail: {repr(e)[:120]}", flush=True)
            time.sleep(10)
    return None

if __name__ == "__main__":
    print(f"Generating {len(JOBS)} e-com images for drift-toxic (NEON GREEN)...", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(run_job, JOBS))
    saved = [r for r in results if r]
    print(f"\nDONE: {len(saved)}/{len(JOBS)} saved to {OUT_DIR}", flush=True)
    for r in saved:
        print(f"  - {r}", flush=True)
