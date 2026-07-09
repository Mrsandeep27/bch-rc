# PRC Admin — Shopify-UI Redesign · Build Spec & Progress

**Route:** `/admin/*` (`src/app/admin/(authed)/*`) · **Status:** 🛠 **Redesign IMPLEMENTED in code** — Shopify-style sidebar shell (`AdminShell`), redesigned Dashboard, and 5 new data-backed pages (Products, Discounts, Finance, Returns/RTO, Reviews moderation) are built and wired to **real** queries. Light is the default theme with a dark toggle. Analytics/funnel data bugs fixed (§9). Build + lint clean. **Not pushed.**
**Last updated:** 2026-07-09
**Owner instruction:** design/preview first, **do NOT push** until each piece is approved.

Related: [PRC-Hub-Build.md](PRC-Hub-Build.md) (storefront). This doc is the **admin** workstream.

> **Key finding (§8):** most of the admin's value is *already built in the backend but invisible in the UI* — ops-alerting, RTO detection, a review-moderation pipeline, WhatsApp sending and campaign attribution are all wired and working with **no screen**. The cheapest wins are screens over machinery that already exists, not new backend.

---

## 0. Decision

The admin is being rebuilt in a **Shopify Polaris-style UI** — the owner reviewed three directions and chose **Design A · "Polaris Light"**: dark left sidebar, light-grey canvas, soft white cards, tiny uppercase column headers, thin dividers, red (`--brand-red #e11d2a`) as the PRC accent in place of Shopify green. Calm, dense, familiar.

**Interactive previews (Claude artifacts, mock data — not the app):**
- ⭐ **CANONICAL — Dashboard + 6 new sections** (Dashboard, Products, Discounts, Analytics w/ live bug audit, Finance/GST, Returns/RTO, Reviews): `claude.ai/code/artifact/8972bc5d-78bd-41a5-a61d-5671a9c3155b`
- 3 design directions (A/B/C switcher): `claude.ai/code/artifact/65c590cf-23eb-4106-bed2-df894d43a69d`
- Full clickable admin prototype (all sections, Design A): `claude.ai/code/artifact/09e10d9f-8eea-473b-af16-b00031e8a60e`
- Inventory redesign (interactive): `claude.ai/code/artifact/f35c5ae4-4636-45fd-98ad-76b42cb06055`
- "How Shopify inventory looks" reference: `claude.ai/code/artifact/6f6d8f3c-bb05-427f-b5e6-f70527ba87f0`

Dashboard preview matches the owner's reference: five KPI cards (Revenue, Orders, Conversion, AOV, Live visitors), a green "Sales over time" area chart beside a dotted "Needs attention" list, a full-width "Recent orders" table (Order · Customer · Total · Payment · Status), and a topbar **date-range dropdown + Export**.

Research basis: Shopify inventory docs + Polaris (IndexTable, IndexFilters, subheader grouping, Set-to vs Adjust-by, bulk edit with green/red diffs). Most Shopify machinery (multi-location, committed/on-hand/unavailable split, reason codes, saved views, pagination) is **skipped** — overkill for a ~30-SKU single-warehouse, 2–3-person shop.

---

## 1. Section status

Legend: ✅ built (code) · 🎨 designed (preview only, no code) · 🚧 redesign pending · 🔴 missing (no design, no code)

