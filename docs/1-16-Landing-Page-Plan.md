# 1:16 Landing Page — Redesign Plan & Section Flow

**A conversion-first rebuild of the `/16` storefront, derived from *The Landing-Page Conversion Playbook* (62-store teardown) + the D2C high-conversion research + the live 1:16 code inventory.**

> **Companion HTML mockup:** `public/mockup/1-16-redesign.html` — open it in a browser (or via `next dev` at `/mockup/1-16-redesign.html`) to see this plan rendered. **Review the HTML first; we iterate on it before writing any React.**
> Companion docs: [1:64 Gap Report](1-64-Conversion-Gap-Report.md) · [D2C research](D2C-Shopify-High-Conversion-Brands.md).

---

## 1. The core strategic insight (why 1:16 ≠ 1:64)

The D2C research proved one thing above all: **conversion tracks price point.** Sub-₹60 / low-AOV stores convert ~4.6%; ₹200+ / high-AOV stores convert ~0.95%. Your two stores sit on opposite sides of that line:

| | **1:64 (main)** | **1:16 (this redesign)** |
|---|---|---|
| Entry price | ₹999 | **₹2,699–3,599** (≈3× higher) |
| Buyer mindset | **Impulse** ("why not, it's cheap") | **Considered** ("is this worth ₹3K?") |
| What wins the sale | Low price + desire | **Trust + proof + objection-handling** |
| Playbook lever to over-build | Speed to cart | **Risk-reversal, education, social proof** |

**Therefore the 1:16 page must do MORE persuasion work, not less.** The playbook says exactly this on its Bharath-Cycle-Hub page: *"Cycling is a considered purchase — lean hard on education/comparison (like The Sleep Company's 'vs' block), reviews with photos, and a visible warranty/returns promise."* The same applies to a ₹3K RC car. The current `/16` page is shorter and lighter than `/` — that's backwards for the higher-priced product.

**Design equation (playbook §2):** `Likelihood to buy = (Desire × Trust) − (Friction + Risk)`. The current 1:16 page nails **Desire** ("Send it sideways" + sunset hero) but under-invests in **Trust** (no ratings/reviews shown) and **Risk reduction** (no named guarantee, no comparison). This redesign rebalances toward Trust and Risk-reversal while keeping the desire intact.

---

## 2. The ideal 1:16 section flow

Each section has **one job**. Status legend: **KEEP** (exists, leave) · **ENHANCE** (exists, upgrade) · **UNHIDE** (built but commented out) · **NEW** (build it) · **REUSE** (port the 1:64 component, re-themed).

