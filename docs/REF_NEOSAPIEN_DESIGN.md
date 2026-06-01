# neosapien.xyz — Design Reference

> Scraped via Apify Playwright on 2026-05-31. Source: https://neosapien.xyz/
> Subpages crawled: `/`, `/b/what-is-neosapien`, `/about`, `/contact`, `/terms-and-conditions`, `/policies`
> Purpose: extract patterns to steal for pocketrccars.com (single-hero, story-driven, narrow-funnel D2C site).

---

## Overall page structure

NeoSapien is a single-product D2C site (one SKU: "Neo 1" wearable AI). The homepage is a long-scroll narrative that pre-sells the product before pushing to a checkout/pre-order URL. Top-to-bottom sections on the homepage:

1. **Top announcement strip / "Next" cta** — a small dismissable bar (cancel icon + "Next" link).
2. **Hero: "Your wearable AI assistant to turn conversations into actions."** — H1 + autoplay product video.
3. **Sub-hero: "Introducing Neo 1"** — short intent paragraph + autoplay product film.
4. **"superhuman starts here"** — short CTA-style headline: "Get your Neo 1 and level up to Mind 2.0."
5. **"Built To Make You Superhuman"** — 4-tile feature carousel, **each tile is an autoplay video** of the product in use:
   - Capture offline conversations efficiently
   - Never Miss What Matters
   - Commit With Confidence
   - Your AI Virtual Assistant
6. **Product attribute grid (4 image tiles)** — purely visual benefit pillars:
   - Sleek and Stylish
   - Advanced AI Tech
   - Light & Mighty
   - 2-3 Days Battery
7. **"Your AI Ally, At Your Fingertips"** — single horizontal banner image, body copy: "Access meeting summaries, make faster decisions, brainstorm with your AI ally, and always be prepared."
8. **"Latest News on Neo 1"** — press logo strip (social proof).
9. **FAQ accordion** — 11 questions, all expanded in scrape: shipping time, iOS/Android, security, recording vs transcription, offline, water resistance, chain included, battery life, international shipping, invoice.
10. **(Footer)** — policies, terms, about, contact pages exist as separate routes.

A separate `/b/what-is-neosapien` long-form page exists for SEO + objection handling (privacy, "is it always listening", consent, legal framework, device basics).

---

## Hero section

**H1 (exact):** *Your wearable AI assistant to turn conversations into actions.*

**Sub-headline (H2):** *Introducing Neo 1*

**Body under sub-headline:**
> Neo 1 transcribes in real time, summarises what matters, and reminds you to follow through.
> No recordings. Only transcription.

**Meta description (used across all pages):**
> India's first AI-Native wearable that tracks conversations and analyses emotions, unlocking unlimited memory to make you Superhuman.

**Visual approach:**
- Autoplay product video (no controls visible) immediately under H1, no static hero image.
- Speaker icon overlay on video (audio toggle).
- No "Buy now" button in the visible scrape — primary CTA appears to be inline within copy ("Get your Neo 1") and likely a sticky/pop element.
- Mobile-first dismissable announcement bar pattern at top ("cancelIcon" + "Next" link).

---

## Path to purchase (3-click flow)

NeoSapien's funnel is unusually **content-heavy before checkout** because the product is a Rs 12k+ wearable that needs education. Their click path:

1. **Click 1 — Land on homepage** → autoplay hero video does the explaining.
2. **Click 2 — Scroll-triggered desire** → "superhuman starts here / Get your Neo 1 and level up to Mind 2.0" headline functions as an embedded CTA. The 4 autoplay-video feature tiles ("Capture offline / Never Miss / Commit / AI Assistant") burn 30-60s of intent-building before user reaches an actual purchase trigger.
3. **Click 3 — Purchase** → Pre-order / cart link (likely sticky header or after the FAQ).

Note: the page is designed to **delay the buy click** until the user has watched 3-4 short product films. This is the opposite of a one-product Shopify page (which typically puts the buy box above the fold). For pocketrccars.com, this is a strong reference if we want to **build perceived value** for a Rs 999-1999 mini RC car — but we should compress, not copy 1:1, because the price doesn't justify a 6-section scroll.

---

## Sections breakdown

### 1. Hero (videos as the proof)
- Purpose: communicate "this is a real product, here's what it looks like in use"
- Copy: 1 H1 + 2 sub-paragraphs
- Visual: 2 autoplay videos (intro film + product film)

### 2. Outcomes carousel ("Built To Make You Superhuman")
- Purpose: show **use cases**, not specs
- Copy: 4 short benefit phrases (3-4 words each)
- Visual: 4 looping videos, one per tile
- Pattern: each tile = video + caption. **No icons, no bullets, no text-only feature lists.**

### 3. Product attribute grid (4 webp images)
- Purpose: communicate **physical specs as adjectives**, not numbers
- Copy: "Sleek and Stylish / Advanced AI Tech / Light & Mighty / 2-3 Days Battery"
- Visual: 4 lifestyle/product photos
- Smart move: only 1 of 4 is a real spec ("2-3 Days Battery"). The rest are vibes.