| Section | Route | Status | Notes |
|---|---|---|---|
| **Dashboard / Overview** | `/admin` | ✅ **built** | Rebuilt: ROW 1 = 5 KPI cards (Revenue/Orders/Conversion/AOV/Live) with **real vs-prev deltas + sparklines**; ROW 2 = SVG sales-over-time area chart (70%) + needs-attention (30%); ROW 3 = flat recent-orders table (Order·Customer·Total·Payment·Status). Extras (visitors, velocity, customers, sources, top SKUs, export) moved to a "More insights" section below the fold. Single-store (PRC/PRC16 switcher removed). |
| **Orders** | `/admin/orders` | ✅ built | Status tabs + search + badges (pre-existing, preserved under the new shell). Pagination still capped at 100 (see §8B). |
| **Inventory** | `/admin/inventory` | ✅ **DONE** | Rebuilt — see §2. |
| **Customers** | `/admin/customers` | 🚧 | Code = top-50 by spend, no search/filter/export. Inherits the shell theme. |
| **Analytics** | `/admin/analytics` | ✅ data-fixed | 5 data bugs fixed (§9). Renders under the shell theme; deeper UI polish still available. |
| **Funnel** | `/admin/funnel` | ✅ data-fixed | Unit mismatch fixed + anomaly note added (§9). |
| **Recovery** | `/admin/recovery` | 🚧 | Keep — telecaller call-queue + `/desk/[token]` caller surface. |
| **Activity** | `/admin/activity` | 🚧 | Global event log. Code = last 200, no date filter. |
| **Settings** | `/admin/settings` | 🚧 | **Read-only today** — no add-site / add-admin / role edit. See §8C. |
| **Products / Catalog** | `/admin/products` | ✅ built | Real read-only table: thumbnail + swatches + "N colours", Active/Coming-soon/Hidden status, category, price+MRP, **live inventory state** (in stock / low / sold out / no data) + status tabs. CRUD pending (catalog lives in code — needs a migration). |
| **Discounts / Coupons** | `/admin/discounts` | ✅ built | Real read-only from `coupons` (code/type/value/validity/usage/status). CRUD pending. |
| **Finance (GST / settlements)** | `/admin/finance` | ✅ built | Real read-only from `orders`: gross/paid/refunds/COD-in-flight/RTO-loss + method split. Settlement/GST reconciliation pending. |
| **Returns / RTO** | `/admin/returns` | ✅ built | Real from `orders`: RTO rate/value, refunds, cancelled + order list (kept distinct). |
| **Reviews moderation** | `/admin/reviews` | ✅ built | Real queue (pending/approved/rejected) + **approve/reject/reset server actions** (writes `status`, revalidates PDPs). |

**Shell + theme (new this session):** `AdminShell` — dark 220px sidebar (grouped nav SELLING/INSIGHTS/MONEY&OPS, active red-bar highlight, **real** Orders + Reviews count badges + new/done chips, profile footer), theme-aware topbar with page title + **light/dark toggle** (light is the default), mobile hamburger drawer. Scoped dark theme (`.admin-shell`) in `globals.css` remaps the brand tokens to the Artifact's exact dark palette. Build + lint clean.

**Not yet built (from the §8 audit):** Products/Discounts **CRUD** (needs migration) · Ops-alerts inbox · Failed-delivery list · Shipment-queue & webhook health · Campaign/ROAS report · Finance settlement/GST reconciliation. Plus depth fixes (§8B), platform/RBAC (§8C), and mobile table→card + Lighthouse passes.

**Auth model (corrected — research finding, NOT shared-password):** sign-in is **Supabase Auth email+password** (`/admin/login` → `POST /api/admin/signin`, rate-limited); every page calls `requireAdmin()`. The `admins` table **is** used — real rows with `siteIds[]` + `active` gate access. **But the OWNER/MANAGER/SUPPORT role enum is dead for RBAC** — it's only *displayed*; zero code gates any action by role. Every logged-in admin can do everything within their sites. The `/cod` (telecaller) and `/pack` (packer) consoles have their own separate cookie/secret auth.

**Skip (not needed at this scale):** Marketing, Content/CMS, Markets, POS, Apps, Domains, multi-location.

---

## 2. Inventory rebuild (DONE)

Files: `src/app/admin/(authed)/inventory/page.tsx` + `InventoryManager.tsx`.

**What shipped (code, verified — typecheck + prod build clean; not yet pushed):**
- **Single unified inventory** — the old prc/prc16 split is gone; `page.tsx` calls `getInventoryHealth()` (site `prc`), removed the dead PRC/PRC16 switcher.
- **Category-image tabs** — the hub categories (Mini 1:64, Big 1:16, 1:20, Construction, Polo, + empty 1:43/Drone/Hobby) with round storefront thumbnails + live counts; SKU→category via `categoryKeyOf` (polo/construction override, else scale).
- **Shopify-style flat table** — one row area per variant; **products grouped** (e.g. Pocket BMW shown once with White/Blue/Black nested; single-colour products render as one flat row).
- **Inline-editable "In stock" cell** — type + Enter/blur = Set exact; colour-coded (amber ≤5, red at 0) like Shopify's Available cell.
- **Restock column** — `− 10 +` stepper + `+50` (adjust-by presets), distinct from Set-exact.
- **Status tabs** — All / Low stock / Out of stock (with counts) + **search** + **sort** (catalogue / stock↑ / name).
- **Stock-take bulk mode** — every In-stock cell becomes a draft input with green/red `old→new` diffs; one sticky Save bar commits all (concurrency-pooled `set` calls). Biggest ergonomics win for a physical recount.