| # | Section | Status | Its ONE job | Key change / copy direction |
|---|---|---|---|---|
| 0 | **Announcement bar** | NEW (reuse `AnnouncementBar`) | Carry the active incentive | Rotating: "Pay online → save ₹300" · "COD pan-India" · "Ships in 24h from Bangalore" · "7-day replacement". *Prepaid incentive front (India RTO lever).* |
| 1 | **Header16** | KEEP + tweak | Navigate + reassure | Add a tiny "★ 4.8" chip next to logo; keep WhatsApp + cart + Sizes pill. |
| 2 | **Hero16** | ENHANCE | One promise, one feeling, one CTA | Keep "Send it sideways." + sunset Dares photo. **ADD inline proof chip** (★ 4.8 · 1,200+ drifters) and a **risk micro-badge** (7-day replacement) right by the "from ₹2,899" chip. Optional: click-to-play 8-sec demo. |
| 3 | **Trust strip** | NEW (reuse `TrustStrip`) | Make the brand instantly credible | "★ 4.8 · 1,200+ 1:16 owners · 12,000+ orders across PRC · COD · UPI/Cards · Ships from Bangalore." Payment-method icons here. |
| 4 | **Shop by size** | KEEP | Category front-door | Already shared & good. Reinforces "you picked the big one." |
| 5 | **Mini-FAQ (3 cards)** | KEEP | Kill the top-3 doubts at the decision pixel | COD? / Size? / Breaks? — already strong. |
| 6 | **Value-stack + price anchor** | NEW (reuse `ValueStack`) | Justify the ₹3K | Visual "what's in the box" stack (car · 2.4 GHz remote · battery + USB-C · spare tyre set · drift cones · screwdriver) **totalled vs price**, and anchor: *"Hobby-grade 1:16 elsewhere ₹5,000+ → yours from ₹2,699."* **This is the #1 new section for a considered purchase.** |
| 7 | **Spec marquee** | KEEP | Tech reassurance | 1:16 · proportional steer · 4WD · 2.4 GHz · rubber tyres · USB-C · Made in India. |
| 8 | **Lineup (6 cars)** | ENHANCE | Easiest first purchase | **ADD per-card:** ★ rating + review count, a "Most popular"/"Flagship" badge, honest stock signal where true, free-ship/prepaid note. Keep dual pricing + % off + colour swatch. |
| 9 | **"Why 1:16 — vs a cheap toy"** | NEW | Convert the skeptic (education) | The Sleep-Company "vs" block. Columns: **₹800 toy RC** vs **1:64 pocket** vs **1:16 PRC** across size, steering (on/off vs proportional), drivetrain (2WD vs 4WD), tyres (plastic vs rubber), battery (AA vs USB-C), support (none vs 7-day + WhatsApp). |
| 10 | **Customer reviews (photos)** | UNHIDE (`CustomerReviews16`) | Convert with real buyers | 16 real buyer photos already built — turn them on. Add the aggregate "★ 4.8 from 1,200+." |
| 11 | **See it in action (video)** | NEW (use `BoxVideo16`/reels) | Show the product moving | A demo reel / box-open video — desire + proof that it really drifts. |
| 12 | **#PRC on Insta (UGC)** | KEEP | Community belonging | Already good. Tag-to-be-featured loop. |
| 13 | **Slide gallery** | KEEP | Visual delight | Scroll-reveal grid. |
| 14 | **How to use** | KEEP | Lower "is it hard?" friction | Charge it · Send it · Repeat. |
| 15 | **Offer / bundle (AOV)** | UNHIDE + UPGRADE | Raise the basket | Replace "message us for combo rate" with a **concrete tier**: "Buy 2 → save ₹500" + a **GWP** ("free spare tyre set + drift cones with any 2"). Real offer, not a DM. |
| 16 | **Risk-reversal block** | NEW | Remove the last brake | Dedicated band: **7-day replacement · COD pan-India · secure UPI/card · ships in 24h · WhatsApp support · Made in India.** Name it ("The PRC promise"). |
| 17 | **Built in Bangalore (mini-story)** | NEW (reuse `OurStorySection`) | Belonging + trust | Short founder/warehouse note — "real humans in Bangalore pack and ship these." Counters "is this a dropship scam?" |
| 18 | **FAQ (expand 4 → 8)** | ENHANCE | Kill remaining doubts | Add: ship time, warranty detail, spare-parts availability, age suitability, charge/run time, is-online-payment-safe. |
| 19 | **Final CTA** | KEEP | Last push | "Stop scrolling. Start sliding." |
| 20 | **Footer16** | KEEP | Don't lose non-buyers | Contact, policies, GSTIN, ships-from. |
| — | **Sticky mobile CTA** | NEW (reuse `StickyMobileCTA`) | Always-one-tap-to-buy | Appears past hero; shows hero SKU + price + "Buy now". Big mobile-conversion lever. |
| — | **WhatsApp FAB** | NEW (reuse `WhatsAppFab`) | Retention/support rail | Currently only in nav — make it a floating button. |
| — | **Cart drawer w/ free-ship progress** | ENHANCE (`CartDrawer16`) | Frictionless cart + AOV nudge | Add the "₹X from free shipping" + "add 1 more, save ₹500" nudges. |
| — | **Exit-intent capture** | NEW (optional) | Catch the bounce | First-order incentive or WhatsApp catch. Gate behind A/B. |

---

## 3. Offer & AOV architecture for 1:16

Because AOV is the hidden conversion driver, engineer the basket deliberately (playbook §9):

1. **Prepaid incentive (lead lever):** "Pay online → save ₹300" — already in pricing, now *marketed* in the bar + trust strip + each card. Shifts COD→UPI, cutting RTO loss (India §12.1).
2. **Free-shipping threshold + progress bar:** Confirm threshold (₹1,099 is below 1:16 price, so *every* 1:16 order already ships free — say so: **"Free shipping, always"** is simpler and stronger than a progress bar here).
3. **Bundle tier (concrete):** "Buy 2 → save ₹500" (replace the vague "message us"). Tiered if viable (2 → ₹500, 3 → ₹900).
4. **GWP:** "Free spare tyre set + drift cones with any 2 cars" — adds value without discounting (protects brand/margin, playbook §9 rule).
5. **Cross-sell on PDP/cart:** spare battery, extra tyres, LED upgrade as low-ticket add-ons.