### 4. AI Ally banner
- Purpose: single horizontal image + benefit copy
- Copy: outcome-led ("Access meeting summaries, make faster decisions, brainstorm with your AI ally, and always be prepared")
- Pattern: this is a long, scroll-stopping banner — the visual breathing-room moment.

### 5. Press strip ("Latest News on Neo 1")
- Purpose: 3rd-party validation (logos of publications that covered them)

### 6. FAQ accordion
- Purpose: kill purchase objections before checkout
- 11 questions, all very tactical: shipping ("2-3 business days"), platform compat, security ("encrypted in transit and at rest"), recording policy ("only transcribes, no audio stored"), water resistance, battery life, international shipping ("no"), invoice ("yes, by email").
- Tone: short, factual answers. No marketing fluff in FAQ.

### 7. /b/what-is-neosapien (long-form explainer for SEO + skeptics)
- Separate URL with JSON-LD `BlogPosting` schema.
- Sections include: "Where does the data go", "Is NeoSapien always listening", "How does NeoSapien work with the legal framework in India", "Device basics".
- This is the **objection-killer page** for buyers who Google "is neosapien legal in India" or "neosapien privacy".

---

## Color + typography cues

The scraped HTML was processed through readability (Apify strips most class names and inline styles), so direct color-token extraction wasn't possible. Observable cues:

- **Image style:** glossy product webp files (`productNeo.webp`, `advancedAi.webp`, `lightAndMighty.webp`, `battery.webp`) suggest a dark/premium aesthetic with on-product highlights.
- **Video-first approach:** the site is built around `.mp4` autoplay clips, not static product shots. Total of **6+ videos** on the homepage alone.
- **Iconography:** custom SVG icons hosted on their own CDN (`cdn.neosapien.xyz/website/images/accordion/accordionPlus.svg`) — they own their visual system.
- **Brand:** "NeoSapien" + "Neo 1" are used together; product is "Neo 1", brand is "NeoSapien".
- **Tone words used repeatedly:** *Superhuman, Mind 2.0, AI Ally, AI-Native, Wearable, transcribe, summarise, follow through.*

---

## Patterns to steal for pocketrccars

1. **Lead with a video, not a static hero image.** Use a 5-second autoplay clip of the mini RC car drifting on a desk or carpet. Mute by default with a speaker toggle (NeoSapien pattern). This is the single biggest differentiator vs all 12 Indian competitor pages (which use static images).

2. **Outcome-led 4-tile feature row, each tile = short looping video.** Don't say "1:64 scale alloy body." Say "Drift on any surface" / "Fits in your palm" / "USB-C in 30 minutes" / "Race with 3 friends" — each as a 4-6 second clip.

3. **Convert specs into adjectives in a separate image grid.** NeoSapien turns "lightweight ~30g lithium battery, 2 days standby" into "Light & Mighty / 2-3 Days Battery." For RC: "Built Tough / 1:64 Premium Alloy / Drift-Tuned / Charges Fast" — 4 webp tiles, no numbers.

4. **One-product-one-page narrative** instead of a Shopify catalog grid. Even though pocketrccars could list multiple SKUs, the homepage should treat the hero SKU as **the** product and push everything else to /shop.

5. **FAQ at the bottom kills 80% of pre-purchase support tickets.** Steal the structure exactly: 8-12 short Q&As covering shipping time (set expectation: "2-3 business days"), warranty, battery life, charging time, compatible age, replacement parts, return policy, international shipping. NeoSapien's FAQ tone is **short and factual** — no marketing voice.

6. **Long-form `/what-is-X` page for SEO.** Create `/blog/what-is-a-1-64-rc-car` to capture top-of-funnel search traffic. Use JSON-LD BlogPosting schema (NeoSapien does). Address every objection: "is it really controllable?", "what scale is this?", "what's the difference vs a die-cast?", "can adults play with this?".

7. **Press-logo strip even if it's small.** NeoSapien dedicates a section to "Latest News on Neo 1". Pocketrccars can use Instagram/YouTube creator clips, Amazon review screenshots, or a single "As seen on Reddit r/IndianRCcars" line — the visual cue of validation matters more than the actual brand list.

---

## Patterns to skip

1. **Don't copy the 6-section scroll.** NeoSapien sells a Rs 12-20k wearable that needs education. A Rs 999 RC car cannot justify forcing the user through 6 sections before they see "Add to cart." Compress to: hero video → 4-tile outcomes → buy box → FAQ → footer. Buy box must be visible by scroll position 2 (~70% viewport).

2. **Don't use the "Mind 2.0 / Superhuman" abstraction language.** NeoSapien's audience is professionals buying productivity tools. Pocketrccars buyers are parents + 13-30 year old hobbyists looking for fun. Use concrete language: "Drift it. Race it. Fits in your pocket." Not "Level up to Speed 2.0."

3. **Don't hide pricing.** NeoSapien delays the buy CTA because they're pre-order/lead-gen flavored. Pocketrccars must show the price within 1 viewport scroll — this is a transactional category where the **price + discount badge is itself the conversion trigger** (see competitor data in `REF_1_64_COMPETITOR_PRODUCTS.md`).
