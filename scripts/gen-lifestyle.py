"""
gen-lifestyle.py
=================
Generate cinematic lifestyle hero shots in Indian D2C Amazon-listing style
using Gemini 3 Pro Image Preview. Reusable for any SKU + color + scene.

Four scene archetypes locked from L.O.T Cars + Moonzeamus listing analysis:
  A — Gaming Desk Action (top icon strip overlay)
  B — Top-Down Drift Patterns (figure-8 tire trails overhead)
  C — Scale-in-Hand (car in palm, "1:64" wordmark)
  D — LED Glow Macro (dark bg, headlights vs taillights split)

Usage:
  python scripts/gen-lifestyle.py --sku bmw --color white   # 4 scenes
  python scripts/gen-lifestyle.py --sku bmw --color white --scene A
  python scripts/gen-lifestyle.py --sku bmw                  # all colors x all scenes
"""

import argparse
import io
import os
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

from google import genai
from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parent.parent
FRESH = REPO / "public" / "fresh"
OUT_DIR = REPO / "docs" / "refs" / "_lifestyle"  # test path; flip to colors/ once approved


def load_env_file(p: Path):
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


load_env_file(REPO / ".env.local")
API_KEY = os.environ["GEMINI_API_KEY"]
MODEL = "gemini-3-pro-image-preview"

# Per-SKU spec: which raw to use per color (picks the best side-3/4 raw),
# the 3 feature labels for the icon strip, and a speed-mode chip.
SKUS = {
    "bmw": {
        "folder": "BMW",
        "body": "1:64 scale toy BMW M-style sport coupe. White/blue/black body with red and blue 'SUPER RACING' / 'SPEED 77' / 'Sport' decals down both sides, large black rear wing, alloy chrome 5-spoke wheels",
        "labels": [("2.4GHz", "Remote Control"), ("High Speed", "Drift"), ("LED", "Headlights")],
        "speed_chip": "14 KMPH",
        "colors": {
            "white": "IMG_3526.JPG",
            "blue":  "IMG_3539.JPG",
            "black": "IMG_3533.JPG",
        },
    },
    "porsche": {
        "folder": "Porsche",
        "body": "1:64 scale toy rally-style sport coupe (Porsche 911 GT3 silhouette). Iridescent chameleon body that shifts colour, side livery + 'Racing Sports' decals, large rear wing, sport alloy wheels",
        "labels": [("Pro Drift", "Mode"), ("USB-C", "30 min charge"), ("LED", "Headlights")],
        "speed_chip": "15 KMPH",
        "colors": {
            "dark-blue": "IMG_3559.JPG",
            "green":     "IMG_3549.JPG",
            "yellow":    "IMG_3556.JPG",
            "multi":     "IMG_3544.JPG",
        },
    },
    "thar": {
        "folder": "Thar",
        "body": "1:64 scale toy Mahindra Thar-style / Land Cruiser-style off-road SUV, boxy body with twin headlamps, side livery, alloy off-road wheels, spare tyre on the rear",
        "labels": [("Off-Road", "Grip Tyres"), ("USB-C", "12-15 min drift"), ("LED", "Headlights")],
        "speed_chip": "13 KMPH",
        "colors": {
            "blue":   "IMG_3565.JPG",
            "yellow": "IMG_3579.JPG",
            "white":  "IMG_3573.JPG",
            "black":  "IMG_3570.JPG",
        },
    },
    "monster": {
        "folder": "MonsterTruck",
        "body": "1:64 scale toy monster truck RC car with oversized black rubber off-road tyres, chrome 5-spoke rims, lifted suspension, roof LED light-bar, racing decals on body",
        "labels": [("4WD", "All-Terrain"), ("Oversized", "Rubber Tyres"), ("Roof LED", "Light Bar")],
        "speed_chip": "12 KMPH",
        "colors": {
            "blue":       "IMG_3506.JPG",
            "yellow":     "IMG_3500.JPG",
            "white-red":  "IMG_3521.JPG",
            "multi":      "IMG_3515.JPG",
            "red-orange": "IMG_3495.JPG",
        },
    },
    "f1-classic": {
        "folder": "F1",
        "body": "1:64 scale toy Formula 1 race car, open-wheel chassis, exposed front and rear wings, low aero body, low-profile racing tyres, racing decals",
        "labels": [("2.4GHz", "3-speed"), ("USB-C", "15 min drift"), ("LED", "Headlights")],
        "speed_chip": "15 KMPH",
        "colors": {
            "white": "IMG_3588.JPG",
            "red":   "IMG_3585.JPG",
        },
    },
}

