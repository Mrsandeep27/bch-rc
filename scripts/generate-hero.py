"""
Hero banner generator via Gemini 3 Pro Image.
Usage:  GEMINI_API_KEY=xxx python scripts/generate-hero.py

Produces 3 hero variants in public/hero/:
  - hero-1-cinematic.png   (cinematic dark room, headlights flaring left)
  - hero-2-drift.png       (drift moment frozen, tire smoke, neon hint)
  - hero-3-studio.png      (clean studio beauty shot)
All 16:9 widescreen at 1920x1080 equivalent.
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

OUT_DIR = "public/hero"
os.makedirs(OUT_DIR, exist_ok=True)


def call_gemini(model: str, parts: list) -> dict:
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
        with urllib.request.urlopen(req, timeout=240) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"_error": e.code, "_body": e.read().decode("utf-8", errors="replace")}


def save_image_from_response(resp: dict, out_path: str) -> bool:
    if "_error" in resp:
        print(f"  Error {resp['_error']}: {resp['_body'][:300]}")
        return False
    try:
        parts = resp["candidates"][0]["content"]["parts"]
        for p in parts:
            data = p.get("inline_data") or p.get("inlineData")
            if data:
                img_bytes = base64.b64decode(data["data"])
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                print(f"  Wrote {out_path} ({len(img_bytes)} bytes)")
                return True
        text = parts[0].get("text", "")
        print(f"  No image. Text response: {text[:200]}")
    except (KeyError, IndexError) as e:
        print(f"  Parse error: {e}")
    return False


VARIANTS = [
    (
        "hero-1-cinematic.png",
        """Cinematic hero banner for a premium mini RC drift car e-commerce site.

SCENE: A small high-detail 1:64 scale mini RC drift car (Formula-style sport coupe with sleek aerodynamic body, alloy construction, low and wide stance) sits on polished black wet-look asphalt that reflects a soft mirror image of the car beneath it. Dramatic studio scene.

LIGHTING: 95% near-black darkness. Two light sources only:
1. The car's own bright WHITE LED HEADLIGHTS are switched ON and cast two visible volumetric light beams cutting forward-left through subtle atmospheric haze.
2. A subtle deep RED rim-light (#E11D2A glow) traces the right edge of the car, defining its silhouette against the black void.

COMPOSITION: Wide cinematic 16:9 framing. The car is positioned in the RIGHT THIRD of the frame, angled slightly toward camera-left so the headlight beams flare into the LEFT 40% of the canvas. The LEFT 40% is deliberately empty, dark, atmospheric, with subtle haze and faint headlight glow — RESERVED FOR TEXT OVERLAY. Do not place any text in the image itself.

ATMOSPHERE: Thin tire smoke at wheel level frozen mid-drift. A few specks of dust floating in the headlight beams.

STYLE: Hyper-realistic automotive product photography. Think BMW M-series press photo crossed with Hot Wheels Premium catalog. NOT illustration. NOT cartoon. Sharp focus on the car, soft falloff into darkness behind.

Aspect ratio: 16:9 widescreen, 1920x1080.""",
    ),
    (
        "hero-2-drift.png",
        """Cinematic action hero banner for a mini RC drift car e-commerce site.

SCENE: A 1:64 scale mini RC drift car (F1-inspired racing body, red and white livery, alloy metal construction, exposed wheels) caught mid-DRIFT on a polished dark concrete floor with subtle tire marks. Motion frozen at peak slide angle.

LIGHTING: Moody dark scene. Two visible light sources:
1. The car's WHITE LED HEADLIGHTS ON, casting visible beams that slice through atmospheric drift-smoke.
2. Hot RED neon underglow (#E11D2A) lighting the underside of the car, casting a subtle red wash on the ground beneath it.

COMPOSITION: 16:9 widescreen. Car positioned in the RIGHT 60% of frame, angled at a dramatic 30-degree drift slide. LEFT 40% intentionally empty dark space with subtle haze and faint red glow — for text overlay. No text in image.

ATMOSPHERE: Dense white tire smoke billowing from rear wheels, drifting upward and backward. Subtle motion blur on wheels suggesting spin. Sparks possible.

STYLE: Hyper-realistic motorsport press photography. Tokyo drift / JDM tuner aesthetic. NOT illustration. Sharp on car body, motion blur on wheels and smoke. Cinematic depth.

Aspect ratio: 16:9 widescreen, 1920x1080.""",
    ),
    (
        "hero-3-studio.png",
        """Premium studio product hero banner for a 1:64 mini RC drift car.

SCENE: A 1:64 scale mini RC car (sleek alloy F1-style racing body, in matte black with subtle red detailing) presented as a hero product on a seamless dark backdrop that fades from pure black at top to deep charcoal grey at bottom — like an Apple product page or premium watch ad.

LIGHTING: Controlled studio lighting:
1. Soft key light from upper-front-right defining the car's bodywork curves.
2. Subtle RED accent rim-light (#E11D2A) along the right edge of the car, matching brand color.
3. The car's own WHITE LED HEADLIGHTS are ON, glowing softly as twin points of light.

COMPOSITION: 16:9 widescreen. Car positioned in RIGHT 50% of frame, captured at hero 3/4 front low angle (camera at car's headlight level). Sharp focus on car. LEFT 50% completely empty smooth dark background — intentional negative space for text overlay. No text in image.

ATMOSPHERE: Pristine, no smoke or atmosphere. Pure premium product clarity. Subtle reflection on the surface beneath the car.

STYLE: Apple product page photography. Premium watch advertisement. Knoll-style precision. NOT illustration. Hyperreal. Surgical sharpness on car.

Aspect ratio: 16:9 widescreen, 1920x1080.""",
    ),
]

for fname, prompt in VARIANTS:
    print(f"\nGenerating: {fname}")
    out = os.path.join(OUT_DIR, fname)
    resp = call_gemini(
        "gemini-3-pro-image-preview",
        [{"text": prompt}],
    )
    save_image_from_response(resp, out)

print()
print("Done. Open public/hero/ to compare.")