**Design notes captured for the rest of the admin:** Set-exact must stay visually distinct from Adjust (stops a packer overwriting when they meant to add); status colour system = amber(low)/red(zero)/green(ok); green reserved for the stock-take up-diff.

---

## 3. Shopify admin ↔ PRC gap analysis

| Shopify | PRC today | Verdict |
|---|---|---|
| Home, Orders, Drafts, Inventory, Customers, Analytics | ✅ have | keep / redesign |
| Abandoned checkouts | ✅ Recovery (better) | custom win |
| **Products / Catalog** | ❌ code-only (`products.ts`) | 🔴 build — see §4.1 |
| Discounts | ⚠️ DB only, SQL-edited | 🔴 build UI — §4.2 |
| Finance / Payouts | ❌ | 🔴 build — §4.3 |
| Returns | ❌ | 🔴 build — §4.4 |
| Reviews (app) | ❌ DB only | 🔴 build — §4.5 |
| Users & permissions | ⚠️ Supabase Auth + `admins` table, but **roles gate nothing** (RBAC dead) + no team-management UI | 🟡 §8C |
| Marketing, Content, Markets, POS, Apps, Domains | ❌ | ⚪ skip |
| Funnel, Activity | — | ✅ PRC custom wins |
| Ops-alerts / queue health / campaign ROAS | ⚠️ backend built, **no screen** | 🔴 §8A — cheapest wins |

---

## 4. Missing sections to build (prioritized)

### 4.1 🔴 Products / Catalog editor — HIGHEST VALUE
**Why:** the catalog lives entirely in code (`src/lib/products.ts`). Name, **price, MRP, images, description, colours, badges, coming-soon** are all edited by a developer + deploy. The owner/telecaller cannot change a price or add a car without an engineer. This is the single most valuable missing capability.
**Scope (L):**
- DB is ready-ish: the empty `products` + `product_variants` tables exist. Decision needed: **migrate the code catalog into the DB** (products/variants/colours/images) and read the storefront from the DB, vs a lighter "overrides" table. Recommend a phased move: start with **editable price / MRP / stock / visibility / badge** in the DB (the fields that change often), keep static copy/specs in code initially.
- UI: Polaris product list (thumbnail, name, price, status) → product editor (fields + colour variants + image upload to Supabase Storage). Reuse the review-images bucket pattern for uploads.
- Ties into Inventory (variants) and the storefront read path (`getVisibleProducts` etc.).

### 4.2 🔴 Discounts / Coupons UI
**Why:** `coupons` + `customer_coupon_redemptions` exist; today edited via SQL. The spin-wheel offer needs a real coupon.
**Scope (M):** Polaris list + create/edit (type FLAT/PERCENT/FREE_SHIP, value, min order, usage/per-customer limits, validity, active). Show usage vs limit.

### 4.3 🔴 Finance (GST / settlements)
**Why:** no reconciliation of Razorpay payouts vs orders, no COD remittance tracking vs Shiprocket, no GST report. Real accounting need for an Indian D2C.
**Scope (M–L):** GST summary (taxable value, GST collected per rate/HSN), Razorpay settlement vs captured payments, COD collected vs remitted. Needs invoice/HSN fields (see §5).

### 4.4 🔴 Returns / RTO
**Why:** COD RTOs are costly in India; no workflow to track return-to-origin, refunds, restock.
**Scope (M):** RTO status from Shiprocket (already polled), a returns entity, refund tracking (Razorpay refund for prepaid), restock-on-return into inventory.

### 4.5 🔴 Reviews moderation
**Why:** `reviews` table (with photos) has a pending→approved queue but no admin UI; moderation is invisible.
**Scope (S–M):** Polaris list of pending reviews (rating, text, photos, verified-buyer) → approve/reject.

### 4.x 🟡 Later
- **Team roles / RBAC** — the `admins` table + OWNER/MANAGER/SUPPORT enum already exist and drive sign-in, but **no code gates any action by role** — wire real role checks + a team-management UI (see §8C).
- **Notifications** — email-template editor + global bounce/complaint follow-up view (outbox has `deliveryStatus`; per-order logic already computed — see §8A).
- **Customer profile drawer** — LTV, order history, notes (the fixed customer aggregates now populate).

---

## 5. Data-model notes (for the new sections)