# Scene archetypes. Each one is a full prompt fragment that gets composed
# with the SKU-specific body + labels.
SCENES = {
    "A": {
        "name": "Gaming Desk Action",
        "scene_block": """A cinematic dark gaming desk lifestyle scene. The car is centered in the middle of the canvas, captured mid-action with its LED headlights blazing bright white-blue. The car sits on a wooden desk surface near a stack of two thick blue hardcover books with an open spiral-bound notebook ramping up against them at a 20-degree angle. Behind the car, blurred in deep depth-of-field: an RGB mechanical keyboard glowing red and blue along the bottom edge of the frame, a computer monitor faintly showing a racing-game track on the upper left, and a warm tungsten desk lamp casting a yellow glow into the scene from the right. The wall behind is dark with subtle warm bokeh light specks.""",
        "lighting": "Cinematic, moody, dramatic. Warm tungsten key light from the desk lamp on the car's right. Cool blue/red rim light from the keyboard on the car's left. Bright white LED headlight cones projecting forward. Subtle motion-blur streaks behind the rear wheels suggesting forward speed.",
        "overlay": "TOP_ICON_STRIP",
    },
    "B": {
        "name": "Top-Down Drift Patterns",
        "scene_block": """An overhead TOP-DOWN aerial view of the car drifting on wet-look black asphalt. The car is positioned mid-drift in the lower-right quadrant, with curving white tire-smoke trails forming a figure-eight pattern across the asphalt. Faint ghost-images of the same car appear at two earlier points along the drift path (a circular-drift loop and a curvilinear-drift arc), each leaving smoke trails. Distant yellow road markings frame the edges. RENDER AT MAXIMUM RESOLUTION — extremely detailed asphalt texture, crisp luminous smoke, sharp car details. This must be a high-resolution print-ready 4K image, NOT a small thumbnail.""",
        "lighting": "Overhead spotlight on the asphalt, dramatic dark vignette at corners. The car's headlights cast forward white cones visible from above. White smoke trails are crisp and luminous. Ultra-high-resolution photographic detail.",
        "overlay": "TITLE_BANNER:Multiple Drift Play",
    },
    "C": {
        "name": "Scale-in-Hand",
        "scene_block": """The car sits in the palm of an adult human hand (realistic skin, no jewellery, neutral skin tone). The hand is open, fingers slightly curled. The car is the dominant subject — perfectly clear and sharp — while the hand and arm are softly out of focus. Background: dark gradient with a subtle checkered black-and-white racing flag pattern in the lower-right corner. The car's LED headlights are ON, casting a small white glow on the palm beneath the front wheels.""",
        "lighting": "Soft studio key light from upper-left on the car. Cool blue rim light from behind. Hand is warmly lit but slightly underexposed so the car pops. Cinematic depth-of-field.",
        "overlay": "BIG_WORDMARK:1:64|Handheld Racing|Pocket-Size Drift Master",
    },
    "D": {
        "name": "LED Glow Macro Split",
        "scene_block": """Pitch-black background. Two horizontal panels stacked: TOP PANEL shows an extreme close-up of the car's FRONT, focused on the bright glowing white LED HEADLIGHTS (only the front 40% of the car visible, the rest fading into darkness). BOTTOM PANEL shows an extreme close-up of the car's REAR, focused on the glowing red LED TAIL-LIGHTS (only the rear 40% of the car visible). A thin diagonal red gradient line separates the two panels.""",
        "lighting": "Pure dark studio. The only light sources are the car's own LEDs — bright white from headlights (top panel) and red from tail-lights (bottom panel). The body of the car catches subtle reflections of its own glow.",
        "overlay": "SPLIT_LABELS:HEADLIGHTS Bright functional visibility|TAIL-LIGHTS Stay visible even from behind",
    },
    "PA": {
        "name": "Hairpin Drift (Porsche -2)",
        "scene_block": """A cinematic outdoor race-track corner scene. The car is centered in mid-drift through a tarmac hairpin turn, captured at a slight 3/4 front angle. White tire-smoke trails curve out from the rear wheels, frozen mid-motion. Background: a sweeping tarmac corner with white painted racing lines along the inside curb, distant grandstand bleachers heavily blurred into warm golden-hour bokeh, a couple of orange traffic cones at the corner apex. Sky: golden-hour sun low on the horizon casting warm light. Distant trees suggest a real circuit like Buddh International or a coastal road.""",
        "lighting": "Warm golden-hour key light from the upper-left painting the bodywork in honey tones. Cool blue shadow contrast in the smoke. Bright white LED headlight cones cutting forward. Subtle motion-blur streaks behind the rear wheels and on the tarmac surface emphasising speed.",
        "overlay": "TOP_ICON_STRIP",
    },
    "PC": {
        "name": "Front + Rear Angle Reveal (Porsche -3)",
        "scene_block": """Two horizontal panels stacked, both showing the SAME EXACT car in the SAME EXACT body colour as the input image, against an identical dark studio gradient backdrop. TOP PANEL: the car at a 3/4 FRONT-LEFT angle, showing the bonnet, grille, headlights, front wheels, and the side livery. BOTTOM PANEL: the SAME car at a 3/4 REAR-RIGHT angle, showing the rear wing, tail-lights, exhaust, rear wheels, and the side livery from the opposite side. CRITICAL: the body colour must be IDENTICAL across both panels — do NOT shift, change, or vary the colour. Both panels show the same one car, just photographed from two angles. A thin diagonal lime-green gradient line separates the two panels.""",
        "lighting": "Identical lighting setup in both panels: soft cool-white studio key from the upper-left, subtle warm rim from the upper-right. Both panels equally lit. LED headlights on in both. Strong dark-studio contrast so the bodywork pops.",
        "overlay": "SPLIT_LABELS:FRONT VIEW Aero kit and headlights|REAR VIEW Rear wing and tail-lights",
    },
    "PD": {
        "name": "Wet Asphalt Macro (Porsche -4)",
        "scene_block": """Extreme close-up of the car at night on wet glossy black asphalt with the car positioned in the lower-right of the frame at a low 3/4 front angle. Fine water droplets and a thin layer of road mist hang in the air. The car's bright white LED headlights are cutting through the mist as visible light cones. The wet asphalt mirrors the underside of the car with a soft reflection. Background: deep dark midnight blue sky with faint distant neon signage (cyan and magenta) blurred into bokeh. Atmospheric, moody, hyperreal night photography.""",
        "lighting": "Dark moody night ambience. The car's headlights are the dominant light source. Faint cyan and magenta rim lights from the distant neon signs catch the bodywork edges. The wet asphalt reflects highlights crisply. Light cone visible through the mist.",
        "overlay": "SPLIT_LABELS:ALL-WEATHER Drift on wet surface|USB-C CHARGE 30 min full top-up",
    },
    "PE": {
        "name": "Pit Lane Night (Porsche hero)",
        "scene_block": """A cinematic F1-style pit lane at night. The car is centered in the foreground, sitting on glossy wet tarmac at the entrance to a pit garage, captured at a 3/4 hero angle. Behind the car: a row of pit garages with vertical LED light signs glowing in red, cyan, and white, mechanics' silhouettes blurred in the background, distant pit-lane lights forming a leading line. Tire stacks visible to one side. Thin wisps of mist drift across the floor at wheel height. The car's LED headlights are blazing forward, projecting visible light cones across the wet tarmac. Subtle reflections of the pit-lane lights in the tarmac.""",
        "lighting": "Cool blue-white overhead pit-lane light directly above the car as the dominant key, with warm orange rim light from a garage spotlight behind. Coloured neon rim from the LED garage signs catches the bodywork edges in red and cyan. Strong cinematic contrast. The mist glows where the headlight beams pass through it.",
        "overlay": "HERO_BANNER:POCKET PORSCHE|GT3 Drift Silhouette",
    },
    "TA": {
        "name": "Mountain Trail Climb (Thar -2)",
        "scene_block": """A cinematic outdoor off-road adventure scene. The car is centered, climbing up a rocky red-dirt mountain trail at a slight uphill angle, captured at a 3/4 front-low hero angle. The trail switches back behind the car. Background: distant Himalayan-style snow-capped peaks far away under a clear golden-hour sky, midground rocky cliff face, a few small wild grasses on the trail edges. Dust kicked up by the rear wheels drifting back. The car's LED headlights are ON. Indian off-road feel — Ladakh / Spiti style terrain.""",
        "lighting": "Warm golden-hour key light from the upper-left painting the bodywork. Cool blue rim shadow from the cliff. Bright white LED headlight cones catching the dust. Crisp shadows on the trail.",
        "overlay": "TOP_ICON_STRIP",
    },
    "TC": {
        "name": "Front + Rear Detail (Thar -3)",
        "scene_block": """Two horizontal panels stacked, both showing the SAME EXACT off-road SUV car in the SAME EXACT body colour as the input, against an identical dark studio gradient backdrop. TOP PANEL: car at a 3/4 FRONT-LEFT angle showing the chrome bull-bar, twin round headlamps, bonnet, and front grille. BOTTOM PANEL: SAME car at a 3/4 REAR-RIGHT angle showing the spare tyre mounted on the rear door, tail-lights, rear bumper, and side steps. CRITICAL: body colour must be IDENTICAL across both panels. A thin diagonal lime-green gradient line separates the two panels.""",
        "lighting": "Identical lighting in both panels: cool-white studio key from upper-left, subtle warm rim from upper-right. LED headlights on in both. Dark-studio contrast.",
        "overlay": "SPLIT_LABELS:FRONT VIEW Bull-bar and twin headlamps|REAR VIEW Spare tyre and tail-lights",
    },
    "TD": {
        "name": "Mud Splash Crossing (Thar -4)",
        "scene_block": """The car centered, smashing through a wide muddy puddle on a forest trail. A dramatic crown of mud and water spray frozen mid-air around all four wheels, splashing outwards. The car is captured at a low 3/4 front angle, low to the water surface. Background: dense Indian forest blurred into deep green bokeh, dappled light through the leaves. Mud streaks across the lower body of the car. The car's LED headlights are ON, cutting through fine mist rising off the water.""",
        "lighting": "Dappled forest light from above. Cool greenish rim on the trees, warm spot on the car. The water spray catches the light brightly. Headlight beams visible through the mist.",
        "overlay": "SPLIT_LABELS:ALL-TERRAIN Built for India|TROPICAL PROOF Drift in rain",
    },
    "TE": {
        "name": "Sunset Hilltop Hero (Thar hero)",
        "scene_block": """The car is centered at the peak of a rocky hilltop trail, captured at a 3/4 hero angle from a slightly low position, silhouetted against a dramatic Indian sunset sky in oranges and purples. The trail leading up to the peak is visible receding into the distance behind. Distant mountain ranges layered into the horizon. The car's LED headlights are ON. A few wisps of dust hang in the air. Premium off-road adventure feel.""",
        "lighting": "Warm sunset backlight rim-lighting the car silhouette. Cooler ambient light fills the shadow side of the car so details remain visible. Long crisp shadows from the car onto the trail. The sky has a dramatic gradient from orange near the horizon to purple at the top.",
        "overlay": "HERO_BANNER:POCKET THAR|Made for India",
    },
    "FA": {
        "name": "Starting Grid (F1 -2)",
        "scene_block": """A cinematic F1 starting grid scene. The car is centered on the grid, captured at a 3/4 hero angle from a low front position. Five red starting lights are illuminated overhead on a gantry visible in the upper portion of the frame. Other F1 cars are positioned behind blurred into bokeh on the grid. The tarmac has white grid markings and tyre marbles. Heat shimmer rises faintly from rear exhausts. The car's LED headlights are ON.""",
        "lighting": "Cool overhead grid-light as key. Red rim light from the start lights tinting the car edges red. Warm low-angle pit-wall lights from camera-left. Bright sharp tarmac texture in foreground.",
        "overlay": "TOP_ICON_STRIP",
    },
    "FC": {
        "name": "Front + Rear Aero Detail (F1 -3)",
        "scene_block": """Two horizontal panels stacked, both showing the SAME EXACT F1 race car in the SAME EXACT livery colour as the input, against an identical dark studio gradient backdrop. TOP PANEL: car at a 3/4 FRONT-LEFT angle showing the nose cone, front wing flaps, exposed front wheels, and steering linkage. BOTTOM PANEL: SAME car at a 3/4 REAR-RIGHT angle showing the rear wing, exhaust pipes, diffuser, and exposed rear wheels. CRITICAL: livery colour must be IDENTICAL across both panels. A thin diagonal lime-green gradient line separates the two panels.""",
        "lighting": "Identical lighting in both panels: cool-white studio key from upper-left, subtle warm rim from upper-right. LED headlights on in both. Dark-studio contrast that makes the aero parts pop.",
        "overlay": "SPLIT_LABELS:FRONT WING Nose cone and aero|REAR WING Exhaust and diffuser",
    },
    "FD": {
        "name": "Tunnel Light Streaks (F1 -4)",
        "scene_block": """The car centered in a long highway tunnel at high speed, captured at a low 3/4 front angle. Bright yellow tunnel lights overhead stretch into the distance creating dramatic vanishing-point streaks behind the car. Motion-blur streaks pour from the exposed wheels and rear wing. The wet tunnel road surface mirrors the lights below. The car's LED headlights are bright white, projecting forward.""",
        "lighting": "Warm yellow sodium-lamp ambient from the tunnel lights tinting the entire scene amber. Cool white from the car's headlights for contrast. Strong motion blur on everything except the car body which is sharp. Mirror-like reflections on the wet road.",
        "overlay": "SPLIT_LABELS:RACE-GRADE Aero kit included|USB-C 25 min runtime per charge",
    },
    "FE": {
        "name": "Pit Garage Pre-Race (F1 hero)",
        "scene_block": """The F1 car centered inside a pit garage, captured at a 3/4 hero angle. Behind the car: a workbench with neatly arranged tools, tyre stacks, and team-branded panelling. A pit-crew silhouette to one side blurred. Above the car: overhead floodlights creating dramatic key light. The polished garage floor reflects the car. Smoke wisps from a warming heater drift across the floor. The car's LED headlights are ON.""",
        "lighting": "Dramatic overhead pit-garage floodlight creating a strong key on the bodywork. Warm orange rim from a workbench lamp at camera-right. Cool blue tint in the deep background shadows. Hard reflection of the car on the polished floor.",
        "overlay": "HERO_BANNER:POCKET F1|Open-Wheel Drift",
    },
    "MA": {
        "name": "Big Air Jump (Monster -2)",
        "scene_block": """A cinematic extreme outdoor monster-truck arena scene. The truck is centered, captured mid-air at the peak of a massive jump, all four wheels off the ground, at a dramatic low 3/4 front-up angle. Below the truck: a stack of crushed cars and a dirt ramp. Background: a stadium arena with floodlights, blurred crowd silhouettes, dust kicked up from the ramp. The truck's LED roof light-bar and headlights are blazing. Motion-blur streaks behind the rear wheels.""",
        "lighting": "Bright stadium floodlights as key from upper-right. Warm rim from arena spotlights at camera-left. Strong contrast against the dust and dark crowd background. LED light-bar projects a visible cone of light from the roof.",
        "overlay": "TOP_ICON_STRIP",
    },
    "MC": {
        "name": "Front + Rear Detail (Monster -3)",
        "scene_block": """Two horizontal panels stacked, both showing the SAME EXACT monster truck in the SAME EXACT body colour as the input, against an identical dark studio gradient backdrop. TOP PANEL: truck at a 3/4 FRONT-LEFT angle showing the massive bumper, roof LED light-bar, grille, and the front oversized tyres. BOTTOM PANEL: SAME truck at a 3/4 REAR-RIGHT angle showing the rear oversized tyres, chassis tubular frame, rear differential, and rear roll-cage. CRITICAL: body colour must be IDENTICAL across both panels. A thin diagonal lime-green gradient line separates the two panels.""",
        "lighting": "Identical lighting in both panels: cool-white studio key from upper-left, subtle warm rim from upper-right. LED light-bar and headlights on in both. Dark-studio contrast that emphasises the suspension and tyres.",
        "overlay": "SPLIT_LABELS:FRONT VIEW Bumper and LED bar|REAR VIEW Roll-cage and oversize wheels",
    },
    "MD": {
        "name": "Mud Boulder Crawl (Monster -4)",
        "scene_block": """The truck centered, slowly crawling over a pile of large mossy boulders and a fallen tree log in a deep forest. Mud splattered across the body and wheels. The chassis articulating dramatically as one wheel lifts off the ground. Background: thick Indian rainforest blurred into deep green bokeh with shafts of dappled sunlight piercing through the canopy. The truck's roof LED bar and headlights are ON.""",
        "lighting": "Dappled forest light from above through the canopy. Cool greenish ambient. Warm spot key on the truck body from a sunbeam. Bright roof-bar LED cone visible cutting through mist.",
        "overlay": "SPLIT_LABELS:EXTREME Climb anything|ROOF LED BAR Lights the trail ahead",
    },
    "ME": {
        "name": "Junkyard Showcase (Monster hero)",
        "scene_block": """The truck centered, standing on top of a tall pile of crushed cars in a junkyard at sunset, captured at a dramatic 3/4 hero angle from low ground. The crushed-car pile fills the lower third of the frame. Background: an orange-purple sunset sky with distant industrial silhouettes — a crane, container stacks. Dust and smoke drift in the air. The truck's roof LED light-bar is BLAZING bright, projecting upward and forward.""",
        "lighting": "Warm orange sunset backlight rim-lighting the truck silhouette. Cooler ambient fills the shadow side so details remain visible. The roof LED light-bar adds a strong white-blue accent. Dramatic long shadows from the truck across the junk pile.",
        "overlay": "HERO_BANNER:POCKET MONSTER|Crush It All",
    },
    "E": {
        "name": "Premium Showcase Stage (hero)",
        "scene_block": """The car is centered on a polished glossy black mirror-like stage, captured at a slight 3/4 hero angle showing both the front and the side of the car. The car's full reflection is visible in the mirror surface beneath it. Background: deep dramatic dark gradient from black at the corners to a subtle warm-blue spotlight glow behind the car. Thin wisps of stage smoke drift across the floor and behind the rear wheels. The car's LED headlights are ON, casting two bright white-blue beams forward across the mirror surface. A few subtle dust-particle specks float in the spotlight beam. The composition feels like a luxury car launch or premium product reveal.""",
        "lighting": "Cinematic spotlight directly above and slightly behind the car, casting a dramatic rim-light halo around the car silhouette and a controlled key-light wash across the bodywork. Warm-blue gel on the backlight, neutral white key. Strong contrast between the bright spotlit car and the dark surrounding stage. Faint blue underglow rim reflects off the mirror surface.""",
        "overlay": "HERO_BANNER:POCKET BMW|Premium 1:64 RC Drift",
    },
}