---

## 4. Trust & risk-reversal plan (the highest-leverage upgrade)

The current 1:16 page shows **zero** ratings/reviews and **no named guarantee**. For a ₹3K purchase this is the biggest leak. Fixes:

- **Show the rating everywhere:** hero chip, trust strip, every product card, reviews section. (You already have 16 real buyer photos built — `CustomerReviews16`.)
- **Name the guarantee:** "7-day replacement, no questions" near every CTA + a dedicated risk-reversal band.
- **Payment trust:** show UPI / RuPay / GPay / Cards / COD icons (The Derma Co pattern).
- **Authenticity cues:** "Made in India · packed & shipped from Bangalore · GST invoice" (counters dropship-scam fear — a real India D2C concern, cf. Sugar's anti-fraud disclaimer).
- **Education = trust:** the "vs cheap toy" comparison reframes the price as *value*, not cost.

---

## 5. Mobile & India specifics (70–80% of traffic)

- **Sticky mobile buy bar** (new for 1:16) — single biggest mobile lever per playbook §6.
- **WhatsApp FAB** (float it).
- **Prepaid nudge** in the bar; **COD as first-tier badge** (keep).
- **App-style considerations:** the existing header Sizes pill is good; a full bottom-nav is optional (lower priority for a single-catalogue store).
- **Fast & light:** keep the lazy-load discipline the 1:64 page already uses.

---

## 6. Component reuse map (build cost is low)

Most of this is **porting existing, proven 1:64 components** into the `.store-16` theme — not net-new engineering:

| Need | Reuse from 1:64 | New build |
|---|---|---|
| Announcement bar | `AnnouncementBar` | re-theme + 1:16 copy |
| Trust strip | `TrustStrip` | 1:16 numbers |
| Value-stack | `ValueStack` | 1:16 box contents + anchor |
| Sticky CTA | `StickyMobileCTA` | wire to `useCart16` |
| WhatsApp FAB | `WhatsAppFab` | already store-aware |
| Founder story | `OurStorySection` | Bangalore copy |
| Exit-intent | `ExitIntentModal` | optional |
| Reviews | `CustomerReviews16` (built, hidden) | just unhide |
| UGC | `UgcGrid16` (built, hidden) | just unhide |
| "vs" comparison | — | **net-new** (small) |
| Risk-reversal band | — | **net-new** (small) |

**Net-new work is small:** the "vs" comparison, the risk-reversal band, per-card ratings, and the concrete bundle/GWP. Everything else is re-theming components you already ship on `/`.

---

## 7. Suggested phasing

- **Phase 1 (trust & proof — biggest ROI):** announcement bar, hero proof chip, trust strip, unhide reviews, per-card ratings, named risk-reversal band, sticky mobile CTA + WhatsApp FAB.
- **Phase 2 (education & AOV):** value-stack + price anchor, "vs cheap toy" comparison, concrete bundle + GWP, expanded FAQ.
- **Phase 3 (polish & recovery):** demo video, founder/Bangalore story, exit-intent (A/B), social-proof toast.

---

## 8. Open decisions for you (let's lock these on the HTML review)

1. **Ratings:** Do you have real aggregate numbers (rating + count) for 1:16, or should we show "PRC" totals (12,000+ orders) until 1:16 reviews accrue? *(I will NOT invent a fake star number — see honesty note.)*
2. **Bundle math:** Confirm the real "buy 2" saving (₹500? other?) and whether a GWP (free tyres/cones) is feasible on margin.
3. **Stock signals:** Only show "low stock" if it's true — do you want honest scarcity wired to inventory, or skip it?
4. **Demo video:** Do we have an 8–15s drift clip / box-open we can use for hero + "in action"?
5. **Comparison block:** OK to name the contrast as "a typical ₹800 toy RC" (generic, not a named competitor)?

> **Honesty guardrail:** every number on the page (rating, review count, "X owners", "save ₹Y") must be real. The mockup uses **clearly-labelled placeholders** for any figure you haven't confirmed — we replace them with true values before launch. Fake ratings/scarcity are the one thing the playbook says will collapse all the trust the page builds (§4.4, §5).

---

*Plan generated 2026-07-01 from Landing_Page_Conversion_Playbook.pdf + Landing_Page_Pattern_Data.xlsx + live code in `src/app/16/` & `src/components/store16/`. Next step: review the HTML mockup and mark it up.*
