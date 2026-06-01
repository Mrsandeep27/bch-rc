# BCH RC — BUILD SPEC
**What we need to make**
**For:** Syed Ibrahim · Bharath Cycle Hub (Bangalore)
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind · shadcn/ui · Vercel
**Compiled:** 2026-05-27

---

## 0 · ONE-LINER

A single Next.js app on Vercel hosting **two connected sites**:
1. A consumer landing page that converts Instagram-reel traffic to orders in under 90 seconds.
2. A retailer portal that auto-verifies GSTINs and unlocks bulk pricing.

Target: **500–1,000 paid orders/day** at scale.

---

## 1 · WHAT GETS BUILT

### 1.1 Consumer landing page (`/rc`)

Single-page scroll. Mobile-first. 15 sections in order.

| # | Section | Job |
|---|---------|-----|
| 1 | Announcement bar (sticky top) | Surface offer above hero |
| 2 | Hero (video loop + H1 + CTA) | Stop scroll + price + CTA in one thumb-screen |
| 3 | Trust strip | "★ 4.7 · 12,000+ orders" |
| 4 | USP icon row (4 icons) | USB-C · drop-tested · BIS · Made in India |
| 5 | SKU lineup (3 cards) | Storm Mini ₹799 · **Storm ₹1,199 (hero)** · Storm Pro ₹1,499 |
| 6 | Offer stack | Free wheels · ₹100 prepaid off · Buy-2 bundle · LED+smoke upgrade |
| 7 | Audience blocks (3) | Gifting · Parenting (car-ride + screen-time) · Enthusiast |
| 8 | What's in the box + specs table | Kills "is it worth ₹999?" objection |
| 9 | Demo video | Full-width drift loop |
| 10 | Review wall (Daddy Drones pattern) | Counter + Judge.me aggregate + named reviews carousel |
| 11 | UGC grid | 12+ shoppable Instagram reels |
| 12 | FAQ (10 questions) | Kill cart-blocking doubts |
| 13 | Wholesale bridge | Banner → `/wholesale` |
| 14 | Final CTA strip | Last conversion attempt |
| 15 | Footer | Trust receipts, policies, payment icons |
| Float | Sticky bottom CTA bar | Mobile always-visible Add to Cart |
| Float | WhatsApp FAB | `wa.me` deep link, bottom-right |

**Hero variants** (UTM-driven, 6 versions):
- `ig_gift` → "The Gift Every Car Guy Melts Over"
- `ig_couple` → "Bata bhi nahi paayegi, smile rok bhi nahi paayega"
- `ig_parent` → "Swap His Screen Time for Real Play"
- `ig_carride` → "The Toy That Survives the Back Seat"
- `yt_drift` / `ig_drift` → "1:24 Drift. 4WD. Gyro. Yours for ₹1,499."
- Default → "Mini RC Drift Cars from ₹799"

### 1.2 Wholesale portal (`/wholesale`)

| Route | Job |
|-------|-----|
| `/wholesale` | Public catalog with prices gated — "🔒 Login for trade pricing" on each card |
| `/wholesale/register` | 5-field form: mobile · name · email · GSTIN · firm name |
| `/wholesale/login` | Mobile + SMS OTP only (no passwords) |
| `/wholesale/catalog` | Logged-in table view: 3 SKUs × 3 tiers (12/48/144 pcs) with per-unit + margin shown |

**Registration flow:**
```
Submit form
  → GSTIN API call (GSTZen, ~5 sec)
    → ACTIVE + name match ≥80%   → SMS OTP → instant unlock (80% of cases)
    → ACTIVE + name mismatch     → Manual review, 24-hr WhatsApp (15%)
    → INACTIVE / API_FAILURE     → Reject + retry CTA (5%)
```

**Bulk pricing ladder (all 3 SKUs):**

| Tier | MOQ (mixed across SKUs) | Discount off MRP |
|------|-------------------------|------------------|
| Starter | 12 units | 35% off MRP |
| Standard | 48 units | 45% off MRP |
| Distributor | 144+ units | 52% off MRP |

### 1.3 Cart + checkout (consumer)

| Route | Job |
|-------|-----|
| `/cart` | Drawer overlay (not full page) |
| `/checkout` | Razorpay Magic Checkout — 1-click, UPI Intent default, COD with SMS OTP gating |
| `/track` | Order tracking by phone + OTP |
| `/orders/[id]` | Order confirmation page |

### 1.4 Ops dashboard (internal, gated)