def build_prompt(sku_key: str, color: str, scene_key: str) -> str:
    sku = SKUS[sku_key]
    scene = SCENES[scene_key]
    labels = sku["labels"]
    chip = sku["speed_chip"]
    body = sku["body"]

    # Build overlay description
    overlay_text = ""
    if scene["overlay"] == "TOP_ICON_STRIP":
        icon_lines = "\n".join(
            f'  {i+1}. {["Gamepad / remote control", "Speedometer dial", "Lightbulb / LED"][i]} icon | label on 2 lines: "{label[0]}" / "{label[1]}"'
            for i, label in enumerate(labels)
        )
        overlay_text = f"""TOP STRIP OVERLAY (top ~18% of canvas, full width, dark gradient backdrop):
Three evenly spaced lime-neon-green (#C5F500) outline icons with bold neon-green sans-serif labels in 2 lines each underneath. Crisp text, perfectly readable, no spelling errors:
{icon_lines}

BOTTOM-RIGHT BRAND MARK: Subtle white text "PRC CARS" in clean sans-serif.
Do NOT add any speedometer chip, KMPH badge, or speed-related callout anywhere in the image. The bottom-left corner should be empty (just the natural scene background)."""

    elif scene["overlay"].startswith("TITLE_BANNER:"):
        title = scene["overlay"].split(":", 1)[1]
        overlay_text = f"""TOP-RIGHT TITLE OVERLAY: bold white slab-serif text on a transparent dark gradient: "{title}". Underneath in red italic: "Pro drift mode".
BOTTOM-RIGHT BRAND MARK: white "PRC CARS" sans-serif."""

    elif scene["overlay"].startswith("BIG_WORDMARK:"):
        parts = scene["overlay"].split(":", 1)[1].split("|")
        big, sub1, sub2 = parts[0], parts[1] if len(parts) > 1 else "", parts[2] if len(parts) > 2 else ""
        overlay_text = f"""TOP OVERLAY: Massive bold WHITE wordmark text "{big}" with a thin red zigzag accent above the digits. Beside it: smaller white "{sub1}" with thin underline. Tagline beneath: "{sub2}".
BOTTOM OVERLAY: Bold red angled banner with white text "SPEED" — the banner is a graphic element only, NO placeholder text or template watermark on it.
BOTTOM-RIGHT BRAND MARK: white "PRC CARS" sans-serif. Do NOT include any 'ADD YOUR LINE HERE' or template artifact text anywhere in the image."""

    elif scene["overlay"].startswith("SPLIT_LABELS:"):
        parts = scene["overlay"].split(":", 1)[1].split("|")
        top_label = parts[0]
        bot_label = parts[1] if len(parts) > 1 else ""
        overlay_text = f"""TOP-LEFT (over top panel): Lime-neon-green bold sans-serif label "{top_label.split(' ',1)[0]}" with subline white "{top_label.split(' ',1)[1] if ' ' in top_label else ''}".
BOTTOM-LEFT (over bottom panel): Lime-neon-green bold sans-serif label "{bot_label.split(' ',1)[0]}" with subline white "{bot_label.split(' ',1)[1] if ' ' in bot_label else ''}".
TOP CENTER (small): white text "Click once to switch on & off lights".
BOTTOM-RIGHT BRAND MARK: subtle white "PRC CARS" sans-serif."""

    elif scene["overlay"].startswith("HERO_BANNER:"):
        parts = scene["overlay"].split(":", 1)[1].split("|")
        title = parts[0]
        subtitle = parts[1] if len(parts) > 1 else ""
        overlay_text = f"""BOTTOM-LEFT BANNER (large): Bold WHITE sans-serif wordmark "{title}" in a clean modern typeface, ~80 pt, with a thin lime-neon-green underline accent. Underneath in smaller white italic: "{subtitle}".
TOP-RIGHT CORNER: leave a clean empty area approximately 200x80 pixels (top-right corner with ~40px padding from the edges) — DO NOT draw any text, logo, watermark, or graphic in this area. This space is reserved for a brand logo to be composited in afterwards. The area should just be the natural scene/background, no text added.
Do NOT add any speedometer chip, KMPH badge, or speed-related callout anywhere in the image. Keep overlays minimal so the hero car stays the dominant subject. No icon strip at top — this is a clean hero shot."""

    return f"""Cinematic e-commerce product hero shot for an Indian D2C toy RC car brand. Perfectly square 1:1 aspect ratio, 1024x1024.

THE CAR (preserve EXACTLY from the reference image):
{body}. The car shown in the input is the {color} colour variant. Preserve every visible decal, wheel design, headlight, wing, body shape — pixel-faithful. Do NOT change body colour, decals, wing, wheels, or facing direction. Do NOT mirror or flip the car. LED headlights are ON, glowing bright white.

THE SCENE:
{scene["scene_block"]}

LIGHTING:
{scene["lighting"]}

{overlay_text}

STYLE REFERENCE: Indian D2C Amazon listing hero infographic in the L.O.T Cars / KF20 style. Premium cinematic ad creative. Sharp, hyperreal, photographic, square 1:1.

Output: 1024x1024 PNG."""


