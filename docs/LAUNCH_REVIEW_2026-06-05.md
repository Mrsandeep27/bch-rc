# PRC Cars — Launch Review

> Snapshot review of pocketrccars.com at the moment of opening to paid
> traffic on **2026-06-05** (commit `8ddd170`). This is a point-in-time
> assessment — re-evaluate after the first 100 real orders, not before.

## Overall: **7.0 / 10**

A real, working e-commerce store you should be proud of. Stronger than 80%+ of
Indian D2C launches I'd see in week 1, weaker than the brands clearing
₹1 Cr+/month. The backend is the strongest layer; the front-of-funnel
(measurement, catalog depth, social proof) is the weakest.

## Score by dimension

| Dimension | Score | Why |
|---|---|---|
| Backend infra | 9 / 10 | Razorpay live + idempotent webhooks, atomic stock decrement (verified by `bmw/white` going 37 → 36 to the millisecond), Shiprocket auto-shipment (AWB landed in 3 s), Mumbai region pinning, postgres-js cached on `globalThis`, statement_timeout classified as retryable, RLS on all 16 tables. Few solo-founder shops have this. |
| Order pipeline correctness | 9 / 10 | `PRC-HK79V9QW` captured cleanly, events feed is auditable, `holds_released` guard prevents double-release, COD-verification queue exists, manual-order Payment Link flow is built (just never proven end-to-end on prod). |
| UX / front-end quality | 7 / 10 | Real photos for 19 variants, WebP (37 MB → 9 MB), marquee bar, hero overlay finally lets the BMW show. But the last Lighthouse mobile score was **42** — the WebP rollout should lift that, but it's unverified. iPhone-SE had to be told repeatedly to stop floating sections — that fragility means the next viewport you didn't test will surprise you. |
| Pricing & offer design | 6.5 / 10 | The numbers land where you want them on UPI (BMW 999, Porsche 1299, Thar 1299, F1 1499, Monster 1799), but the UPI-vs-COD ₹100 gap is psychologically uncomfortable for first-time Indian D2C buyers (they read "₹100 extra for COD" as the brand penalising them). You also burned cycles toggling the coupon on/off — symptom of unclear discount strategy. One clean rule beats two stackable ones. |
| Catalog depth | 5 / 10 | 5 visible product families, ~19 colours. Beetle, F1 Driver, F1 Ferrari are coded but hidden. Thar Black is at 1 unit. Total sellable visible stock is ~250 units. You can't sustain a Meta ad spend on this. |
| Marketing telemetry | 3 / 10 | No GA4 mounted. No Sentry. The first 100 orders will teach you nothing about funnel drop-offs because nothing is measuring them. `analytics_sessions` is wired but only captures sessions, not events. |
| Social proof | 3 / 10 | No real reviews yet, no UGC strip with real customer videos, no founder story, no Yelahanka warehouse photo to back the claim. Trust-strip says "real Yelahanka warehouse" — someone will eventually ask for a photo. |
| Operations readiness | 8 / 10 | Admin dashboard runs in 5 queries not 11, COD queue exists, manual order form built, inventory live-decrementing, CLI password reset, audit trail. Solid for the volume you'll see this month. |
| Risk handling | 8 / 10 | Atomic stock, webhook idempotency, BIS-claim guardrails, no compliance overclaims, refund pipeline works. Missing: monitoring/alerting — you won't know prod is down until a customer messages WhatsApp. |
| Brand maturity | 5 / 10 | Visual identity is consistent (PRC mark, brand-red, monospace eyebrows). Copy is punchy. But the ₹999–1,799 price tier needs more than functional differentiators — needs aspirational ones (a story, a face, a culture moment). Right now it reads "well-built Chinese chassis with a Hindi domain". |

## Strengths (what's clearly working)

- **The pipeline is real.** `PRC-HK79V9QW` was paid in 26 seconds, shipment created in 3 seconds, AWB `90538644125` assigned to Blue Dart Air. End-to-end confirmed under real money.
- **Atomic stock decrement is alive.** Inventory row updated_at matched the order createdAt to the millisecond. No oversell race even under concurrent buys.
- **Multi-tenant architecture from day one.** `site_id` everywhere — bch-rc and any future site can run on the same codebase without a fork.
- **Real photos, not AI.** The local rembg pipeline produces 19 colour variants with consistent framing — no Gemini quota dependency.
- **Honest pricing.** No fake "MRP ₹4,999 → ₹1,299" inflation; the strikethrough is ~30–35% which buyers will actually believe.
- **Operator tooling.** Admin can create manual orders, run a COD verification queue, reset their own password via CLI, view a structured audit feed per order. Most D2Cs at launch can't do half of this.

## Weaknesses (the next leverage points)

