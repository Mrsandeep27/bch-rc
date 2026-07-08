# 1:64 Store — Conversion Gap Report

**Current `1:64` storefront (`/`) audited against *The Landing-Page Conversion Playbook* (62-store teardown, July 2026) + the 12 India D2C benchmarks in `Landing_Page_Pattern_Data.xlsx`.**

> **Scope:** the live homepage funnel — `src/app/page.tsx` and its components. Not the PDP/checkout (noted where relevant).
> **Verdict in one line:** The 1:64 site already executes **~70% of the playbook rigorously**. It is not broken — it is a strong page with a handful of specific, high-ROI leaks. This report names them, ranks them, and points to the exact file to change.

---

## 1. Headline scorecard

| # | Playbook dimension | Status | One-line reason |
|---|---|---|---|
| 1 | Hero (4 questions in one screen) | ⚠️ Weak | Benefit headline + video + 1 CTA all present, but **no star-rating proof above the CTA** |
| 2 | Announcement bar | ✅ Present | Rotating: ships-today → COD → ₹100 prepaid bonus (`copy.ts:97`) |
| 3 | Trust strip (rating + count) | ✅ Present | "★ 4.7 · 12,000+ orders · Featured in @…" (`TrustStrip.tsx:8`) |
| 4 | Value props (icon why-us) | ✅ Present | USB-C / drop-tested / 7-day / Made-in-India (`copy.ts:110`) |
| 5 | Social proof | ⚠️ Weak | UGC + photo reviews ✅, but **no review counts / velocity on product tiles** |
| 6 | Objection handling | ⚠️ Weak | Mini-FAQ + 10-Q FAQ ✅, but **no "vs cheap Amazon toy" comparison**, no spec deep-dive |
| 7 | Offer / AOV | ⚠️ Weak | Free-ship ₹1,099 + bundles + MRP anchor ✅, but **progress bar hidden until cart opens** |
| 8 | Risk reversal | ⚠️ Weak | COD + 7-day + WhatsApp ✅, but **no named guarantee / secure-checkout seal near CTA** |
| 9 | Checkout friction | ✅ Present | Sticky CTA + cart drawer w/ free-ship delta; wallets are checkout-stage only |
| 10 | India-specific | ✅ Strong | COD badge, UPI ₹100 incentive, MRP anchor, WhatsApp FAB |
| 11 | Mobile | ✅ Present | Sticky CTA (44px), lazy-load video/images, snap-scroll lineup |
| 12 | Brand / mission | ❌ Absent | `OurStorySection` **disabled** (`page.tsx:43`) — no founder "why" |
| 13 | Exit-intent capture | ❌ Disabled | `ExitIntentModal` removed (`HomeClientUi.tsx:27`) |
| 14 | Urgency / countdown | ❌ Unused | `LaunchCountdown.tsx` exists but is **not deployed** |

Legend: ✅ solid · ⚠️ present-but-leaking · ❌ missing/disabled.

---

## 2. The Top 10 gaps, ranked by likely conversion impact

> Impact tags are **directional** (based on D2C CRO benchmarks and the playbook), not guarantees. Each should be A/B-tested. "Effort" is rough dev size.

| # | Gap | Impact | Effort | File(s) to change |
|---|---|---|---|---|
| **1** | **No star-rating + review count *above the hero CTA*.** Proof sits *below* the fold; cold Instagram traffic decides in ~3s and bounces before it scrolls. | 🔴 High | S | `Hero.tsx:183–205`, `copy.ts:35` |
| **2** | **Free-shipping progress bar is hidden until the cart drawer opens.** Buyer never learns they're "₹X from free shipping" while still shopping. | 🔴 High | S | `SkuLineup.tsx`, surface logic from `CartDrawer.tsx:44` |
| **3** | **No per-SKU social proof on product tiles.** No "4.8 ★ (320)" or "500+ sold this month" on each card → no per-product FOMO. India benchmark: boAt shows up to **1,468 reviews/SKU**. | 🔴 High | M | `SkuLineup.tsx:97–249` |
| **4** | **Prepaid ₹100 incentive is invisible until checkout.** It exists in pricing (`SkuLineup.tsx:82`) but isn't sold as a *reason to pay online*. India benchmark: boAt `BOATHEAD`, Minimalist "10%+10%", Sugar "App 15%". | 🟠 Med | S | `AnnouncementBar.tsx`, `copy.ts:106` |
| **5** | **Exit-intent capture is off.** No last-chance offer / email-SMS catch on the ~bounce. Brooklinen-style first-order capture is a standard recovery lever. | 🟠 Med | S | re-enable `ExitIntentModal` via `HomeClientUi.tsx:27` |
| **6** | **No "vs" comparison block.** The #1 doubt for a ₹999+ RC car vs a ₹300 Amazon toy is unanswered on-page. India benchmark: The Sleep Company's "SmartGRID vs memory foam". | 🟠 Med | M | new section in `page.tsx` (after `HowToUse`) |
| **7** | **Bundle AOV nudge appears too late.** "Save ₹298 with 1 more car" only shows inside `CartDrawer.tsx:52`. Pull it onto the lineup / sticky bar. India benchmark: tiered multi-buy in the *announcement bar* (Pilgrim, mCaffeine). | 🟠 Med | M | `SkuLineup.tsx`, `BundlePicker.tsx` |
| **8** | **Brand/mission disabled.** No founder story → weaker emotional anchor + repeat/wholesale affinity. Founder identity (Syed Ibrahim) exists in `theme.ts` but isn't told. | 🟡 Low-Med | S | re-enable `OurStorySection` in `page.tsx:43` |
| **9** | **Press is text-only.** "Featured in @daddydrones…" is a scrollable text line, not visual logos → reads weak on mobile. | 🟡 Low | S | `TrustStrip.tsx:8–14` |
| **10** | **No GWP / tier-up incentive.** No "free drift wheels when you buy 2" — a value-add that lifts AOV without discounting (playbook §9). | 🟡 Low | M | `BundlePicker.tsx` / new offer block |