def load_pre_rotated(src: Path) -> Image.Image:
    img = Image.open(src)
    img = ImageOps.exif_transpose(img)
    img = img.rotate(-90, expand=True)
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def call_gemini(client: genai.Client, img: Image.Image, prompt: str, label: str) -> bytes | None:
    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=[img, prompt])
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return part.inline_data.data
            print(f"  {label} attempt {attempt+1}: no image", flush=True)
        except Exception as e:
            msg = str(e).replace("\n", " ")[:160]
            print(f"  {label} attempt {attempt+1}: {msg}", flush=True)
            if attempt < 2:
                wait = 30 if "503" in msg or "UNAVAILABLE" in msg else 5
                time.sleep(wait)
    return None


LOGO_PATH = REPO / "public" / "logo" / "prc-logo-white-tight.png"


def composite_logo(canvas: Image.Image, logo_width: int = 140, pad: int = 36) -> Image.Image:
    """Paste the white PRC logo into the top-right corner with alpha blending.
    Used for hero scenes (Scene E) where the prompt reserved a clean corner."""
    if not LOGO_PATH.exists():
        print(f"  WARN: logo not found at {LOGO_PATH}, skipping composite", flush=True)
        return canvas
    logo = Image.open(LOGO_PATH).convert("RGBA")
    ratio = logo_width / logo.width
    new_size = (logo_width, int(logo.height * ratio))
    logo = logo.resize(new_size, Image.LANCZOS)
    out = canvas.convert("RGBA")
    x = out.width - logo.width - pad
    y = pad
    out.alpha_composite(logo, (x, y))
    return out.convert("RGB")


