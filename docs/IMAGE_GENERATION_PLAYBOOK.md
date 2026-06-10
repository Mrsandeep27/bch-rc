# PRC Cars Image Generation Playbook

A complete, reusable pipeline for producing cinematic Amazon-listing-style
product images from raw iPhone shots, using Gemini 3 Pro Image Preview.

Built and battle-tested over a single session in June 2026 across 5 SKUs and
17 colour variants — about 57 successful Gemini calls at ~$0.04 each.

This doc captures everything: the scene catalogue, the prompt templates, the
script pipeline, the listing-vs-PDP split, the cache-bust pattern, the cost
model, and the failure modes. Use it as the starting point for any future PRC
storefront (PRC Bikes, PRC Drones, etc.) so we don't relearn the same lessons.

## TL;DR

1. Shoot raw iPhone product photos at `public/fresh/<category>/Photos/`. Sideways is fine — the script rotates.
2. Define per-SKU "labels" + "body" + raw mappings in `scripts/gen-lifestyle.py:SKUS`.
3. Pick 4 scenes per SKU from the archetype catalogue (or design new ones — see scene-block templates).
4. Wire them in `sku_scenes` map.
5. Run `python scripts/gen-lifestyle.py --sku <slug> --color <colour>` to generate 4 cinematic images per colour.
6. Copy to `/public/products/colors/PRC-<slug>-<colour>-{,2,3,4}.webp`.
7. Keep listing `heroImage` as a clean white-bg shot (different from PDP cinematic hero).
8. If browser caches stale URLs, use the `-v2` cache-bust pattern.

## What we built (the artifact)

- **5 scene archetypes per SKU.** Hero (E-tier) + 3 alts (A/C/D tier). Each
  SKU gets its own visual language — BMW = gaming-desk indoor, Porsche =
  race track, Thar = Indian off-road, F1 = motorsport, Monster = extreme.
- **Universal scene grammar.** Every scene has a `scene_block` (description),
  `lighting` (key/rim/contrast), and `overlay` (one of 5 overlay types).
  Plug in a new SKU by reusing the grammar with a different body + labels.
- **Pre-rotation + post-composite.** PIL rotates the raw iPhone photo before
  Gemini sees it (eliminates the flip-during-rotation bug), then composites
  the actual brand logo on hero shots (avoids text-rendering failures).