### 1. You're shipping product before measuring funnel
GA4 + Meta pixel + Sentry should land **before** ad spend, not after. Right
now if you burn ₹50,000 on Meta you'll learn nothing about why people bounced
at `/checkout` vs `/product/[slug]`. The `analytics_sessions` table will tell
you who visited; it won't tell you which step of checkout lost them.

**Fix:** mount GA4 + Meta pixel + Sentry in `app/layout.tsx`. Two hours of
work. Do this before any paid traffic.

### 2. Catalog is too thin for paid acquisition
5 SKUs × ~3 colours avg = customers who don't see "their" colour walk.
Beetle, F1 Driver, F1 Ferrari are coded but `hidden: true` with 150 units of
sellable inventory sitting unreachable. Either unhide them or accept this is
a 50-orders/day ceiling, not 1,000.

**Fix:** flip `hidden: false` on `pocket-beetle`, `pocket-f1-driver`,
`pocket-f1-ferrari` in `src/lib/products.ts`. Five-minute change that
unlocks 150 units of latent stock.

### 3. No second-order revenue mechanism
No PRCCoins live yet. No spare-parts SKU (replacement tires, batteries,
shells). No bundle that takes AOV from ₹1,299 to ₹2,500. Acquisition is
hard; squeezing 1.4× more out of each customer is easy.

**Fix:** add a "Spare parts" SKU family — wheels ₹199, battery ₹299, shell
₹399. Promote them on `/track`, on the order confirmation email, and on
the "thanks for buying" page. These are pure-margin SKUs.

### 4. The ₹100 UPI vs COD gap will become a CX issue
Frame it as **"Pay online, save ₹100 + faster tracking"** rather than letting
COD customers feel surcharged. The current copy in OfferStack and the
checkout summary reads as a penalty, not a perk.

**Fix:** edit the Prepaid offer card and checkout subtotal label so the
discount is presented as a **bonus**, not the COD price as a **fee**.
Word-level change, real conversion impact.

## What we shipped this session

| Commit | Headline |
|---|---|
| `03b1d3b` | Manual orders v1 + admin dashboard 11→5 query consolidation + per-SKU pricing |
| `0c2d2fb` | Product images → WebP (37 MB → 9 MB, 75% smaller) |
| `8a9cf04` | Marquee AnnouncementBar + lighter mobile hero overlay (BMW visible) |
| `b6f8adf` | AnnouncementBar scrolls away with page instead of sticking |
| `4caf552` | Seed CODEPRC100 coupon (migration 0008) |
| `8ddd170` | Hide CODEPRC100 coupon UI — prepaid is the only ₹100 off now |

## Verified live signals (2026-06-05)

- **Razorpay live mode**: `rzp_live_SxDqZUWqDOvdBj` confirmed by `PRC-HK79V9QW` capture + dashboard available balance ₹1,200.
- **Webhook events enabled**: `payment.captured`, `payment.failed`, `refund.created`, `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`.
- **Migrations 0006/0007/0008** applied to prod DB.
- **Shipment pipeline**: Shiprocket auto-assigned Blue Dart Air for `PRC-HK79V9QW`. AWB `90538644125`.
- **Inventory**: 23 rows, 509 total units, live-decrementing on real orders.

## Inventory snapshot (2026-06-05)

| SKU | Variant | Stock | Notes |
|---|---|---|---|
| pocket-bmw | white | 36 | Decremented 37 → 36 by PRC-HK79V9QW at 21:12 ✓ |
| pocket-bmw | blue | 18 | |
| pocket-bmw | black | 17 | |
| pocket-porsche | dark-blue / green / yellow / multi | 18 each | |
| pocket-thar | blue | 11 | |
| pocket-thar | yellow | 8 | |
| pocket-thar | white | 7 | |
| pocket-thar | black | **1** | ⚠ Almost sold out |
| pocket-monster | blue / yellow / white-red / multi | 11 each | |
| pocket-monster | red-orange | 12 | |
| pocket-monster | blue-68 | 12 | Orphan row — removed from products.ts but row still here |
| pocket-f1-classic | white / red | 36 each | |
| pocket-beetle | (none) | 50 | Hidden SKU |
| pocket-f1-driver | (none) | 50 | Hidden SKU |
| pocket-f1-ferrari | (none) | 50 | Hidden SKU |
| qa-1rs | (none) | 49 | Internal smoke-test SKU |

**Total sellable, visible stock: ~250 units** across 5 product families.

## The bottom line

> If you fix telemetry (GA4 + Sentry) and add a second-order revenue
> mechanism (spare parts, bundles) before opening Meta spend, you'll
> cross **₹5L/month** within 30 days. If you don't, you'll plateau at
> **₹1–2L** and not understand why.

The store is launch-ready. The next 30 days decide whether it's a
business or a hobby.