def save_image(raw: bytes, output: Path, add_logo: bool = False):
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    if img.size != (1024, 1024):
        img = img.resize((1024, 1024), Image.LANCZOS)
    if add_logo:
        img = composite_logo(img)
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output, "WEBP", quality=88, method=6)
    print(f"  -> {output.relative_to(REPO)} ({output.stat().st_size // 1024} KB)", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sku", required=True, choices=list(SKUS.keys()))
    ap.add_argument("--color", help="Single color (default: all colors of the SKU)")
    ap.add_argument("--scene", choices=list(SCENES.keys()), help="Single scene (default: per-SKU set, see sku_scenes mapping below)")
    args = ap.parse_args()

    print(f"Model: {MODEL} | Key: {API_KEY[:8]}...{API_KEY[-4:]}\n", flush=True)
    sku = SKUS[args.sku]
    colors = [args.color] if args.color else list(sku["colors"].keys())
    # Per-SKU default scene set so each product line gets its own visual story.
    sku_scenes = {
        "bmw":        ["A", "C", "D", "E"],
        "porsche":    ["PA", "PC", "PD", "PE"],
        "thar":       ["TA", "TC", "TD", "TE"],
        "monster":    ["MA", "MC", "MD", "ME"],
        "f1-classic": ["FA", "FC", "FD", "FE"],
    }
    scenes = [args.scene] if args.scene else sku_scenes.get(args.sku, ["A", "C", "D", "E"])

    client = genai.Client(api_key=API_KEY)
    total = len(colors) * len(scenes)
    print(f"Plan: {total} images ({len(colors)} colors x {len(scenes)} scenes)\n", flush=True)

    for color in colors:
        raw_name = sku["colors"].get(color)
        if not raw_name:
            print(f"[{args.sku}/{color}] SKIP — no raw mapping", flush=True)
            continue
        src = FRESH / sku["folder"] / "Photos" / raw_name
        if not src.exists():
            print(f"[{args.sku}/{color}] SKIP — raw missing: {src}", flush=True)
            continue
        ref = load_pre_rotated(src)
        for scene_key in scenes:
            label = f"[{args.sku}/{color}/Scene-{scene_key}]"
            print(f"{label} generating with {raw_name}...", flush=True)
            prompt = build_prompt(args.sku, color, scene_key)
            raw_bytes = call_gemini(client, ref, prompt, label)
            if raw_bytes:
                out = OUT_DIR / f"PRC-{args.sku}-{color}-scene{scene_key}.webp"
                # Hero scenes (E / PE / TE / FE / ME) get the real PRC logo composited on top.
                save_image(raw_bytes, out, add_logo=scene_key in {"E", "PE", "TE", "FE", "ME"})
            else:
                print(f"{label} ALL ATTEMPTS FAILED", flush=True)

    print("\nDone.", flush=True)


if __name__ == "__main__":
    main()
