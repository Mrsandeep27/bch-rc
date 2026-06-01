# pocketrccars.com — Product Line Reference

**Compiled:** 2026-06-01
**Source:** scrape of 12 Indian competitor PDPs (see `REF_1_64_COMPETITOR_PRODUCTS.md`)
**Status:** ready to drop into `src/lib/products.ts` once Syed confirms final SKU naming + provides photos

---

## 1 · The product line — Trasped / Hengguan HG4 series 1:64 mini RC

### Core SKUs observed across all 12 competitor sites

| Model code | Body shape | Differentiator | Where seen |
|---|---|---|---|
| **HG4-216** | Beetle (drift-tuned) | Compact desk drift | [kidspark.co.in](https://kidspark.co.in) |
| **HG4-218** | F1 generic (no driver) | Dual-mode 2.4G drift racing | [daddydrones.in](https://daddydrones.in) · most stores |
| **HG4-234** | Ferrari F1 (white livery) | Premium F1 styling | [youcliq.com](https://youcliq.com) · [kyaratoys.com](https://kyaratoys.com) |
| **F1 + Leclerc figurine** | F1 with driver | Premium upsell variant | [theindianbookstore.in](https://theindianbookstore.in) |
| **Off-road / Defender / Truck** | Defender 4x4 style | Off-road play | [parisgiftcorner.in](https://parisgiftcorner.in) · [thepeppystore.in](https://thepeppystore.in) |
| **Rock Crawler** | 4x4 with suspension | Outdoor traction (1:54 not 1:64) | Amazon Brand Conquer |

---

## 2 · Universal specs (every listing confirms these)

| Spec | Value |
|---|---|
| **Scale** | 1:64 (Trasped) · 1:54 (Brand Conquer crawler) |
| **Frequency** | 2.4 GHz |
| **Body material** | Alloy / die-cast metal + plastic parts |
| **Speed modes** | 3-speed adjustable |
| **Battery** | 3.7V Li-ion, built-in, USB-C rechargeable |
| **Lighting** | LED headlights + tail-lights |
| **Age** | 6+ years |
| **In box** | 1× car, 1× remote, 1× USB-C cable |

---

## 3 · Differentiating specs (only top sellers have these)

| Feature | Stores that mention it | Premium signal |
|---|---|---|
| **App control** (mobile app + remote dual mode) | shopbefikar · kidspark · kyaratoys | "Smart" tier |
| **Display case included** | shopbefikar | Collector positioning |
| **Driver figurine** | theindianbookstore | +₹1,000 premium variant |
| **Control range claim** | 10-20m (youcliq) · 70m (kidspark — inflated) | — |
| **Playtime claim** | 30+ mins (kidspark) | Battery confidence |
| **Exact dimensions** | 9 × 3.5 × 3.5 cm (kidspark only) | Size proof |
| **Color variants exposed** | 6 (Red · Black · Yellow · Blue · Sky Blue · White) — kyaratoys | Variety play |
| **Bundle pricing tiers** | Buy 1/2/3 — saikrishnastore | AOV booster |

---

## 4 · Pricing benchmarked (all 12 stores)

```
₹999   Amazon (Brand Conquer rock crawler, 1:54)  ← floor
₹1,149 shopbefikar (with display case + app)
₹1,199 kidspark (HG4-216 Beetle)
₹1,250 toycollectorsindia
₹1,299 viaanakidsstore        ← MEDIAN
₹1,299 youcliq (HG4-234 Ferrari)
₹1,299 thepeppystore
₹1,350 parisgiftcorner
₹1,490 daddydrones (HG4-218 — inferred from 25% off badge)
₹1,499 saikrishnastore (die-cast)
₹1,999 kyaratoys (premium positioning)
₹2,299 theindianbookstore (with driver figurine)  ← premium variant ceiling
```

**Median:** ₹1,299 (3 of 11 stores price here exactly — strongest cluster)
**Modal:** ₹1,299
**Recommended:** **₹1,299 sell · ₹1,999 MRP · 35% OFF badge**

---

## 5 · Proposed pocketrccars SKU line

| SKU id | Body | Color options | Sell price | MRP |
|---|---|---|---|---|
| `pocket-f1-base` | F1 (HG4-218) | Red · Black · Blue · White | **₹1,299** | ₹1,999 |
| `pocket-f1-pro` | F1 + Driver figurine | Red · White | **₹1,899** | ₹2,999 |
| `pocket-beetle` | Beetle Drift (HG4-216) | Yellow · Sky Blue · Black | **₹1,299** | ₹1,999 |
| `pocket-defender` | Off-road / Defender / Truck | Green · Black · Sand | **₹1,299** | ₹1,999 |

**Range:** 4 SKUs × 3-4 colors each = ~14 variant pages.

---

## 6 · Bundle plays (steal from saikrishnastore — zero competitor doing this for 1:64)

| Bundle | Price | Savings | Triggers |
|---|---|---|---|
| Buy 1 | ₹1,299 | — | base |
| **Buy 2 (mix or match colors / bodies)** | **₹2,299** | **Save ₹299** | AOV +77% |
| **Buy 3 (combo set)** | **₹3,199** | **Save ₹698** | AOV +146% |

This is the single biggest AOV move available — no competitor in the 1:64 niche offers tiered bundle pricing. Saikrishna does it but they're a generic confectionery store, not RC-specialized.

---

## 7 · Description copy template (steal from kyaratoys, ready to reuse)

```
✅ PREMIUM DIE-CAST ALLOY CONSTRUCTION — Heavy metal body, drop-tested
✅ REALISTIC FORMULA RACING DESIGN WITH LED LIGHTS — Looks like the real thing
✅ 2.4GHZ REMOTE + APP CONTROL — Dual control, no lag
✅ 3-SPEED ADJUSTABLE PERFORMANCE — Beginner to pro
✅ USB-C RECHARGEABLE — 30-min charge, 30-min play
✅ SMOOTH ON TILES / WOOD / MARBLE — All hard surfaces
✅ PERFECT GIFT FOR KIDS 6+ & ADULT COLLECTORS — Premium gift box
✅ BOOSTS COORDINATION + MOTOR SKILLS — Active, screen-free play
```

This 8-bullet format is the proven Indian-market template — used identically by 3 of the top sellers (kyaratoys, viaanakidsstore use the EXACT same block, supplied by the wholesaler). **Pocketrccars should rewrite the words but keep the rhythm.**

---

## 8 · Spec table format (steal from youcliq + shopbefikar)

Standard 11-row 2-column "Specifications" table for every PDP:

| Feature | Details |
|---------|---------|
| Brand | TRASPED / Hengguan |
| Model | HG4-216 / HG4-218 / HG4-234 |
| Scale | 1:64 |
| Color | (varies per SKU) |
| Frequency | 2.4GHz |
| Body Material | Alloy + Plastic |
| Control Type | Remote + App |
| Speed Modes | 3-Speed Adjustable |
| Lighting | LED |
| Control Range | ~10-20 meters |
| Usage | Indoor / Tabletop |
| Age Group | 6+ Years |

---

## 9 · "What's in the box" (steal from kyaratoys + youcliq)

- 1× RC Car (assembled)
- 1× 2.4 GHz Remote Controller
- 1× USB-C Charging Cable
- 1× Rechargeable Battery (built-in)
- 1× Quick-start Instruction Manual
- 1× Premium Gift Box
- *(+ Display case if Pro variant)*
- *(+ Driver figurine if Pro variant)*

---

## 10 · Trust signals to surface (steal from kyaratoys + daddydrones)

```
✓ 7-Day Free Returns
✓ Free Doorstep Delivery on orders above ₹1,499
✓ Safe & Secure Payments (Razorpay)
✓ Dispatched from Bangalore in 24 hrs
✓ 100% Genuine Quality
```

Footer-row format directly under the buy button.

---

## 11 · Hidden buyer concern to address (NO competitor does this)

> **"Is this really 1:64 like Hot Wheels?"** — top concern on Amazon Brand Conquer reviews.

**Fix:** Make hero image #2 a **size comparison shot** — pocketrccars car next to a real Hot Wheels die-cast, on a hand. Zero competitors do this. Single biggest trust unlock in the category.

---

## 12 · Variant strategy summary

- **Launch with 4 body shapes × 3-4 colors each** = ~14 SKU pages
- **Premium "with driver figurine" variant** at ₹1,899 (undercuts theindianbookstore.in's ₹2,299 by 17%)
- **Bundle pricing** (Buy 2 / Buy 3) — open whitespace in the category
- **Hot Wheels size comparison** as hero image #2 — uncontested

---

## 13 · Ready-to-use data shape (for src/lib/products.ts)

```typescript
export const PRODUCTS: Sku[] = [
  {
    id: 'pocket-f1-base',
    slug: 'pocket-f1-base',
    scale: '1:64',
    name: 'Pocket F1 Mini RC',
    tagline: 'Drift, race, repeat — 1:64 Formula racing in your pocket',
    retailINR: 1299,
    mrpINR: 1999,
    landingCostINR: 500,         // typical Trasped HG4 wholesale ~₹400-600
    bullets: [
      'Premium die-cast alloy body',
      'LED headlights + tail-lights',
      '2.4 GHz Remote + App control',
      'USB-C rechargeable · 30-min play',
    ],
    badge: 'BESTSELLER',
    bodyShape: 'F1 (HG4-218)',
    heroImage: '/products/pocket-f1-base-hero.jpg',
    altImages: [
      '/products/pocket-f1-base-flatlay.jpg',
      '/products/pocket-f1-base-scale-hand.jpg',
      '/products/pocket-f1-base-scale-hw.jpg',
      '/products/pocket-f1-base-lifestyle.jpg',
    ],
    specs: {
      lengthMM: 90,
      drive: '2WD',
      topSpeedKmh: 15,
      batteryMin: 30,
      chargeMin: 30,
      rangeM: 20,
      minAge: 6,
      led: 'Head + Tail',
      drift: 'Yes (drift mode)',
    },
  },
  // ... pocket-f1-pro, pocket-beetle, pocket-defender follow same shape
];
```

---

## 14 · What's still needed before code-replace

- [ ] Syed to confirm: ship 4 body shapes OR start with just 2 (F1 + Beetle)?
- [ ] Syed to confirm: include the "+ Driver" Pro variant at launch OR add later?
- [ ] Syed to provide: actual product photos in `public/products/raw/`
- [ ] Syed to confirm: bundle pricing accepted (Buy 2 = ₹2,299 / Buy 3 = ₹3,199)?

Once those 4 are answered, this MD becomes the source of truth for `src/lib/products.ts`.