| Route | Job |
|-------|-----|
| `/ops/cod-confirm` | Surfaces new COD orders + "Open WhatsApp Web" button per order (pre-filled message) |
| `/ops/retailers` | New retailer registrations needing manual welcome ping |
| `/ops/carts` | Abandoned carts worth manual recovery |

This exists because no WhatsApp BSP — ops team manages WhatsApp Web manually.

---

## 2 · DATA MODEL

### Tables (Vercel Postgres / Neon)

```
products
  id · sku · scale · name · mrp_inr · retail_inr · landing_cost_inr
  bullets[] · images[] · body_shape · badge · in_stock

orders
  id · user_phone · user_email · items_json · subtotal · shipping · gst
  payment_method (UPI/COD) · payment_status · razorpay_id
  cod_otp_verified · cod_confirmed_at · cod_confirmed_by (ops_user_id)
  shipping_address · pincode · awb · courier · edd · delivered_at
  utm_source · utm_medium · utm_campaign · created_at

retailers
  id · firm_name · contact_name · mobile (unique) · email
  gstin (unique) · gstin_legal_name · gstin_state · gstin_status · verified_at
  tier_unlocked (starter/standard/distributor)
  total_orders · total_spend · last_order_at · terms_accepted_at

retailer_orders
  id · retailer_id · items_json · subtotal · freight · gst · total
  payment_terms · payment_received_at · dispatched_at · awb

reviews
  id · order_id · rating · text · photo_url · verified · created_at

cart_sessions
  id · phone (nullable) · items_json · abandoned_at · recovered_at
```

### Uniqueness constraints
- One retailer account per GSTIN
- One COD order per phone in 24hr window (anti-abuse)

---

## 3 · INTEGRATIONS

| Provider | What it does | Status |
|----------|--------------|--------|
| **Razorpay Magic Checkout** | 1-click payment, UPI Intent, COD OTP gating | Locked |
| **Razorpay SMS OTP / MSG91** | OTP for COD + retailer login | Locked |
| **GSTZen** (~₹0.70/call) | GSTIN auto-verify | Locked |
| **Cloudflare Turnstile** | Anti-bot on forms | Free |
| **Shiprocket** | Courier routing + EDD + Smart COD blocking | Locked |
| **Judge.me** | Reviews widget (free tier) | Locked |
| **Manychat for Instagram** | Comment-to-DM bridge (`Comment "RC" → DM the link`) | Locked |
| **Meta Pixel + CAPI** | Ad attribution post-cookie | Locked |
| **GA4 + Microsoft Clarity** | Analytics + heatmaps | Locked |
| **WhatsApp BSP** | ❌ NOT in scope — direct `wa.me` deep links only, ops handles manually | Re-evaluate at 200 orders/day |

---

## 4 · SKUs (locked)

| SKU | Scale | Landing cost | Retail | MRP | BCH margin |
|-----|-------|--------------|--------|-----|------------|
| Storm Mini | 1:64 | ₹500 | ₹799 | ₹1,499 | ~₹165 |
| **Storm** ⭐ | 1:43 | ₹650 | ₹1,199 | ₹2,499 | ~₹419 |
| Storm Pro | 1:24 | ₹800 | ₹1,499 | ₹2,999 | ~₹565 |

Margins are after ₹85 shipping + ₹25 packaging + 2% gateway. Before ad spend + RTO leakage.

---

## 5 · KPI TARGETS

| Tier | Metric | Target |
|------|--------|--------|
| North star | Daily paid orders | 500 → 1,000 |
| Primary | Conversion rate (mobile, IG referral) | ≥ 4.5% |
| Primary | Blended ad ROAS | ≥ 3.0× by Month 3 |
| Secondary | AOV | ≥ ₹1,250 |
| Secondary | Prepaid share | ≥ 45% |
| Secondary | Blended RTO | ≤ 18% |
| Health | LCP (mobile, 4G) | ≤ 2.5 s |
| Health | Cart-to-checkout completion | ≥ 65% |

---

## 6 · BUILD PHASES

| Phase | Scope | Sessions |
|-------|-------|----------|
| **Phase 1** | Scaffold + consumer landing page (all 15 sections, static product data, Zustand cart, UTM-driven hero, sticky CTA, WhatsApp FAB) | 2–3 |
| **Phase 2** | Wholesale flow UI + cart drawer + Razorpay Magic test integration | 1–2 |
| **Phase 3** | Vercel Postgres schema + NextAuth (mobile OTP via MSG91) + GSTZen live API + Shiprocket webhook | 2 |
| **Phase 4** | Ops dashboard + Judge.me widget + Meta Pixel + GA4 + Clarity + LCP pass + launch QA | 1 |