- **Catalog → DB**: populate `products` / `product_variants` from `products.ts`; add image storage. Storefront read path switches from static import to DB query (cache-friendly).
- **Stock-movement ledger** (deferred but recommended): `stock_movements(id, sku_id, variant_slug, delta, new_qty, source: adjust|set|bulk|order, actor, note, created_at)` appended from every inventory write path + order decrement → a per-variant "recent changes" popover. Solves "who changed this stock?".
- **GST fields**: per-product HSN code + GST rate for compliant invoices/reports.
- **Returns entity**: `returns(order_id, reason, status, refund_amount, restocked, created_at)`.
- **RTO/NDR persistence**: the courier webhook (`src/app/api/webhooks/courier/route.ts`) already *receives* `scans[]` but discards them; `mapShiprocketStatus` already recognizes RTO/RETURNED. Persist `scans` (JSON) + an `ndr` flag on the order/shipment so the Returns screen and a tracking timeline have real data.
- **Roles**: use the existing `admins.role` enum (OWNER/MANAGER/SUPPORT) + gate routes/actions (currently ungated — §8C).

---

## 6. Design tokens (Polaris Light, PRC-branded)

From `src/app/globals.css`: `--brand-red #e11d2a` (accent, replaces Shopify green), `--brand-ink #0a0a0a`, `--brand-ink-soft #3a3a3a`, `--brand-cream #faf8f5`, `--brand-line #e5e5e5`, `--gold #d4a017` (low), `--success #16a34a` (ok/up), `--brand-red` (sold/down). Dark theme supported via tokens.

Shell: dark left sidebar (`#1a1a1a`) with PRC logo + nav; light canvas; white cards (`rounded-xl`, `border-brand-line`); tables with `bg-brand-cream/40` headers, thin `border-brand-line` dividers, `hover:bg-brand-cream/30` rows.

---

## 7. Build order (revised after the §8 audit)

1. **Inventory** ✅ (done) → **push** once owner approves the whole batch.
2. **Tier 0 — surface what already exists** (each ~1 day, backend already built): **Reviews moderation** (§4.5), **Ops-alerts inbox** (§8A), **Failed-delivery list** (§8A), **Campaign/ROAS report** (§8A). Biggest bang-for-buck.
3. **Products/Catalog editor** (§4.1 — the strategic one; unblocks no-deploy price/image edits). Decide DB-vs-code source of truth first (§5).
4. **Coupon manager** (§4.2), **Low-stock alert cron** + **RTO/NDR persistence** (§8A / §5).
5. **Returns/RTO** screen (§4.4), **Finance/GST** (§4.3 — the only genuinely-new area).
6. **Tier 2 depth** (§8B): pagination everywhere, order-detail mutations (cancel / partial-refund / status / edit), customer search+export, date-range pickers, multi-line + COD manual orders.
7. **Tier 3 platform** (§8C): RBAC role-gating, team/site management UI, tracking timeline, automated WhatsApp nudges.
8. **Correctness** (§9): fix the 3 HIGH analytics bugs regardless of section order — they corrupt numbers already on screen.

Each step: build behind the existing auth, verify locally, preview, then push on approval.

---

## 8. Latent-capability audit — what's still to build

Two read-only agents mapped (a) every current admin screen's actions/limits and (b) every DB table + integration vs. what's surfaced. **Headline: the backend is far ahead of the UI.** Grouped by type:

### 8A. Screens missing entirely (backend built, no UI) — the cheapest wins
| Screen | You already have | Payoff | Effort |
|---|---|---|---|
| **Reviews moderation** | `reviews` table with a `pending` backlog; `submitReview` stamps "pending so admin can moderate" — **screen never built**, so verified reviews are invisible forever | Buried post-purchase content **+ SEO star ratings** (feeds `AggregateRating` JSON-LD) | **S** |
| **Ops-alerts inbox** | `src/lib/alert.ts:alertOps()` writes durable `OPS_ALERT` events + emails on stuck shipments / unfulfillable paid orders — **nothing reads them back** | Silent failures become a visible queue | **S** |
| **Failed-delivery list** | Per-order bounced/complained logic already computed in `orders/[id]/page.tsx`; `notifications_outbox.deliveryStatus` tracks it | Cross-order "these customers never got their confirmation → call them" (+ resend action) | **S** |
| **Campaign / ROAS report** | Orders snapshot first-touch `source` + `utm_*` at creation, **already indexed** (`orders_utm_campaign_idx`, `orders_source_idx`) | Real per-campaign revenue with no new tracking — the strongest unused asset | **S–M** |
| **Shipment-queue & webhook health** | `shipment_jobs` (status/attempts/`lastError`) + `webhooks_inbound` (`processed`/`error`) | See if the retry queue / webhooks are stuck instead of guessing | **S each** |

