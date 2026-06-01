"""
Hero v2 — front-on close-up car shot.
Composition: only the FRONT of the car visible (bumper + hood + headlights),
rest fades into pure black darkness. Headlights blazing toward camera.
Run:  GEMINI_API_KEY=xxx python scripts/generate-hero-v2.py
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


def call_gemini(model, parts):
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


def save_image(resp, out_path):
    if "_error" in resp:
        print(f"  ERR {resp['_error']}: {resp['_body'][:300]}")
        return False
    try:
        parts = resp["candidates"][0]["content"]["parts"]
        for p in parts:
            data = p.get("inline_data") or p.get("inlineData")
            if data:
                img = base64.b64decode(data["data"])
                with open(out_path, "wb") as f:
                    f.write(img)
                print(f"  Wrote {out_path} ({len(img)} bytes)")
                return True
        print(f"  No image. Text: {parts[0].get('text', '')[:200]}")
    except (KeyError, IndexError) as e:
        print(f"  Parse error: {e}")
    return False


VARIANTS = [
    (
        "hero-v2-frontal-right.png",
        """Cinematic dark hero banner for a premium RC drift car e-commerce site.

SCENE: A premium high-detail sport car shot from the FRONT (head-on direct frontal view, camera looking straight into the grille and headlights). Only the FRONT HALF of the car is visible — front bumper, hood, headlights, front grille, top of windshield. The REAR HALF of the car FADES INTO PURE BLACK DARKNESS — invisible. The car is positioned in the RIGHT 50% of the frame.

LIGHTING: 95% pure black darkness. Two intense WHITE LED HEADLIGHTS are switched ON and blazing brightly toward camera, creating bright twin starburst flares with subtle lens halation. A subtle DEEP RED rim-light (#E11D2A) traces the outline of the visible front bodywork, defining the silhouette against the void.

COMPOSITION: 16:9 widescreen cinematic. Car front fills RIGHT 50%, with headlights centered roughly at horizontal middle. LEFT 50% is completely empty pure black darkness — RESERVED for headline text overlay. Do not draw any text in the image.

ATMOSPHERE: Subtle volumetric haze in front of the headlights so the beams are visible cutting through air. Wet polished black asphalt visible at the bottom edge under the car, with a soft reflection of the headlight glow.

STYLE: Hyper-realistic premium automotive photography. Mercedes-AMG / BMW M / Audi RS press-photo aesthetic. NOT illustration, NOT toy-like. Sharp focus on the grille and headlights, dramatic falloff into darkness behind. Cinematic.

Aspect ratio: 16:9 widescreen, 1920x1080.""",
    ),
    (
        "hero-v2-frontal-center.png",
        """Cinematic dark hero banner for premium RC drift car e-commerce.

SCENE: Pure FRONTAL view of a sport coupe (camera dead-center, level with the headlights). Only the FRONT of the car is rendered — bumper, grille, hood, headlights, top of windshield — the rest of the body dissolves into total black darkness behind. Car is centered horizontally in the frame.

LIGHTING: Near-total darkness. Two WHITE LED HEADLIGHTS blazing TOWARD CAMERA as the dominant light source, with visible volumetric beams and starburst halation. Subtle RED accent rim-light (#E11D2A) along the bumper and hood edges, defining the form.

COMPOSITION: 16:9 widescreen. Car front fills CENTER of frame at moderate size (occupies center 50% width). Top and bottom of frame are empty dark space; LEFT and RIGHT margins of frame are empty pure black. Text overlay zone is the TOP THIRD of the frame above the car. Do not draw any text.

ATMOSPHERE: Subtle smoke / fog rolling at ground level. Light dust particles in the headlight beams. Wet polished surface beneath car with soft red and white reflections.

STYLE: Top-tier automotive product photography. Think Mercedes EQS press image, Lamborghini reveal photo. Hyper-real, surgical sharpness on car grille, dramatic cinematic falloff. NOT cartoon, NOT illustration.

Aspect ratio: 16:9 widescreen, 1920x1080.""",
    ),
    (
        "hero-v2-frontal-macro.png",
        """Cinematic macro hero banner — extreme close-up car front for premium RC car site.

SCENE: Extreme macro close-up of the FRONT of a sport coupe. The camera is positioned VERY CLOSE to the grille (within inches), lens slightly low. Visible: ONLY the grille mesh detail, the two intense headlights, front bumper splitter, hood scoop. Everything else fades into BLACK DARKNESS within centimeters. The car face dominates the frame like a portrait.

LIGHTING: Almost pure black scene. Two WHITE LED HEADLIGHTS blazing aggressively into camera, with bright bloom and lens flare. A glowing RED line of light (#E11D2A) traces along the chin spoiler / lower bumper edge — like a daytime running light strip — providing brand-color accent. Hood reflects subtle red and white glints.

COMPOSITION: 16:9 widescreen. Car face fills RIGHT 60% of frame. LEFT 40% is empty pure black space for headline overlay. Headlights are positioned roughly along the horizontal centerline. Do NOT draw any text on the image.

ATMOSPHERE: Slight steam / heat haze rising off the hood. A few floating dust motes in the headlight beams.

STYLE: Editorial automotive macro photography. Think Top Gear magazine cover, Petrolicious feature. Razor-sharp focus on the headlights and grille mesh, with shallow depth of field melting everything else into the dark.

Aspect ratio: 16:9 widescreen, 1920x1080.""",
    ),
]

for fname, prompt in VARIANTS:
    print(f"\nGenerating: {fname}")
    out = os.path.join(OUT_DIR, fname)
    resp = call_gemini("gemini-3-pro-image-preview", [{"text": prompt}])
    save_image(resp, out)

print("\nDone — compare in public/hero/")
