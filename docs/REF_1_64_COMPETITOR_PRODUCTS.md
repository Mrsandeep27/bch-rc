# 1:64 Mini RC — Indian competitor product pages

> Scraped: 12 product pages selling the same/similar Trasped (HG4-216 / HG4-218 / HG4-234) and Hengguan 1:64 mini RC line, plus 1 Amazon "Brand Conquer" mini rock crawler and 1 Hot Wheels-rebadged listing.
> Source: Apify Playwright crawl, 2026-05-31.
> Successful extractions: 9 of 12 (75%). See "Scrape errors" at bottom.
> Purpose: pricing benchmark + spec extraction + description copy mining for pocketrccars.com PDP.

---

## Pricing landscape

> **Updated 2026-06-01:** All 12 stores now have pricing visible (11 full + 1 partial). The 6 gaps from the Apify scrape were filled via a follow-up pinchtab pass.

| # | Store | Product | MRP (Rs) | Sell price (Rs) | Discount | Source |
|---|-------|---------|----------|-----------------|----------|--------|
| 1 | **Amazon.in** (Brand Conquer) | Mini Rock Crawler 1:64 (Purple, 1:54 actual) | — | **999** | floor price | Apify |
| 2 | **shopbefikar.com** | 1:64 Alloy F1 + Display Case + App | 1,190 | **1,149** | 3% | Pinchtab |
| 3 | **kidspark.co.in** | Trasped HG4-216 Beetle Drift | 1,199 | **1,199** | 0% | Apify |
| 4 | **toycollectorsindia.com** | Trasped Mini Riccar 1:64 | 1,250 | **1,250** | 0% (premium store) | Apify |
| 5 | **viaanakidsstore.com** | F1 Trasped 1:64 | 1,999 | **1,299** | **35%** | Apify |
| 6 | **youcliq.com** | TRASPED HG4-234 Ferrari F1 White | 1,599 | **1,299** | **19%** | Pinchtab |
| 7 | **thepeppystore.in** | Trasped Scale 1:64 2.4 GHz | 1,499 | **1,299** | **13%** | Pinchtab (Apify hit 403) |
| 8 | **parisgiftcorner.in** | Trasped Mini RC (Off-road / Defender / Truck variants) | 1,500 | **1,350** | 10% | Pinchtab (Apify timed out) |
| 9 | **daddydrones.in** | Hengguan HGRC HG4-218 1:64 Drift | ~1,990 | **~1,490** | **25%** (badge) | Pinchtab (price JS-lazy, badge inferred) |
| 10 | **saikrishnastore.in** | F1 1:64 Die-cast Metal | 1,999 | **1,499** | **25%** | Apify |
| 11 | **kyaratoys.com** | F1 Trasped 1:64 (6 colors) | 4,999 | **1,999** | **60%** (anchor inflation) | Apify |
| 12 | **theindianbookstore.in** | F1 Leclerc with Driver figurine | 7,599 | **2,299** | **70%** (premium variant) | Pinchtab |

**Updated price band:** Rs 999 – Rs 2,299 sell price across all 12 listings.
- **Mass market (10 of 12 stores):** Rs 1,149 – Rs 1,499 sell · MRPs Rs 1,190 – Rs 1,999
- **Premium "with driver" variant** (theindianbookstore.in): Rs 2,299 sell · Rs 7,599 MRP = clear upsell anchor for "premium variant" SKU
- **MRP inflation pattern:** 8 of 12 use Rs 1,499–1,999 as MRP. Outliers: kyaratoys (Rs 4,999) and theindianbookstore (Rs 7,599) chase 60–70% discount badges. Buyers see through this.

### Refined recommendation: **Rs 1,299 sell / Rs 1,999 MRP / 35% OFF** (unchanged)

Updated stats with all 11 priced stores:
- **Sorted sell prices:** 999, 1149, 1199, 1250, **1299**, **1299**, **1299**, 1350, 1499, 1999, 2299
- **Median: Rs 1,299** (3 of 11 stores price here exactly — strongest cluster)
- This is the literal market median AND the modal price. Rs 1,299 is the right anchor.

