# Lifestyle Hero Shot Reference & Scene Catalogue

Pivoting PDP alt-angle images from clean white-bg product shots to cinematic
lifestyle hero shots with feature callouts (like the BMW-jumping-off-books
gaming-desk reference image the user supplied).

Each SKU gets 3 alt slots (slot 2/3/4 of `colors/PRC-<slug>-<color>-{2,3,4}.webp`).
Per-color hero (`PRC-<slug>-<color>.webp`) stays as the clean white-bg shot;
only the 3 alts switch to lifestyle scenes.

## Reference image (the gold standard)

The reference the user sent shows:
- Cinematic dark gaming desk backdrop (RGB keyboard, monitor running a racing game, warm desk lamp)
- BMW M-style coupe in mid-air jumping off a notebook ramp on a stack of blue books
- LED headlights glowing white-blue, motion blur streaks behind
- Top-strip overlay: 3 lime/neon-green icons + labels in clean sans-serif
  - Remote control icon | "2.4GHz Remote Control"
  - Speedometer icon | "High Speed Drift"
  - Lightbulb icon | "LED Headlights"
- Format: 1:1 square

Style cues to replicate across every generated shot:
- **Lighting:** cinematic, warm key + cool rim, dark moody ambience
- **Action:** car in motion (mid-air, drifting, accelerating) — never static
- **LED highlights:** headlights ON, glowing bright
- **Motion blur / speed lines** behind the car
- **Top-strip overlay:** 3 neon icons + bold sans-serif labels (consistent across all SKUs)
- **No on-image text other than the 3 overlay labels** (keeps it global-ready)

## Scene archetypes (catalogue)

Each archetype is one drop-in scene. Mix and match across SKUs based on body type.

### A. Gaming Desk Jump (reference style)
**Backdrop:** dark home gaming desk; RGB mechanical keyboard glowing red+blue, monitor showing Forza-style game, warm tungsten desk lamp.
**Props:** notebook ramp on stacked blue hardcovers.
**Car action:** mid-air jump off the ramp, all four wheels off the surface, headlights blazing.
**Best for:** BMW, Porsche, F1 (street/race cars).

### B. Garage Workshop / Tuner Bay
**Backdrop:** concrete garage floor, neon "Drift Club" sign on brick wall, hydraulic lift in deep background, toolbox blurred.
**Props:** spare drift wheels, USB-C charger, micro tyres on the floor.
**Car action:** mid-burnout — tyre smoke behind rear wheels, headlights bright.
**Best for:** BMW, Porsche (tuner culture fit).

### C. Drift Track / Tarmac
**Backdrop:** wet-look asphalt track with white racing lines, distant grandstand bokeh, golden-hour sky.
**Props:** orange traffic cones.
**Car action:** mid-drift broadside, rear-wheel smoke, opposite-lock front wheels.
**Best for:** Porsche, BMW, F1.

### D. Off-Road Dune / Trail
**Backdrop:** golden sand dune or rocky desert trail, dramatic mountain silhouette at sunset.
**Props:** small boulders, dust plume.
**Car action:** wheels-airborne over a rock crest, dust cloud trailing.
**Best for:** Thar, Monster Truck.

### E. Mud / Splash Pit
**Backdrop:** muddy trail with water puddle, forest blur behind.
**Props:** wet leaves, splashing water droplets frozen mid-air.
**Car action:** smashing through the puddle, mud splash wave.
**Best for:** Monster Truck, Thar.

### F. Pit Lane / Starting Grid (F1)
**Backdrop:** F1 pit garage corridor at night, red lights, tyre stacks.
**Props:** racing helmet on the ground, lap timer.
**Car action:** sitting low on the grid with hot exhaust glow, front lit by start lights.
**Best for:** F1 Classic, F1 Ferrari, F1 Driver.

### G. Living Room Race (kid / gift context)
**Backdrop:** modern living room tile floor, sofa blurred, Christmas tree lights bokeh or birthday balloons.
**Props:** torn wrapping paper, gift box open.
**Car action:** drifting on tile, kid's hand holding the remote in foreground (out of focus).
**Best for:** All SKUs as the "this is a gift" shot.

### H. Box Reveal / What's-in-the-box
**Backdrop:** clean dark gradient with single overhead spotlight.
**Props:** flat-lay of premium gift box open, USB-C cable coiled, spare wheel set, remote, quick-start card.
**Car action:** car sitting centered on the open box lid.
**Best for:** All SKUs, slot -4.

### I. Scale Comparison / Pocket Shot
**Backdrop:** soft warm gradient, neutral wood desk.
**Props:** ₹500 coin or matchbox next to the car for scale.
**Car action:** static on a hand (palm visible), emphasising "pocket size".
**Best for:** All SKUs.

### J. LED Glow Hero Macro
**Backdrop:** pitch black.
**Props:** none.
**Car action:** car front 3/4, ONLY the LED headlights and any underglow visible — the rest in shadow.
**Best for:** All SKUs, "LED Headlights" feature callout shot.

## Per-SKU slot assignment (proposed)

