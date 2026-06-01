# pocketrccars.com — Design Requirements

**Compiled:** 2026-06-01
**Source:** [REF_NEOSAPIEN_DESIGN.md](REF_NEOSAPIEN_DESIGN.md) + [REF_1_64_COMPETITOR_PRODUCTS.md](REF_1_64_COMPETITOR_PRODUCTS.md) + [RESEARCH_SHOPIFY_PLAYBOOK.md](RESEARCH_SHOPIFY_PLAYBOOK.md)

Everything that needs to be designed (or decided) before we can ship a polished pocketrccars store. Grouped by category, prioritized P0/P1/P2, each item shows spec + status.

---

## 1 · Brand identity

| # | Asset | Spec | Status | Owner |
|---|---|---|---|---|
| 1 | **Logo** — wordmark + symbol | SVG + PNG transparent · works on dark + light | ❌ needed | Syed (commission or DIY) |
| 2 | **Color palette** — 1 primary + 1 secondary + 3 neutrals | Currently `#E11D2A` placeholder. Need final hex codes. | ⏸ awaiting decision | Syed |
| 3 | **Typography pair** — display + body | Currently Geist. Suggest: Druk / Inter Display (display) + Inter (body) | ⏸ awaiting decision | Syed / dev |
| 4 | **Brand voice** — 5 example sentences | Punchy, Hinglish-friendly, racing energy | ⏸ awaiting decision | Syed |

---

## 2 · Hero assets (above-the-fold)

| # | Asset | Spec | Status |
|---|---|---|---|
| 5 | **Hero video loop** | 5-8 sec MP4 · muted · autoplay · 9:16 mobile + 16:9 desktop · car drifting on dark floor with LEDs · ≤1.5 MB | ❌ needed (photoshoot) |
| 6 | **Hero poster** | First frame of video · ≤60 KB WebP · instant load fallback | ❌ needed |
| 7 | **Hero fallback static** | If video fails: 1920×1080 product shot + gradient overlay | ❌ needed |
| 8 | **Hero tagline (H1)** | One line — pick from: "Drift. Race. Pocket." / "F1 in your pocket — ₹1,299" / "Pocket drift. Real speed." | ⏸ awaiting decision |

---

## 3 · Product photography (per SKU × 4 SKUs = ~28 shots)

Required per body shape (F1, Beetle, Defender, F1+Driver Pro):

| # | Shot | Why | Status |
|---|---|---|---|
| 9 | **Hero shot** — white-bg, 3/4 angle | PDP main image | ❌ needed |
| 10 | **Flat-lay** — box opened, all components | "What's in the box" section | ❌ needed |
| 11 | **Scale-in-hand** — held by adult hand | Proves pocket-size | ❌ needed |
| 12 | 🔥 **Hot Wheels comparison** | NO competitor does this — biggest trust win | ❌ needed |
| 13 | **Lifestyle** — on desk / kid playing | Emotional hook | ❌ needed |
| 14 | **Color variants** — each color on white | Variant selector tiles | ❌ needed |
| 15 | **Detail close-ups** — LED on, wheels, badge | Quality justification | ❌ needed |

---

## 4 · 4-tile feature carousel (neosapien-style outcome videos)

| # | Tile | Loop concept (4-6 sec) | Status |
|---|---|---|---|
| 16 | **"Drift on any surface"** | Car sliding on marble / tiles | ❌ needed |
| 17 | **"Fits in your palm"** | Car placed in open hand | ❌ needed |
| 18 | **"USB-C in 30 minutes"** | Plug-in shot + LED battery indicator | ❌ needed |
| 19 | **"Race 3 friends at once"** | Multi-car action | ❌ needed |

---

## 5 · Component design (CSS — dev builds, designer reviews)

| # | Component | Status |
|---|---|---|
| 20 | Buttons (primary / secondary / ghost) | ✅ built — needs final brand color |
| 21 | Cards (product, review, FAQ) | ✅ built |
| 22 | Badges (MOST GIFTED, NEW, 35% OFF, BIS, Made in India) | ✅ built — needs final wording |
| 23 | Trust icons (USB-C, drop-tested, shield, India) | ✅ built (lucide) — optional upgrade to custom SVG |
| 24 | Bundle picker (Buy 1 / Buy 2 / Buy 3) | ❌ not built — needs design + dev |

