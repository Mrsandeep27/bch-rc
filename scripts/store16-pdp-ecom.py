"""
E-commerce conversion for drift-phantom — applies the user-supplied prompt
to 4 source photos. Overwrites the 4 PDP slots.
"""
import os, sys, base64, json, urllib.request, urllib.error, time, concurrent.futures, pathlib

KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-3-pro-image-preview"

SRC_DIR = pathlib.Path(r"C:\Users\H\Downloads\prc-new-stores\1-16\RC Big Black Car\RC Big Black Car")
OUT_DIR = pathlib.Path(r"C:\Users\H\Documents\GitHub\bch-rc\public\store16-images\drift-phantom")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 4 different source angles -> 4 different output variants of the same e-com style.
JOBS = [
    {"out": "1-hero.png",      "refs": ["IMG_5164.JPG", "IMG_5153.JPG"]},
    {"out": "2-side.png",      "refs": ["IMG_5156.JPG", "IMG_5157.JPG"]},
    {"out": "3-detail.png",    "refs": ["IMG_5158.JPG", "IMG_5165.JPG"]},
    {"out": "4-lifestyle.png", "refs": ["IMG_5167.JPG", "IMG_5168.JPG"]},
]

PROMPT = (
    "High-end e-commerce product photograph of THIS exact RC drift car. "
    "PRESERVE THE EXACT BODY COLOUR, livery, decals, wheels and proportions from the input image — "
    "do not change the paint, graphics, or shape, and add no text or logos. "
    "Studio shot on a seamless soft light-grey gradient background "
    "(brighter behind the car, gently darker toward the edges). "
    "Car sitting level on a subtly reflective surface with a soft realistic contact shadow "
    "and a faint mirror reflection beneath it. "
    "Bright, clean, even softbox lighting with one crisp highlight running along the roofline; "
    "true-to-life colour, sharp focus across the entire car, crisp detail on the wheels and bodywork. "
    "Low 3/4 front hero angle. "
    "Must look like a REAL photographed product, not a CGI render. "
    "Ultra-detailed, 4K, commercial product photography. "
    "No people, no remote control or transmitter, no background props."
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
    print(f"Generating {len(JOBS)} e-com variants for drift-phantom...", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(run_job, JOBS))
    saved = [r for r in results if r]
    print(f"\nDONE: {len(saved)}/{len(JOBS)} saved", flush=True)
    for r in saved:
        print(f"  - {r}", flush=True)