**If you change only three things this week (highest ROI, lowest effort): #1, #2, #4.** They move trust, AOV, and prepaid-mix at once — exactly the "Start here" trio the playbook recommends on its final page, mapped to your code.

---

## 3. India-playbook scorecard (vs the 12 India D2C benchmarks)

The playbook's §12 ("read this twice") is India-specific, and your market is India. Here's how 1:64 stacks up against the India stores in the data (boAt, GIVA, Sugar, The Derma Co, Pilgrim, Minimalist, mCaffeine, Bombay Shaving, etc.):

| India lever | Benchmark example | 1:64 status |
|---|---|---|
| **COD as first-tier trust badge** | The Derma Co: "COD Available" badge front-center | ✅ COD in hero strip + mini-FAQ Q1 |
| **Prepaid incentive to cut RTO** | boAt `BOATHEAD`, Minimalist "10%+10%", Sugar "App 15%" | ⚠️ ₹100 exists in price, **not marketed** (gap #4) |
| **MRP anchoring (40–83% off default)** | boAt "up to 83% off", Sugar "50–73% off" | ✅ Strikethrough MRP + % off on every tile |
| **Tiered multi-buy in announcement bar** | Pilgrim "Buy 2 ₹699/3 ₹999/4 ₹1299", mCaffeine "Buy 2 Get 2 Free" | ⚠️ Bundles exist but **buried in BundlePicker**, not the bar (gap #7) |
| **Heavy review counts** | boAt 1,468/SKU, Pilgrim 7.6k, mCaffeine 3k | ⚠️ Aggregate only; **none per-tile** (gap #3) |
| **Founder / celebrity proof** | Sugar (Vineeta Singh/Shark Tank), GIVA (Kriti Sanon), Pilgrim (Rashmika) | ❌ Founder story disabled (gap #8) |
| **Free-ship threshold (impulse-low)** | Bombay Shaving "₹399" marquee (×18) = "#1 driver" | ✅ ₹1,099 threshold (note: higher because AOV is higher) |
| **Recent-purchase ticker** | Bombay Shaving (GoKwik live ticker) | ⚠️ `SocialProofToast.tsx` exists — **confirm it's wired on home** |
| **Countdown / perpetual urgency** | boAt + mCaffeine sale timers | ❌ `LaunchCountdown` unused |
| **WhatsApp retention rail** | Standard across India D2C | ✅ `WhatsAppFab` with pre-fill |
| **App-style bottom nav** | boAt, Derma Co, mCaffeine | ❌ Not present (lower priority for a single-catalogue store) |
| **OTP login** | Pilgrim | ❌ Not present (checkout-stage consideration) |

**Net:** Your India fundamentals (COD, MRP anchor, WhatsApp) are **strong**. The India-flavoured gaps are all in the *prepaid-mix* and *social-proof-volume* dimensions — the same things the India winners over-build.

---

## 4. What the 1:64 site does genuinely well (don't touch these)

- **Hero discipline** — one benefit headline, one dominant video, one primary CTA, UTM-variant copy (`Hero.tsx:31`). Textbook.
- **Objection-first ordering** — money/RTO/COD objections lead the FAQ deliberately (`faqs.ts:4`). Correct for India.
- **Performance** — edge-cacheable ISR (`revalidate: 3600`), lazy-loaded below-fold chunks, `prefers-reduced-motion` respected. This *is* a conversion feature (playbook §11.3: every second of load cuts conversion).
- **Mobile-native** — sticky CTA, 44px targets, snap-scroll lineup, WhatsApp-first support.
- **Honest pricing** — real MRP anchors and a real prepaid discount (not phantom codes; the team already removed a phantom `DRIFT100` — good instinct, matches playbook §4.4 "fake offers erode trust").

---

## 5. How to act on this

**Tier A — this week (small, high ROI):** Gaps #1, #2, #4 — rating in hero, visible free-ship progress, prepaid incentive in the bar.
**Tier B — next sprint (medium):** Gaps #3, #6, #7 — per-tile review counts, a "vs cheap toy" block, earlier bundle nudge.
**Tier C — when capacity allows:** Gaps #5, #8, #9, #10 — re-enable exit-intent, founder story, visual press logos, a GWP tier.

Every item above is A/B-testable in isolation (playbook §13.H: change one variable, watch the matching metric).

---

*Companion docs: [1:16 Landing-Page Plan](1-16-Landing-Page-Plan.md) · [D2C Shopify High-Conversion Brands research](D2C-Shopify-High-Conversion-Brands.md). Source: Landing_Page_Conversion_Playbook.pdf + Landing_Page_Pattern_Data.xlsx (62 stores), audited against live code in `src/app/page.tsx` + `src/components/*` on 2026-07-01.*