| SKU | Slot -2 | Slot -3 | Slot -4 |
|---|---|---|---|
| **BMW** | Gaming Desk Jump (A) | Drift Track (C) | LED Glow Macro (J) |
| **Porsche** | Drift Track (C) | Garage Workshop (B) | Box Reveal (H) |
| **Thar** | Off-Road Dune (D) | Mud / Splash Pit (E) | Box Reveal (H) |
| **Monster Truck** | Mud / Splash Pit (E) | Off-Road Dune (D) | Crushed cars / rock crawl |
| **F1 Classic** | Pit Lane (F) | Drift Track (C) | LED Glow Macro (J) |

Color variants reuse the same scenes; only the car body colour changes.
That's 5 SKUs × 3 scenes = 15 unique scene compositions. 17 color variants ×
3 scenes = 51 generations (white BMW slot -2 and -3 already done from
user's Gemini-UI hand-generated shots).

## Universal overlay specification

All 51 lifestyle shots share the same overlay treatment to keep the
catalogue visually consistent:

- **Position:** top 18% of canvas, full width.
- **Icons:** 3 evenly spaced lime/neon-green (#C5F500-ish) outline icons,
  ~80 px tall.
- **Labels:** under each icon, neon-green sans-serif (Inter/Manrope/Poppins),
  bold, ~36 pt, 2 lines max.
- **Background behind overlay:** slight dark gradient or none (keep scene
  visible).

Per-SKU label trio (drives icon selection):

| SKU | Icon 1 | Icon 2 | Icon 3 |
|---|---|---|---|
| BMW | 2.4GHz Remote | High Speed Drift | LED Headlights |
| Porsche | Pro Drift Mode | USB-C Charge | LED Headlights |
| Thar | Off-Road Grip | Drop-Tested 1.2m | LED Headlights |
| Monster Truck | 4WD All-Terrain | Oversized Tyres | Roof LED Bar |
| F1 Classic | 3-Speed | 12-15 min Drift | LED Headlights |

## Sample Gemini prompt (BMW Slot -2, Gaming Desk Jump)

```
Cinematic e-commerce product hero shot, perfectly square 1:1 aspect ratio.

THE CAR: the 1:64 scale toy BMW M-style coupe shown in the attached
reference image. White body with red and blue 'SUPER RACING' / 'SPEED 77' /
'Sport' decals, large black rear wing, alloy chrome 5-spoke wheels, LED
headlights ON. Preserve the EXACT body colour, decals, wheels, wing — do
not invent details, do not change the car.

THE SCENE: car captured mid-air jumping off a paper notebook ramp resting
on a stack of two thick blue hardcover books on a warm-toned wooden desk.
The notebook ramp angles upward toward the upper right of the frame.

BACKGROUND: blurred dark gaming setup. Bottom left: a mechanical keyboard
with RGB backlighting glowing red and blue. Upper left: a monitor showing
a blurred Forza-Horizon-style racing game with a track curve and night
sky. Right side: a warm tungsten desk lamp casting a yellow glow into the
scene. The wall behind is dark with subtle bokeh light specks.

LIGHTING: cinematic, dramatic. Warm key light from the desk lamp on the
car's right side. Cool blue rim light from the keyboard glow on the car's
left side. The car's white LED headlights cast bright cones of light
forward. Subtle motion blur streaks behind the car suggesting forward
motion.

OVERLAY (top strip, ~18% of canvas height): three evenly spaced
lime-neon-green (#C5F500) outline icons with bold neon-green sans-serif
labels in 2 lines each:
  1. Remote control icon | label: '2.4GHz Remote Control'
  2. Speedometer icon | label: 'High Speed Drift'
  3. Lightbulb / LED icon | label: 'LED Headlights'

Output: 1024 x 1024 pixels, 1:1 square. Premium cinematic ad creative.
```

## Other public references to study

- Amazon listings (search 1/64 mini drift car, RIDID V64, Moonzeamus KF20,
  ANTSIR Mini RC Drift) — most use a 7-image carousel: hero white bg,
  lifestyle action, infographic w/ specs, feature callout, what's-in-box,
  scale comparison, kid/gift.
- Behance "Amazon Listing Image Design" galleries — typical 7-image deck
  templates with overlay strip + dramatic backdrop.
- Hot Wheels packaging design (Mattel Behance project) — colour-block
  energy + dynamic angle conventions.
- AliExpress KF20 / KF21 / RIDID listings — Asian D2C style is the closest
  visual cousin to PRC Cars target.

## Workflow

1. Pre-rotate raw iPhone reference using PIL (driving orientation).
2. Send `[reference image, scene prompt]` to Gemini 3 Pro Image Preview
   with the per-slot prompt above.
3. Output: 1024 x 1024 PNG.
4. PIL pass: light tone-curve + WebP q=88 save.
5. Place at `public/products/colors/PRC-<slug>-<color>-{2,3,4}.webp`.
6. Mirror to `public/products/PRC-<slug>-{2,3,4}.webp` if user wants the
   default SKU gallery to show lifestyle shots too.

## What's still needed before generation

- User OK on scene catalogue + slot assignment table above.
- Decision: overlays baked in by Gemini (this plan), OR scene-only +
  PIL/SVG overlay pass (more reliable text rendering).
- Confirm icon palette: neon-green (#C5F500) matches PRC brand or use
  PRC orange (#dc2626) or another colour.