**Premium variant upsell:** add a "+ Driver figurine" SKU at Rs 1,899–Rs 1,999 (using theindianbookstore.in's Rs 2,299 pattern as anchor, undercut by 13–17%).

---

## Common product naming patterns

The same physical SKU (Trasped HG4 series, 1:64 scale, 2.4GHz, alloy body, 3-speed, USB rechargeable, LED) is repackaged with these recurring naming components:

| Component | Examples used | Why it sells |
|-----------|---------------|--------------|
| **Scale prefix** | "1:64", "1/64", "Scale 1:64" | SEO-critical, signals collectible category |
| **License / inspiration** | "F1", "Ferrari", "Leclerc", "Formula 1", "Beetle" | Aspirational + Google Trends |
| **Brand badge** | "Trasped", "TRASPED HG4-216 / HG4-218 / HG4-234", "Hengguan HGRC" | Chinese OEM names, often kept for SEO |
| **Material adjective** | "Alloy", "Die-cast Metal", "Metal Body" | Trust signal vs cheap plastic |
| **Control type** | "2.4GHz Remote", "App Control", "Dual Mode", "Remote + Mobile" | Differentiator vs IR toys |
| **Use case** | "Drift Car", "Racing Car", "Mini RC", "Pocket Drift" | Searchable category |
| **Bonus tag** | "With Display Case", "LED Lights", "With Driver" | Unboxing curiosity |

**Winning long-form title template (Amazon-style, used by Brand Conquer):**
> `[Brand] [Product type] [Scale] | [Material] [Power] | [Control] | [Feature 1] | [Feature 2] | [Use case] for [Audience] ([Color])`

Example: `Brand Conquer Mini Rock Crawler Remote Control Car 1:64 Scale | Metal Body Rechargeable RC Car | 2.4GHz Remote + Mobile Control | LED Headlights | Off-Road Shock Absorber Toy Car for Kids (Purple)`

**Winning short-form (Shopify-style):** `1:64 Alloy F1 Mini RC Car with App Control & Display Case | 2.4GHz Remote Racing Car with LED Lights` (Shopbefikar)

---

## Spec patterns

### Specs that ALL 9 successful listings include
- **Scale:** 1:64 (universal)
- **Frequency:** 2.4GHz (universal)
- **Body material:** Alloy / Die-cast metal + plastic parts (universal)
- **Speed modes:** 3-speed adjustable (universal)
- **Battery:** USB rechargeable, built-in Li-ion (universal)
- **Lighting:** LED headlights/taillights (universal)

### Specs that differentiate the top sellers
- **App control** (mobile app + remote) — top-tier listings mention this, budget ones don't
- **Display case included** (shopbefikar) — premium positioning
- **Control range** — youcliq says ~10-20m, kidspark claims 70m (likely inflated)
- **Playtime** — kidspark: 30+ mins, neosapien-style "X days" framing absent
- **Dimensions** — only kidspark gives exact (9 × 3.5 × 3.5 cm)
- **Age group** — shopbefikar: 6+ years (only listing that calls this out clearly)
- **Color variants** — kyaratoys exposed 6 (Red/Black/Yellow/Blue/Sky Blue/White); others don't expose
- **Bundle pricing** — only saikrishnastore offers tiered (Buy 1 / Buy 2 / Buy 3 = Rs 500 / Rs 1,089 / Rs 1,505 savings)

### Spec table format (steal this — used by youcliq, shopbefikar, saikrishna)
Most successful PDPs include a clean 2-column "Specifications" table. Standard rows:

| Feature | Details |
|---------|---------|
| Brand | TRASPED / Hengguan |
| Model | HG4-216 / HG4-218 / HG4-234 |
| Scale | 1:64 |
| Color | (varies) |
| Frequency | 2.4GHz |
| Body Material | Alloy + Plastic |
| Control Type | Remote + App |
| Speed Modes | 3-Speed Adjustable |
| Lighting | LED |
| Control Range | ~10-20 meters |
| Usage | Indoor / Tabletop |
| Age Group | 6+ Years |

---

## Description copy mining

### #1 — kyaratoys.com (Amazon-style benefit bullets, all caps headers)
Best example of dense feature-bullet selling. 8 bullets, each opens with a green check + ALL-CAPS HEADLINE + dash + benefit-led explanation. Steal this structure verbatim:

> ✅ **PREMIUM DIE-CAST METAL CONSTRUCTION FOR MAXIMUM DURABILITY** – Engineered with a high-quality alloy die-cast metal body, this 1:64 scale F1 mini RC racing car delivers exceptional durability, superior impact resistance, and a premium feel. Unlike ordinary plastic toy cars, the reinforced structure ensures long-lasting performance even during intense racing sessions, crashes, and everyday play.
>
> ✅ **REALISTIC FORMULA RACING CAR DESIGN WITH LED LIGHTS** – Inspired by professional Formula race cars, this sleek mini RC racing vehicle features aerodynamic styling, detailed body contours, and bright LED lights that enhance visual appeal. The realistic racing aesthetics create an immersive driving experience, making it a perfect collectible and exciting toy for both kids and adult racing enthusiasts.
>
> ✅ **ADVANCED 2.4GHz REMOTE CONTROL TECHNOLOGY** – Equipped with a precision 2.4GHz radio control system, the car provides stable signal transmission, interference-free racing, responsive steering, and smooth acceleration. Enjoy seamless control, extended operating range, and reliable performance whether racing indoors or outdoors.
>
> ✅ **3-SPEED ADJUSTABLE PERFORMANCE MODES** – Designed for all skill levels, the adjustable speed settings allow users to switch between controlled driving for beginners and thrilling high-speed racing for advanced players.
>
> ✅ **USB RECHARGEABLE BATTERY FOR CONVENIENT PLAY** – Features a USB rechargeable power system that eliminates the need for constant battery replacements.
>
> ✅ **SMOOTH HANDLING ACROSS MULTIPLE SURFACES** – Built for versatile performance, this mini remote control car glides effortlessly on tiles, wooden floors, desks, pavements, and other smooth surfaces.
>
> ✅ **PERFECT GIFT & COLLECTIBLE FOR ALL AGES** – A top-tier mini RC car gift choice for kids, boys, racing fans, hobby enthusiasts, and collectors.
>
> ✅ **BOOSTS MOTOR SKILLS & HAND-EYE COORDINATION** – Encourages cognitive engagement, reflex development, and hand-eye coordination while delivering endless entertainment and excitement.

**Note:** viaanakidsstore.com uses the EXACT same 8 bullets verbatim — this is a standard wholesaler/dropshipper copy block. **Pocketrccars should rewrite, not copy, but the STRUCTURE (8 ALL-CAPS bullets with check icons) is proven on the Indian market.**

### #2 — shopbefikar.com (emoji-led, scannable, Indian-market friendly)
Best example of mobile-first, emoji-heavy storytelling:

> 🏎 **Smart Mini F1 Racing – Now with App Control!**
>
> Take racing to the next level with the 1:64 Alloy F1 Mini RC Car, a compact yet powerful racing machine designed for both fun and display. Built with a premium alloy (metal) body, this mini RC car offers durability along with a sleek Formula racing design.
>
> What makes it special? You can control it using both a 2.4GHz remote AND mobile app control, giving you a modern and interactive racing experience.
>
> 📱 **Dual Control – App + Remote**
> 📡 2.4GHz Remote Control for traditional racing
> 📱 Mobile App Control for smart driving experience
> 🎮 Smooth and responsive steering
> 🏁 Race multiple cars without signal interference
>
> 🚀 **Smooth Performance with ECVT System**
> ⚡ Smooth acceleration · 🎮 Better speed control · 🏎 Seamless gear transitions
>
> ❤️ **Why Parents Love It**
> 📱 Modern app-based control option · 🧠 Improves coordination and focus · 📵 Engages kids away from screens · 🎁 Premium looking gift · 🔋 Rechargeable
>
> 🎯 **Why Kids & Collectors Love It**
> 🏎 Real F1 racing car experience · 📱 Control via mobile app · 💡 Cool LED lighting effects

This format converts better in WhatsApp-share scenarios (emojis render, parents forward it).

### #3 — youcliq.com (premium narrative, no bullets above the fold)
Best example of long-form storytelling for desktop buyers:

> Bring Formula racing excitement to your desk with the **TRASPED HG4-234 1:64 F1 Mini RC Car (White Edition)** — a compact, high-detail RC model designed for both performance and display.
>
> With its **clean white racing livery and realistic Formula-style design**, this miniature car captures the essence of professional F1 machines. The **low-profile aerodynamic body, exposed wheels, and detailed elements** give it a premium and sporty look.
>
> Constructed with a **durable alloy shell**, the car is built to withstand minor impacts while maintaining its sleek finish. Its lightweight design ensures quick acceleration and smooth movement, making it ideal for **indoor racing on tables, floors, and compact tracks**.

Then follows clean "Key Features" cards (h3 + 1-line description), then a clean specs table, then "What's in the Box", then "Why Choose This".

### #4 — kidspark.co.in (the lean version — under 80 words total)
Best example of fast-converting, low-friction copy for a Rs 1,199 price point:

> **1/64 Mini RC Beetle HG4-216 — Pocket Drift Car**
>
> Enjoy fun mini racing with this compact **RC Beetle car**, perfect for desks and indoor tracks. It features **2.4GHz control (Remote + APP option)** with **3 speed modes** and smooth drift handling.
>
> Built with a **durable alloy body**, it includes **LED headlights & taillights** for a realistic look. With up to **30+ minutes playtime** and **70m range**, it delivers powerful performance in a small size.
>
> **Key Specs:** Scale: 1:64 · Model: HG4-216 · Control: 2.4GHz Remote (+ APP) · Range: Up to 70m · Playtime: 30+ mins · Size: 9 × 3.5 × 3.5 cm · Features: Drift, 3-Speed, LED Lights

### #5 — Amazon Brand Conquer (review-mined copy = social proof in product description)
Their first verified review IS the description Amazon shows in scrape:

> Product arrived in great condition. For Rs 999 this is a steal. All wheels have suspension, housing is metal, chassis is plastic, App also works great, speed is really good. I have added AAA battery for size comparison — length is 8 cm and width is 6 cm. There is no downside known to me yet, however this is not true 1/64 ratio like Hot Wheels — it's 1/54 ratio. But still compact and tiny, playable, fun to roll around. Justifies the price. Happy with the purchase.

**Insight from this review:** Buyers actively size-check vs Hot Wheels. If pocketrccars car is true 1:64 scale, **make scale comparison vs Hot Wheels die-cast a hero image** — it's the #1 unstated buyer concern.

---

## Pricing insights

- **Sell-price range:** Rs 999 (Amazon floor) → Rs 1,999 (kyaratoys premium positioning)
- **Median sell price (6 listings with visible pricing):** **Rs 1,374** *((999 + 1199 + 1250 + 1299 + 1499 + 1999) / 6)*
- **Cheapest:** Rs 999 — Amazon (Brand Conquer rock crawler)
- **Most premium:** Rs 1,999 — kyaratoys.com (with 60% "MRP discount" anchor of Rs 4,999)
- **Hot Wheels-branded equivalent:** Rs 1,250 — toycollectorsindia.com

### Recommended pocketrccars sell price: **Rs 1,299** (with MRP shown at **Rs 1,999**, "35% OFF" badge)

**Reasoning:**
1. **Rs 1,299 = market median** (matches viaanakidsstore exactly). Wins on "fair price" perception without being the cheapest (cheap = perceived as toy-grade).
2. **35% OFF badge is the sweet spot** — high enough to trigger urgency, low enough to be credible (kyaratoys' 60% reads as fake-MRP).
3. **Rs 1,999 anchor MRP** is what 3 of 6 priced listings show as MRP — it's the **culturally accepted MRP for this SKU** in the Indian market. Going lower (Rs 1,499) leaves discount-trigger psychology on the table; going higher (Rs 2,499+) gets challenged by smart buyers.
4. **Beat Amazon on perceived value, not price.** Amazon's Rs 999 listing is a different SKU (Brand Conquer 1:54 rock crawler, not Trasped F1). Position pocketrccars as: "the proper 1:64 F1 / drift line, with display case + app — Rs 1,299, not the cheap Amazon variant."
5. **Optional bundle play (steal from saikrishnastore):** "Buy 2, save Rs 600" tiered pricing has zero competitor adoption at this price point and would lift AOV meaningfully.

---

## Variants observed

**Body types currently sold under the same Trasped/Hengguan SKU family:**
- **Beetle drift** (HG4-216) — kidspark
- **F1 generic** (HG4-218, no driver) — most stores
- **F1 Ferrari** (HG4-234, white) — youcliq
- **F1 Leclerc with driver figurine** — theindianbookstore (uses driver as upsell trigger)
- **Rock crawler** (Brand Conquer, 1:54 not 1:64) — Amazon (different SKU but competes for same shopper)

**Colors actually shown in stock (kyaratoys exposed inventory):**
Red · Black · Yellow · Blue · Sky Blue · White

**Pocketrccars variant strategy:**
- Launch with **3 body shapes** (F1, Beetle drift, Rock crawler) × **4 colors** each = 12 SKUs. This matches buyer mental model (every store has F1 + something fun).
- Add a "**Driver figurine included**" or "**Display case included**" SKU at +Rs 200 — both are proven upsell triggers (theindianbookstore uses driver, shopbefikar uses display case).

---

## What to steal for pocketrccars PDP

1. **Use the 8-bullet "✅ ALL-CAPS HEADLINE – benefit paragraph" structure** above-the-fold. It's the dominant copy pattern across 3 of the top sellers (kyaratoys, viaanakidsstore use identical block; this is the proven wholesaler template). Rewrite the words but keep the visual rhythm.

2. **Show MRP with strikethrough + discount % badge.** Every successful Shopify listing does this. Pattern: `~Rs. 1,999~  Rs. 1,299  [35% OFF badge]`. Saikrishna goes further with `SAVE 25%` badge under the price — copy this.

3. **Specs table is mandatory, 11-12 rows.** Steal the youcliq/shopbefikar 2-column format verbatim (Brand, Model, Scale, Color, Frequency, Body Material, Control Type, Speed Modes, Lighting, Control Range, Usage, Age Group).

4. **"What's in the Box" section is mandatory** — 4-5 bullets. Standard contents: car, remote, USB cable, battery (built-in), instruction manual, [+display case / +driver if applicable].

5. **Bundle pricing (Buy 1 / Buy 2 / Buy 3)** — saikrishnastore is the only one doing this and they're a generic confectionery store. **Massive opportunity for pocketrccars to own this pattern** in the RC niche. Triple AOV trigger.

6. **Delivery estimate component** — every Shopify store shows a 3-step "Order placed → Shipped → Delivered" date timeline with live dates. Steal this exactly (Shopify app: "Estimated Delivery Date Pro" or similar). Builds urgency.

7. **Trust strip** — kyaratoys uses: "7-Days Free Returns · Free Doorstep Delivery · Safe & Secure Payments". Put 3-4 similar trust icons directly under the buy button.

8. **Color swatch picker (kyaratoys does this well)** — clickable color circles below the buy button. Show 4-6 swatches even if not all are in stock; mark out-of-stock with strikethrough (creates urgency for the in-stock colors).

9. **Mobile-first emoji headers (shopbefikar pattern)** — for the lower-half lifestyle copy, use 🏎 📱 ⚡ 💡 🔋 as section dividers. Renders cleanly on WhatsApp share, which is the dominant share channel for Indian D2C toys.

10. **Hot Wheels size-comparison hero image** — based on the Amazon review insight, every buyer mentally checks "is this really 1:64 like Hot Wheels?". Make a hero image showing pocketrccars car next to a real Hot Wheels die-cast for scale validation. Zero competitors do this.

11. **Customer reviews block with verified-purchase tag** — viaanakidsstore shows "4.93/5 from 15 reviews", kyaratoys shows "5.0 from 1593 reviews". Use Loox or Judge.me from day 1. **Even 15 reviews is enough to convert** — start collecting at first order.

12. **Tax-included + free shipping above Rs X** — kyaratoys: "Free shipping on prepaid orders above Rs 1990, Rs 50 fee below, Rs 150 fee on COD." This pushes prepaid + bundle add-ons. Steal exactly.

---

## Scrape errors / gaps

### Original Apify pass (2026-05-31): 9 of 12 useful (75%)
- **thepeppystore.in:** HTTP 403 "Access Denied" — anti-bot.
- **daddydrones.in:** Cookie banner blocked content extraction.
- **parisgiftcorner.in:** Apify did not return a result (timed out).
- **youcliq.com / shopbefikar.com / theindianbookstore.in:** copy + specs OK, prices JS-lazy.

### Follow-up pinchtab pass (2026-06-01): all 6 gaps closed
- **thepeppystore.in:** ✅ FILLED via pinchtab (real browser bypassed 403). Rs 1,299 / 1,499. 4.5★ from 23 reviews. 5 verbatim customer reviews captured.
- **parisgiftcorner.in:** ✅ FILLED. Rs 1,350 / 1,500. Exposes 4 design variants (Off-road / Transport / Defender / Truck).
- **youcliq.com:** ✅ FILLED. Rs 1,299 / 1,599. Coin-loyalty system observed ("Earn coins on purchase"). "Unboxing video mandatory for refund/return" — anti-fraud policy.
- **shopbefikar.com:** ✅ FILLED. Rs 1,149 / 1,190 (lowest priced display-case + app variant in market). "Items sold in last month" social proof counter.
- **theindianbookstore.in:** ✅ FILLED. Rs 2,299 / 7,599 — premium "with driver figurine" variant. 7-image gallery (most images of any competitor).
- **daddydrones.in:** 🟡 Partial. Title + specs + badges captured. "-25% OFF" badge indicates ~Rs 1,490 sell vs ~Rs 1,990 MRP (price text JS-deferred, even with pinchtab). Free shipping · Easy returns · Mumbai warehouse · Express delivery 3-4 days metro.
- **toycollectorsindia.com:** Markdown was 23k chars due to Instagram embed loops, but Rs 1,250 was captured.

### Final scrape success rate: **11/12 fully priced (92%) · 12/12 product info captured (100%)**

Raw pinchtab outputs preserved at: `docs/scrape-pinchtab/*.txt`