### 8B. Depth missing *inside* existing screens
- **Orders**: list caps at **100 rows, no pagination**; detail has **no cancel, no partial refund** (schema has `PARTIALLY_REFUNDED` but no code path), no status change, no address/item edit.
- **Customers**: **top-50 by spend only** — no search, no filter, no export.
- **Manual order** (`orders/new`): single SKU only, **no COD path** (online/Payment-Link only), hardcoded `siteId:"prc"`, free-ship threshold hardcoded.
- **Analytics / Activity**: fixed windows, **no date-range picker** (code flags it as TODO) — the preview's topbar date dropdown must actually drive the query.
- **Shiprocket data thinly shown**: AWB/courier render as static fields; scan history lands in `events` but there's no **tracking timeline**; serviceability/ETA never shown to operators; bulk label/manifest/pickup/invoice are `/pack`-only, not batchable from admin.

### 8C. Platform / trust foundations
- **RBAC is decorative** — OWNER/MANAGER/SUPPORT is displayed but gates nothing; every login can do everything. Wire real role checks.
- **No team/site management UI** — adding an admin or site = raw DB insert (settings says "UI TODO").
- **Automated WhatsApp nudges** — `send-whatsapp.ts` exists; recovery is manual click-to-send only.
- **RTO/NDR** — courier webhook throws away `scans[]` (§5); persist before Returns has real data.

### 8D. Automation already wired (feed the Tier-0 inbox)
- Crons: `/api/cron/reconcile` (5 min) + `/api/cron/sync-shipments` (3 h, also drains the outbox) — pure backend, **no admin digest**.
- `alertOps()` + `OPS_ALERT_EMAIL` plumbing is 100% built and unused for low-stock/RTO/COD alerting — a low-stock sweep is just a query + `alertOps()` call surfacing in §8A's inbox.

---

## 9. Analytics data-health bugs — ✅ ALL FIXED (verified: build + 19/19 math checks)

All five were re-verified against live code and fixed at root cause. Shared modules added to stop the drift that caused #1/#3: **`src/lib/order-status.ts`** (canonical status groups + `bucketOfStatus`), **`src/lib/tz.ts`** (IST day helpers, now used by BOTH dashboard and analytics), **`src/lib/analytics-validation.ts`** (`safePct`/`clampPct`/`detectFunnelAnomalies`). Executable checks: `scripts/verify-analytics-math.ts` (`npx tsx …`, 19/19 pass).

1. ✅ **HIGH — Funnel unit mismatch.** Bottom two stages are now `count(DISTINCT customer_id)` (distinct **buyers**), the same "distinct people" unit as the top four — not `count(*)`. Step % is `clampPct(safePct(...))` (never > 100%). A downstream stage that still reads higher than an upstream one is surfaced as a **"tracking gap" note** via `detectFunnelAnomalies`, not a corrupt bar. `src/lib/funnel-queries.ts`.
2. ✅ **HIGH — "Placed order" counts only real intent.** Filtered to `VALID_ORDER_STATUSES` (excludes FAILED/ABANDONED/CANCELLED). Because `PAID_STATUSES ⊆ VALID_ORDER_STATUSES`, "Paid" can never exceed "Placed order". `funnel-queries.ts`.
3. ✅ **HIGH — Analytics windows now IST.** `analytics/page.tsx` uses the shared `istDayStart`/`addUtcDays`/`istYmd` and `date_trunc('day', … AT TIME ZONE 'Asia/Kolkata')` for the revenue chart + weekly customers. The dashboard was refactored onto the SAME helpers so the two are byte-for-byte identical and can't drift again.
4. ✅ **MED — Status-mix covers every order.** `bucketOfStatus` folds `PENDING_COD_VERIFICATION` into Pending and routes any unknown/future status to a visible **"Other"** bucket, so the denominator always includes every row. `analytics/page.tsx`.
5. ✅ **LOW — Pageview single-owner.** `/api/track` inserts `pageview_count = 0` and no longer bumps on conflict; the batched `/api/track/event` handler is the sole incrementer. 1-page session = 1 pageview. `track/route.ts`.

**Currency, div-by-zero/NaN guards, Meta CAPI dedup, bot filtering, and best-seller/attribution math were checked and are correct.** Changes are in the working tree, not pushed.