- **Listing vs PDP split.** `sku.heroImage` = clean white-bg shot for the
  homepage product grid (which doesn't have a colour selector). The PDP gallery
  reads `selectedColor.image` which is the cinematic hero. Two different shots
  for two different contexts.

## Tech stack (what to install)

```bash
pip install google-genai pillow
```

- **Model:** `gemini-3-pro-image-preview`
  - Honours "replace background", "preserve subject", "do not flip" reliably.
  - Slower + rate-limited (preview tier).
- **Don't use:** `gemini-2.5-flash-image` — ignores background-replacement
  instructions, keeps the original wall/floor every time.
- **Auth:** paid-tier `GEMINI_API_KEY` in `.env.local`. The free tier has
  image-generation `limit: 0` on most projects — don't waste hours
  fighting it.
- **Pricing:** roughly $0.04 per image (paid tier preview pricing). Budget
  ~$2.50-$3 per SKU (4 scenes × 4-5 colours = ~20 calls).

## Scene archetype catalogue

Each archetype is a drop-in scene. The first letter is the SKU prefix (none =
BMW). Pattern: hero (E-tier, dark dramatic showcase) + 3 alts.

### BMW (indoor / urban)
- **A — Gaming Desk Action**: RGB keyboard, monitor showing racing game, warm lamp, car on notebook ramp over stacked books. Top icon strip overlay.
- **C — Scale-in-Hand**: Car in palm, big white "1:64 Handheld Racing" wordmark, "Pocket-Size Drift Master" subtitle, red "SPEED" banner bottom, checkered flag corners.
- **D — LED Glow Macro Split**: Two stacked panels showing HEADLIGHTS (top, white glow) and TAIL-LIGHTS (bottom, red glow) on pitch black.
- **E — Premium Showcase Stage (hero)**: Glossy black mirror floor, dramatic overhead spotlight, stage smoke, car at 3/4 hero angle with full reflection. PRC logo composited top-right + "POCKET BMW / Premium 1:64 RC Drift" wordmark.

### Porsche (race / track)
- **PA — Hairpin Drift**: Golden-hour tarmac corner, white tire-smoke arc, grandstand bokeh, orange cones. Top icon strip.
- **PC — Front + Rear Angle Reveal**: Two panels (top front-3/4-LEFT, bottom rear-3/4-RIGHT), SAME body colour, dark studio backdrop. Labels: "FRONT VIEW Aero kit and headlights" + "REAR VIEW Rear wing and tail-lights".
- **PD — Wet Asphalt Night Macro**: Wet midnight street, cyan/magenta neon bokeh, water droplets, headlight cones through mist.
- **PE — Pit Lane Night (hero)**: F1-style pit garages at night, red/cyan LED signs, wet tarmac reflection, mechanics blurred. PRC logo composited.

### Thar (Indian off-road)
- **TA — Mountain Trail Climb**: Red-dirt mountain trail, distant Himalayan-style peaks, golden-hour sky, dust kicked up. Top icon strip.
- **TC — Front + Rear Detail**: Two panels showing bull-bar + headlamps (top) and spare tyre + tail-lights (bottom). Same blue/yellow/white/black body.
- **TD — Mud Splash Crossing**: Forest trail mud puddle, water spray frozen mid-air, dappled green forest light.
- **TE — Sunset Hilltop (hero)**: Car at rocky peak silhouetted against orange/purple Indian sunset, layered mountain horizon. PRC logo composited.

### F1 (motorsport)
- **FA — Starting Grid**: 5 red start lights overhead, other F1 cars on grid blurred, tyre marbles on tarmac. Top icon strip.
- **FC — Front + Rear Aero Detail**: Two panels showing nose cone + front wing (top) and rear wing + diffuser + exhaust (bottom).
- **FD — Tunnel Light Streaks**: Yellow sodium tunnel lights creating vanishing-point streaks, motion blur, wet road mirror.
- **FE — Pit Garage Pre-Race (hero)**: Garage interior, neat tool wall, mechanic silhouette, dramatic overhead flood, polished floor reflection, smoke wisps. PRC logo composited.

### Monster Truck (extreme terrain)
- **MA — Big Air Jump**: Mid-air over crushed-car ramp in stadium arena, all wheels off ground, floodlights, blurred crowd. Top icon strip.
- **MC — Front + Rear Detail**: Two panels showing bumper + LED bar (top) and roll-cage + oversized wheels (bottom).
- **MD — Mud Boulder Crawl**: Truck articulating over mossy boulders in dappled forest, mud everywhere.
- **ME — Junkyard Hero**: Truck on crushed car pile at sunset, industrial silhouettes, dust+smoke. PRC logo composited.

## Overlay types (the 5 grammars)

The `overlay` field on each scene is one of these strings, parsed by
`build_prompt()`:

### `TOP_ICON_STRIP`
Top 18% of canvas: dark gradient strip with 3 evenly spaced lime-neon-green
(#C5F500) outline icons + 2-line bold labels. Bottom-right brand mark
"PRC CARS". **No speed chip / KMPH callout** anywhere — explicit no-go in the
prompt.

Used for: "icon strip lifestyle" scenes (A / PA / TA / FA / MA).
Labels pulled from `SKUS["<sku>"]["labels"]`, e.g.
`[("2.4GHz", "Remote Control"), ("High Speed", "Drift"), ("LED", "Headlights")]`.

### `SPLIT_LABELS:Top label|Bottom label`
Two horizontal panels stacked. Lime label at top-left of each panel + white
subline. Tiny "Click once to switch on & off lights" hint at top centre.
Brand mark bottom-right.

Used for: front+rear reveal scenes (C / PC / TC / FC / MC) and
weather/feature comparison scenes (D / PD / TD / FD / MD).

### `BIG_WORDMARK:1:64|Handheld Racing|Pocket-Size Drift Master`
Big white wordmark (e.g. "1:64") with red zigzag accent, secondary line
("Handheld Racing"), tagline below ("Pocket-Size Drift Master"), and a red
diagonal "SPEED" banner at the bottom. Brand mark bottom-right.

Used for: scale-in-hand (C only). Avoid in future SKUs unless the scale
story is the lead.

### `HERO_BANNER:POCKET BMW|Premium 1:64 RC Drift`
Bottom-left bold white wordmark (~80 pt) with lime-green underline accent
and italic subtitle beneath. Top-right corner is RESERVED — Gemini is told
to leave it blank, and PIL composites the actual `prc-logo-white-tight.png`
onto that area after generation.

Used for: hero scenes (E / PE / TE / FE / ME).
**Critical:** the `composite_logo()` function in the script only fires when
`scene_key in {"E","PE","TE","FE","ME"}`. Add new hero keys to that set.

### `TITLE_BANNER:Multiple Drift Play`
Bold slab-serif title in upper-right with a transparent dark backdrop, plus
a red italic subtitle. Used for the top-down drift scene — but that scene
renders at a small canvas regardless, so this overlay was effectively
deprecated.

## Per-SKU schema in the script

The `SKUS` dict in `scripts/gen-lifestyle.py` is the source of truth for any
SKU's image pipeline config:

```python
"<sku-slug>": {
    "folder": "<Folder Name in public/fresh/>",
    "body": "1:64 scale toy <description of model + livery + decals>",
    "labels": [("Icon 1", "Label 1"), ("Icon 2", "Label 2"), ("Icon 3", "Label 3")],
    "colors": {
        "<colour-slug>": "IMG_xxxx.JPG",   # which raw to use for that colour
        ...
    },
}
```

And the `sku_scenes` map says which 4 scenes that SKU uses:

```python
sku_scenes = {
    "bmw":        ["A", "C", "D", "E"],
    "porsche":    ["PA", "PC", "PD", "PE"],
    "thar":       ["TA", "TC", "TD", "TE"],
    "monster":    ["MA", "MC", "MD", "ME"],
    "f1-classic": ["FA", "FC", "FD", "FE"],
}
```

## Pipeline (what the script does per call)

1. **Load + pre-rotate raw.** `Image.open(src) → ImageOps.exif_transpose() →
   rotate(-90, expand=True)`. iPhone shoots sideways; we rotate so Gemini sees
   the car already in driving orientation.
2. **Build prompt.** Mix the SKU body description + scene block + lighting
   block + overlay block. Tells Gemini: "DO NOT rotate / flip / mirror —
   the input is already correct."
3. **Call Gemini.** `client.models.generate_content(model="gemini-3-pro-image-preview", contents=[img, prompt])`. Up to 3 retries on transient errors.
4. **Resize.** Force-resize to 1024×1024 if model returns a non-square or
   smaller canvas.
5. **Logo composite (hero only).** PIL pastes `prc-logo-white-tight.png` at
   140×~auto px into the top-right corner with 36 px padding using
   `alpha_composite()`.
6. **Save.** WebP, quality 88, method 6, to `docs/refs/_lifestyle/PRC-<sku>-<colour>-scene<key>.webp`.

## How to add a new SKU

1. **Shoot raws.** Put iPhone JPEGs at `public/fresh/<Folder>/Photos/`.
2. **Add the SKU to `SKUS`** in `gen-lifestyle.py`:
   - `folder` = subfolder under `public/fresh/`
   - `body` = describe the car so Gemini preserves it accurately (body
     style, livery, decals, wheels)
   - `labels` = three feature pairs for the top icon strip
   - `colors` = map each colour slug to the best raw (front-3/4 angle
     usually works best)
3. **Pick 4 scenes** from the archetype catalogue OR write new scene
   blocks following the templates above. Add them to the `SCENES` dict if
   they're new.
4. **Wire `sku_scenes`** with the 4 scene keys for the new SKU.
5. **Test with one colour:** `python scripts/gen-lifestyle.py --sku <slug> --color <first-colour>`. Review the 4 outputs at
   `docs/refs/_lifestyle/`.
6. **Iterate.** Common fixes: tweak scene block, swap raw, adjust label
   trio, add prompt directive ("don't draw text X").
7. **Scale across colours:** `python scripts/gen-lifestyle.py --sku <slug>` (omit `--color` to run all colours of that SKU).
8. **Copy to PDP paths:**
   ```
   cp docs/refs/_lifestyle/PRC-<slug>-<colour>-scene<E-key>.webp public/products/colors/PRC-<slug>-<colour>.webp
   cp docs/refs/_lifestyle/PRC-<slug>-<colour>-scene<A-key>.webp public/products/colors/PRC-<slug>-<colour>-2.webp
   ...etc...
   ```
9. **Set listing `heroImage` to a clean white-bg shot** in `src/lib/products.ts`. Don't reuse the cinematic hero — the listing grid is one-size-fits-all
   and looks weird with one cinematic card among clean cards.

## Listing-vs-PDP image split (important pattern)

| Context | Reads | Image style |
|---|---|---|
| Homepage product card | `sku.heroImage` | **Clean white-bg studio shot** |
| RecentlyViewed | `sku.heroImage` | clean |
| SocialProofToast | `sku.heroImage` | clean |
| PDPStickyCTA | `sku.heroImage` | clean |
| Bundle upsell | `sku.heroImage` | clean |
| Checkout cart | `lineItem.variantImage ?? sku.heroImage` | clean |
| UgcGrid | hard-coded `/products/PRC-<sku>.webp` | clean |
| **PDP gallery slot 1** | `selectedColor.image` | **Cinematic hero** |
| **PDP gallery slots 2-4** | `selectedColor.altImages[]` | **Cinematic alts** |

Why this split: the homepage grid renders 5 cards side by side. If only one
is a dark cinematic shot it looks broken — the eye expects parity. The PDP,
on the other hand, is a single product surface where cinematic is the
whole point.

## Cache-bust pattern (the `-v2` trick)

Chrome aggressively caches WebP image responses. If a URL was previously
loaded with old content, **Ctrl+Shift+R / Disable Cache + Reload / Incognito**
all sometimes still serve stale.

The bulletproof fix:
1. Rename the new file with a `-v2` suffix: `cp PRC-<colour>.webp PRC-<colour>-v2.webp`.
2. Update `products.ts` to reference `-v2`.
3. New URL → Chrome has no cache for it → loads fresh.

We hit this for:
- `PRC-bmw-v2.webp` (BMW listing card hero)
- `PRC-porsche-green{,-2,-3,-4}-v2.webp` (full green colour)
- `PRC-porsche-dark-blue-3-v2.webp` (just the PC slot that was previously cached)
- `PRC-thar-blue{,-2,-3,-4}-v2.webp`, `PRC-monster-blue-...-v2`, `PRC-f1-classic-white-...-v2`

If you keep encountering this, consider adding a build-step hash to image
URLs in Next.js's `next.config.js` — but for now the `-v2` rename is
simplest.

## Cost model

Per session for one SKU:
- 1 colour test (4 calls): ~$0.16
- 1-2 regen for prompt tweaks: ~$0.08
- Scale to all colours (4 scenes × 3-5 colours): $0.50-$0.80
- Total per SKU: ~$0.80-$1.20

This session's actual spend: 5 SKUs × first-colour tests + most colours = ~57 calls ≈ **$2.30 paid**.

## Failure modes we hit (and how to dodge them)

| Symptom | Cause | Fix |
|---|---|---|
| Cream wall still visible in output | Used `gemini-2.5-flash-image` | Switch to `gemini-3-pro-image-preview` |
| `503 UNAVAILABLE — high demand` | Preview model overloaded at peak | Wait 5-10 min; or use the working key with backoff |
| `429 RESOURCE_EXHAUSTED` `limit: 0` | Free tier image-gen disabled | Use paid-tier project key |
| `429 RESOURCE_EXHAUSTED prepayment depleted` | Paid balance ran out | Top up at https://aistudio.google.com/billing |
| Car facing direction flipped | Gemini interpreted "rotate" too literally | Pre-rotate with PIL (already in script); prompt explicitly says "DO NOT rotate / flip" |
| Output is low-resolution (~512 px native) | Gemini chose small canvas for certain compositions (top-down drift, mountain trail) | PIL force-resizes to 1024×1024 — quality is OK for thumbnails but soft for hero. Pick a different scene composition if quality is critical. |
| Duplicate / garbage label appears in image (e.g. "REAR VIEW Intermal") | Gemini hallucinated extra label | Regenerate, or add explicit "do NOT add additional text" to overlay prompt |
| Brand wordmark text garbled | Gemini text rendering wobbly at small sizes | Don't trust Gemini for the brand mark. Reserve a clean corner via prompt and composite the actual logo PNG via PIL `alpha_composite()` |
| Two-colour chameleon split confuses customers | Original PC scene showed same car in two paint shifts → looked like two colour variants | Rewrote to same-colour front+rear angles (FRONT VIEW / REAR VIEW labels) |
| Speed chip "14 KMPH" still appearing after I "removed it" | Removed from `HERO_BANNER` overlay handler but forgot `TOP_ICON_STRIP` | Remove from BOTH handlers in `build_prompt()` |

## File layout (what survived cleanup)

```
docs/
  IMAGE_GENERATION_PLAYBOOK.md      ← this doc
  LIFESTYLE_HERO_SHOTS.md           ← original scene-catalogue notes (less polished)
  refs/
    _lifestyle/                     ← all generated outputs land here (gitignored if needed)

public/
  fresh/                            ← raw iPhone shots, organised per SKU subfolder
    BMW/Photos/
    Porsche/Photos/
    Thar/Photos/
    MonsterTruck/Photos/
    F1/Photos/
  products/
    PRC-<sku>.webp                  ← listing hero (clean white bg)
    PRC-<sku>-{2,3,4}.webp          ← (legacy alts, unused but kept for hidden SKUs)
    colors/
      PRC-<sku>-<colour>.webp       ← PDP hero (cinematic)
      PRC-<sku>-<colour>-{2,3,4}.webp ← PDP alts (cinematic)
      PRC-<sku>-<colour>-v2.webp    ← cache-busted variant where browser cached the old
  logo/
    prc-logo-white-tight.png        ← used by PIL composite for hero scenes

scripts/
  gen-lifestyle.py                  ← the pipeline (SKUS, SCENES, build_prompt, main loop)
  clean-fresh-shoot.py              ← legacy clean-bg pipeline (kept for reference)
```

## Future stores

Reusing for `PRC Bikes` or `PRC Drones` or whatever PRC ships next:

1. Copy `gen-lifestyle.py` to the new project.
2. Define a new `SKUS` entry with body + labels + raws + colours.
3. Pick 3-4 archetype scenes that fit the new product (Bikes = open road, garage; Drones = aerial, sunset sky, FPV; etc).
4. Generate test colour, iterate prompt, scale.
5. Same listing-vs-PDP split, same cache-bust pattern.

Estimated lift: ~2-3 hours per new SKU including raws, scene tuning, and
full colour rollout. ~$1-2 in Gemini API per SKU.