**Total: 7–8 focused sessions to launch-ready.**

---

## 7 · ASSETS NEEDED (from Syed)

| Asset | Spec | Owner |
|-------|------|-------|
| Hero loop video | 9:16 mobile + 16:9 desktop · HLS + MP4 · 10–12s · ≤280 KB initial segment | Studio shoot, Bangalore basement |
| 3 SKU hero shots | 1500×1500 WebP q90, white-bg | Studio |
| 3 SKU flat-lay shots (all components laid flat) | 1500×1200 WebP q90 | Studio |
| 3 SKU lifestyle shots (in-use, kid + adult) | 1500×1500 WebP q85 | UGC + studio |
| 3 scale-vs-hand shots | 1500×1500 WebP q85 | Studio |
| Demo drift video (full-width section) | 1080p MP4 · 15–25s · looped · muted | Studio |
| 4 custom USP icons (SVG, brand-red) | Inline SVG | Designer |
| OG image (social share unfurl) | 1200×630 PNG | Designer |
| Favicon | 32×32 ICO + 192/512 PNG | Designer |
| UGC seed (12 IG reels) | Embedded oEmbed | Compile from existing 8-account network |
| Review seed (30 buyer reviews + photos) | 800×800 + 100–150 word quote | Soft-launch to 50 friends/family at 50% off |

---

## 8 · COPY (already locked)

Every literal string for the page lives in **`RC_LANDING_PAGE_COPY.md`**:
- Hero headlines × 6 UTM variants
- All section copy
- SKU card content
- FAQ × 10
- Footer
- Transactional SMS bank (T01–T11 via MSG91, DLT-registered)
- Email templates (E01–E07)
- Manual WhatsApp Web templates (W01–W04 for ops team)
- UTM tagging reference for marketing team

No new copy to write — paste-and-build.

---

## 9 · OPEN QUESTIONS

| # | Question | Blocks |
|---|----------|--------|
| 1 | Domain (`bch.in/rc` or other?) | SEO + DM payload + OG image |
| 2 | Supplier sample ETA in Bangalore | Studio shoot · Day -9 in launch checklist |
| 3 | 50-name soft-launch list for 50%-off pre-order | 30 seed reviews + 12 UGC reels for Day 0 |
| 4 | BCH WhatsApp Business number (for `wa.me` deep links) | Every page |
| 5 | MSRP confirmation (₹1,499 / ₹2,499 / ₹2,999 anchors?) | All wholesale tier math |
| 6 | Bulk pricing ladder accept-or-tune (35/45/52% off at MOQ 12/48/144) | Wholesale catalog |
| 7 | Payment terms accept (100% advance <₹50K · 50-50 ₹50K–2L · no Net-30 Day-1) | Retailer trust |

---

## 10 · ANTI-PATTERNS (what we are NOT building)

- ❌ Native WhatsApp Business API automation (BSP locked OUT — manual via ops)
- ❌ Separate retail B2C marketplace (this app IS the only consumer-facing surface)
- ❌ Mobile apps (web-only, mobile-optimized PWA-style)
- ❌ Reviews backend (use Judge.me widget — don't roll our own)
- ❌ Custom checkout UI (use Razorpay Magic — don't fight 1-click)
- ❌ Net-30 payment terms for retailers Day 1 (receivables risk)
- ❌ Fake countdowns / "ONLY 17 LEFT" caps urgency (brand voice rules)
- ❌ Multi-language at launch (Hindi-English code-switch microcopy only)

---

## 11 · DEFINITION OF "LAUNCH-READY"

A non-Syed user, given only an Instagram reel CTA, can:
1. Tap the link → land on `/rc` in <2.5s LCP on 4G mobile
2. See the hero video loop play muted on autoplay
3. Tap "Add to Cart" → see the cart drawer
4. Tap "Checkout" → complete a UPI payment in Razorpay Magic in <30 sec
5. Receive an SMS confirmation within 60 sec
6. Track the order at `/track` using their phone + OTP

In parallel, a retailer can:
1. Land on `/wholesale` → see prices gated
2. Register → GSTIN auto-verified in <10 sec → SMS OTP → instant unlock
3. Build a 12-pc mixed cart → see margins per SKU
4. Place order via WhatsApp (manual) OR via the portal (Razorpay business UPI)

When both flows work end-to-end on real devices (iOS + Android, mobile data, COD + UPI), we ship.

---

*Source briefs: RC_LANDING_PAGE_BRIEF_V2.md · RC_LANDING_PAGE_COPY.md · RC_CARS_TG_PERSONAS.md · RC_COMPETITOR_BIO_URLS.md*