---

## 6 · Section design

| # | Section | Status |
|---|---|---|
| 25 | **Sticky mobile CTA bar** | ✅ built — needs final color |
| 26 | **Floating WhatsApp FAB** | ✅ built — needs WhatsApp number |
| 27 | **Trust strip under hero** | ✅ built — needs final copy + ratings |
| 28 | **Bundle picker section** | ❌ not built |
| 29 | **FAQ accordion** (10-11 questions, neosapien style) | ❌ not built — needs Q&A list |
| 30 | **Footer with trust receipts** | ✅ built — needs GST/CIN numbers |
| 31 | **Hot Wheels size-comparison hero slot** | ❌ not built — needs photo first |
| 32 | **4-tile feature carousel section** | ❌ not built |

---

## 7 · Marketing creative (post-launch, for ads)

| # | Asset | Spec | Status |
|---|---|---|---|
| 33 | **Instagram Reels × 5** | 9:16 MP4 · 15-30 sec · drift / unboxing / gift reveal | ❌ post-launch |
| 34 | **Static post × 5** | 1:1 square · 4 lifestyle + 1 hero | ❌ post-launch |
| 35 | **Story format × 3** | 9:16 · for highlights | ❌ post-launch |
| 36 | **Meta ad creative × 3 variants** | 1:1 + 9:16 + 4:5 · same hero, different copy | ❌ post-launch |

---

## 8 · Social + SEO assets

| # | Asset | Spec | Status |
|---|---|---|---|
| 37 | **Favicon** | 32×32 ICO + 192/512 PNG | ❌ needed |
| 38 | **OG image** (WhatsApp/FB unfurl) | 1200×630 PNG, gift-box style | ❌ needed |
| 39 | **Twitter card** | 1200×600 PNG | ❌ needed |
| 40 | **Apple touch icon** | 180×180 PNG | ❌ needed |

---

## 9 · Transactional visual templates

| # | Template | When sent | Status |
|---|---|---|---|
| 41 | Order confirmation email banner | After purchase | ❌ needed before Resend wiring |
| 42 | Shipping confirmation email banner | When dispatched | ❌ needed |
| 43 | Review request email banner | D+5 after delivery | ❌ needed |

---

## Priority for launch

### 🔴 P0 — BLOCKS launch (must have)
1. Logo (any format, even rough)
2. Color palette decision (confirm `#E11D2A` or different)
3. Hero asset (video OR strong static image)
4. 1 hero shot per SKU (4 photos minimum)
5. Hero tagline picked

### 🟡 P1 — strongly improves conversion (week 1)
- Hot Wheels comparison shot
- Lifestyle photos
- Flat-lay shots
- 4-tile feature videos
- Custom favicon + OG image

### 🟢 P2 — fine for v2 (week 2-3)
- Color variant photos
- Marketing creative for ads
- Custom trust icons
- Email visual templates

---

## What's needed RIGHT NOW from Syed to unblock P0

Just 3 things:

1. **Logo file** (any format — even hand-drawn OK to start)
2. **Brand red hex** — confirm `#E11D2A` works OR send different
3. **Hero tagline** — pick one or send your own:
   - "Drift. Race. Pocket."
   - "F1 in your pocket — ₹1,299"
   - "Pocket drift. Real speed."

Everything else can use intelligent placeholders.

---

## Files this depends on / produces

- **Reads:** `REF_NEOSAPIEN_DESIGN.md`, `REF_1_64_COMPETITOR_PRODUCTS.md`, `RESEARCH_SHOPIFY_PLAYBOOK.md`
- **Will populate:** `src/lib/theme.ts` (colors, copy, contact) · `src/lib/products.ts` (4 SKUs from `PRODUCT_LINE.md`) · `public/products/raw/*.jpg`
