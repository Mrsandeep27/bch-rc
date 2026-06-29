"""
One-shot e-com white-bg image generator.
Edit the 4 vars below, run, done.
"""
import os, sys, base64, json, urllib.request, urllib.error, time, pathlib

KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-3-pro-image-preview"

# ---- EDIT THESE 4 LINES PER REQUEST ----
SRC_FOLDER = r"C:\Users\H\Downloads\prc-new-stores\1-16\RC Drift Green Car\RC Drift Green Car"
SRC_FILE   = "IMG_5188.JPG"
OUT_MODEL  = "drift-toxic"
OUT_SLOT   = "3-detail"
# ----------------------------------------

OUT_DIR = pathlib.Path(rf"C:\Users\H\Documents\GitHub\bch-rc\public\store16-images\{OUT_MODEL}")
OUT_DIR.mkdir(parents=True, exist_ok=True)
out_path = OUT_DIR / f"{OUT_SLOT}.png"
src_path = pathlib.Path(SRC_FOLDER) / SRC_FILE

PROMPT = (
    "RELIGHT and RECOMPOSE THIS exact RC car photograph — do not generate a new car. "
    "CRITICAL — DO NOT MODIFY THE CAR: "
    "Keep every single decal, sticker, sponsor logo, number, and text on the car EXACTLY as shown "
    "in the input image, character-for-character. Do not invent new decals. Do not add or remove "
    "any sponsor logos. Keep the exact body shape, body kit, spoiler, splitter, wing, antennae, and "
    "proportions identical to the input. Keep the exact paint colours, livery pattern, and graphic "
    "edges identical. Keep the wheels: exact rim design, spoke count, finish colour, tyre size — unchanged. "
    "Keep the same car-to-camera angle and pose. "
    "ONLY CHANGE THESE THINGS: "
    "Background → seamless pure WHITE studio backdrop, brighter directly behind the car, gently softer "
    "toward the edges. Floor → clean white glossy surface with a soft realistic contact shadow and a "
    "very subtle mirror reflection beneath the car. "
    "Lighting → bright, clean, even softbox studio lighting with one crisp highlight along the roofline. "
    "True-to-life colour temperature, no colour cast on the body. "
    "REMOVE → any remote control / transmitter / hands / background props / clutter visible in the input. "
    "OUTPUT STYLE: hyperrealistic studio e-commerce product photograph on pure white background, "
    "shot on a Hasselblad with a 100mm lens at f/8, 4K, ultra-detailed. Must look like a REAL "
    "photographed product, NOT a CGI render and NOT a redesigned car. "
    "Treat this as a photo-edit task, not a generation task. The car must be visually identical to the input."
)

def run():
    b64 = base64.b64encode(src_path.read_bytes()).decode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
    payload = {
        "contents": [{"parts": [
            {"text": PROMPT},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}}
        ]}],
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
                    print(f"[OK] {out_path} in {round(time.time()-t)}s", flush=True)
                    return
            print(f"[NO_IMG] {json.dumps(r)[:200]}", flush=True)
            return
        except urllib.error.HTTPError as e:
            print(f"attempt {attempt+1}: HTTP {e.code}", flush=True)
            time.sleep(10)
        except Exception as e:
            print(f"attempt {attempt+1} fail: {repr(e)[:120]}", flush=True)
            time.sleep(10)
    print("FAILED", flush=True)

if __name__ == "__main__":
    print(f"Source: {src_path}", flush=True)
    print(f"Output: {out_path}", flush=True)
    run()
