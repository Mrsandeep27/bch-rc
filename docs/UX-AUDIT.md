# UI/UX & Accessibility Audit — PRC Cars storefront + back-office

**Method:** Static, code-grounded audit of every screen (JSX/CSS read directly against the design system in `globals.css` + `theme.ts`). Every finding cites `file:line`. "Screenshot ref" is the code anchor — live screenshots were **not** captured because most screens (checkout, orders, admin, pack, COD) require auth + a live DB/Supabase session + seeded data. A live screenshot pass of the **public** pages (home, `/16`, product, policies) can be added on request once a dev server is running.

**Scope:** ~30 screens across the 1:64 storefront, the `/16` (1:16) storefront, and three internal tools (admin, pack, COD), plus 60+ shared components.

**Severity scale**
- **Critical** — blocks a task / unusable on a viewport / illegible on a primary action / keyboard trap.
- **High** — significant friction or accessibility barrier; conversion/trust damage.
- **Medium** — visible inconsistency, polish gap, suboptimal state, minor contrast/touch-target miss.
- **Low** — nitpick / micro-polish.

> Read the **Systemic findings (S1–S7)** first — they recur on most screens, and fixing them once clears dozens of per-screen items below.

---

## Executive summary

The storefront is, on the whole, **thoughtfully built** — centralized design tokens, deliberate hero contrast handling, an exemplary `CartDrawer` (focus trap + scroll-lock + Escape), reduced-motion guards on CSS animations, and genuinely good empty/error copy. The problems are **adherence and accessibility**, not absence of a system:

1. **Keyboard accessibility is the dominant theme.** There is no global `:focus-visible` style (only `.cta-slice` on `/16`), so focus is invisible across the whole storefront. Six home-page carousels, the desktop "Shop by size" menu, the mobile nav drawer, the PDP variant/gallery controls, and the review star-rating are not properly keyboard-operable. Several are WCAG 2.1.1 / 2.4.7 failures on conversion-critical controls.
2. **Contrast failures on trust/status signals.** Gold `#d4a017` stars and `bg-gold/10 text-gold` PENDING badges (~2.4:1), `text-brand-red` on `bg-brand-ink` footer links (~3.3:1), and low-opacity white text on light/branded backgrounds all fail WCAG AA.
3. **Pervasive sub-12px text** (201 `text-[10px]`/`[11px]` instances, some `text-[8px]`) on conversion-critical microcopy.
4. **Price inconsistency on the PDP** — buy box shows `retailINR − 100` while the sticky bar and bundle show `retailINR`, with `100`/`1099` hard-coded instead of `OFFERS`/`THEME` tokens.
5. **Loading skeletons don't match their pages** (width/header/border mismatches → hydration layout shift), especially on checkout.
6. **Two latent landmines shipped but unmounted:** `SocialProofToast` (fabricated "✓ Verified" orders — India CPA/ASCI risk) and `ExitIntentModal` (phantom `DRIFT100` coupon that 404s at checkout).

### Severity rollup
_(updated as clusters complete)_

| Cluster | Critical | High | Medium | Low |
|---|---|---|---|---|
| Systemic (S1–S7) | – | 2 | 4 | 1 |
| Home + global chrome | 1 | 4 | 8 | 9 |
| Home content sections | – | 7 | 9 | 11 |
| Product detail (PDP) | – | 8 | 9 | 8 |
| Checkout + cart + pay | 1 | 8 | 9 | 6 |
| Post-purchase & utility | 1 | 4 | 9 | 9 |
| `/16` store | – | 7 | 12 | 11 |
| Admin — core | – | 6 | 13 | 7 |
| Admin — data/ops | 1 | 13 | 13 | 8 |
| Pack + COD + invoice | 2 | 8 | 10 | 6 |
| **TOTAL** | **6** | **67** | **96** | **76** |

**The 6 Critical issues, at a glance:** ① Mobile nav drawer has no focus trap/Escape/scroll-lock (`Header.tsx:298`). ② No `<label>` on any of the 8 checkout address inputs (`checkout/page.tsx:1212`). ③ Review star-rating not keyboard-operable yet required (`ReviewSubmitForm.tsx:116`). ④ Admin Funnel page wrapped in a conflicting `max-w-4xl` container, breaking the shared shell width (`funnel/page.tsx:32`). ⑤ Pack COD chip uses an **undefined** `--warning` token → renders colourless, so COD orders aren't flagged (`PackOrderRow.tsx:200`). ⑥ GST invoice has **zero** print CSS (no `@page`/A4/`print-color-adjust`) → borders & shaded panels drop out when printed (`invoice/[orderId]/page.tsx:86`).

---

## Systemic findings (cross-cutting — fix once, benefits every screen)

### S1. [HIGH] No global keyboard focus indicator
- **Location:** `globals.css:220-226` (only `.cta-slice:focus-visible` exists). Inputs across the app use `focus:outline-none focus:border-brand-red` (`ReviewSubmitForm.tsx:158/176/198/214`, `checkout/page.tsx:490/1328/1559`, `admin/login/page.tsx:117/143`, `pack/PackLoginForm.tsx:89/113`, `cod/CodLoginForm.tsx:98/122`, `OrderActions.tsx:80`). Some remove the ring with **no** replacement: `admin/(authed)/orders/page.tsx:170`, `orders/new/CreateOrderForm.tsx:404/468`, `pack/PackFilterSelect.tsx:40`. Most custom buttons have only `hover:` styles.
- **Issue:** `outline-none` strips the native ring; the replacement is at most a grey→red border shift, or nothing.
- **Impact:** Keyboard/switch users can't see focus → checkout & login forms are hard to complete without a mouse. WCAG 2.4.7 + 1.4.11.
- **Screenshot ref:** `globals.css:220`
- **Severity:** High
- **Fix:** Add a global base rule: `:where(a,button,input,select,textarea,[tabindex],[role="radio"],[role="checkbox"]):focus-visible{ outline:2px solid var(--brand-red); outline-offset:2px; border-radius:inherit; }`. Stop using bare `focus:outline-none`. The correct pattern already exists at `SkuLineup.tsx:119` / `Lineup16.tsx:53`.

### S2. [MEDIUM] Inconsistent accent yellow (gold vs amber vs #FACC15)
- **Location:** stars use `text-gold fill-gold` in `ReviewsBlock.tsx:139/158/202` & `TrustStrip.tsx:8` but `fill-amber-400 text-amber-400` in `ReviewSubmitForm.tsx:136` & `PdpReviews.tsx:20`. `theme.ts` defines accent `#FACC15`; `globals.css` defines `--gold #d4a017` — a third yellow. PENDING/transit status mixes `text-gold` and `text-amber-*`.
- **Issue:** Three interchangeable yellows for the same semantics (ratings, pending).
- **Impact:** Star colour visibly differs between the review-display and review-submit widgets on the same product; inconsistent status colour.
- **Screenshot ref:** `ReviewsBlock.tsx:139` vs `ReviewSubmitForm.tsx:136`
- **Severity:** Medium (High where it compounds S3)
- **Fix:** One rating/accent token. Reconcile `theme.ts` `#FACC15` with `--gold`; replace all `amber-*` rating usages.

### S3. [HIGH] Gold `#d4a017` fails contrast on white / tint
- **Location:** `text-gold` stars on white/cream (`ReviewsBlock.tsx:139`, `TrustStrip.tsx:8`, `orders/[id]/page.tsx:312`); `bg-gold/10 text-gold` PENDING badge (`admin/(authed)/page.tsx:1064`, `orders/page.tsx:364`, `customers/[id]/page.tsx:282`, `activity/page.tsx:37`, `inventory/InventoryManager.tsx:75`, `track/page.tsx:237`, `orders/[id]/page.tsx:121/476`).
- **Issue:** `#d4a017` on `#ffffff` ≈ **2.38:1**; on the `gold/10` tint ≈ **2.2:1**. Fails AA 4.5:1 (text) and 3:1 (UI/large).
- **Impact:** PENDING status (every admin order list/detail + public track page) and rating numbers are hard to read.
- **Screenshot ref:** `admin/(authed)/page.tsx:1064`
- **Severity:** High
- **Fix:** Add a darker `--gold-text` (≥ `#8a6d0f`, ≈4.6:1 on white) for text/badges; keep bright gold only for large decorative star glyphs (still bump to meet 3:1).

### S4. [MEDIUM] Pervasive sub-12px type
- **Location:** 201 `text-[10px]`/`[11px]`(/9px/8px) hits across 63 files. Worst: `OurStorySection.tsx` & `LaunchCountdown.tsx` (`text-[8px]`), `Header.tsx:244/283`, `track/page.tsx:233/237/241` (status pills), `orders/[id]/page.tsx:151`.
- **Issue:** Heavy reliance on 10–11px (and some 8px) for body-adjacent, meaning-bearing text.
- **Impact:** Strained legibility on mobile (dominant traffic) and for low-vision users.
- **Screenshot ref:** `OurStorySection.tsx:56`
- **Severity:** Medium (High where 8px or gold/muted)
- **Fix:** Floor body-adjacent text at 12px (`text-xs`); reserve `[10px]`/`[11px]` for true all-caps eyebrows with adequate tracking/contrast. Eliminate all `text-[8px]`.

### S5. [MEDIUM] No shared Button/Input primitives → state drift (root cause)
- **Location:** No `Button.tsx`/form primitives; every CTA is bespoke Tailwind; the input class string is duplicated in 15+ files.
- **Issue:** Sizing, radius (`rounded-full`/`xl`/`lg`), padding, hover, focus, disabled, loading reinvented per usage — the root cause of S1 and inconsistent disabled/loading coverage.
- **Impact:** Visual inconsistency; every fix (focus, contrast, tap target) must be repeated and re-drifts.
- **Screenshot ref:** `Header.tsx:224`
- **Severity:** Medium (structural)
- **Fix:** Introduce `<Button variant size>` + `<Input>/<Field>` encoding the system (focus-visible ring, disabled, loading, ≥44px). Migrate incrementally.

### S6. [MEDIUM] Off-token / mixed color tokens
- **Location:** `Loader.tsx` truck SVG `#282828,#7D7C7C,#FFFCAB,#DFDFDF,#E11D2A`; `Footer16.tsx:23` `bg-[#0a0a0a]` (not `bg-brand-ink`); `Placeholder16.tsx:26` `#6b7280`; `Skeleton.tsx` & checkout/invoice use `neutral-*` (`InvoiceNumberForm.tsx:53`); `ProductPlaceholder.tsx:6-40` uses sky/violet/emerald/pink Tailwind palettes outside the brand.
- **Issue:** Hardcoded hex and `neutral-*`/palette colours bypass tokens.
- **Impact:** The full-screen Loader (every navigation) is off-brand grey/red; PDP image-fail placeholder can render in non-brand colours.
- **Screenshot ref:** `Loader.tsx:32`
- **Severity:** Medium
- **Fix:** Map SVG/`neutral-*`/palette colours to `var(--brand-*)`; restrict placeholder gradients to brand tints.

### S7. [MEDIUM] Animation without `prefers-reduced-motion`
- **Location:** framer-motion in 13 components; only Hero/UgcGrid/CustomerReviewsSlider (+ a few store16) gate on `useReducedMotion`. Ungated: `StickyMobileCTA`, `CartDrawer`, `BundlePicker`, `OurStorySection`, `FeatureCarousel`, `OfferStack`, `FAQ`, `StatsStrip`, `HowToUse`, `Lineup16`, `CartDrawer16`, `HowToUse16`. CSS gaps: `.animate-marquee` (`globals.css:276`), `.animate-truck-motion/road` (`Loader.tsx`), and Tailwind `animate-pulse` (`track/page.tsx:301`) have **no** reduced-motion rule.
- **Issue:** No global `<MotionConfig reducedMotion="user">`; several motion surfaces run regardless of OS preference.
- **Impact:** Vestibular sensitivity / WCAG 2.3.3.
- **Screenshot ref:** `globals.css:276`
- **Severity:** Medium
- **Fix:** Wrap app + `/16` in framer-motion `<MotionConfig reducedMotion="user">`; add `@media (prefers-reduced-motion: reduce){ .animate-marquee,.animate-truck-motion,.animate-truck-road{animation:none} }`; use `motion-reduce:animate-none` on pulse.

**Positive baselines (don't over-flag):** no clickable `<div onClick>` anti-pattern; CSS keyframes honour reduced-motion; `CartDrawer` is a model dialog (focus trap + scroll-lock + Escape) to copy elsewhere; tokens are centralized — the issue is adherence.

---

## Screen cluster 1 — Home page + global chrome

### Global / layout (`layout.tsx`, `globals.css`)
**Dimensions OK:** `lang="en-IN"`, font-display:swap, `overflow-x:clip`, reduced-motion for marquee/hero/scroll, complete favicons.

**[High] No global focus-visible** — see **S1**. (`globals.css:220`)

**[Low] No `theme-color` / `color-scheme`** — `layout.tsx:70` body forced white, no `<meta theme-color>`; Android address bar stays grey. Fix: add `themeColor:"#e11d2a"`, `colorScheme:"light"` to metadata.

### Hero (`Hero.tsx`)
**Dimensions OK:** single H1 + sr-only SEO tail, video `aria-label`, reduced-motion pauses video, decorative scroll indicator `aria-hidden`, tuned mobile/desktop object-position.

- **[High] Primary CTA has no focus state; emoji leads the accessible name.** `Hero.tsx:184-190` — hover/active only, no `focus-visible` ring; label `"🛒 Order yours…"` (`theme.ts:36`) makes SRs announce "shopping cart" first. Impact: the top conversion control is invisible to keyboard users and reads awkwardly. Fix: `focus-visible:outline-2 outline-offset-2 outline-white`; wrap emoji in `aria-hidden` span.
- **[Medium] Sub-copy contrast over bright video.** `Hero.tsx:121,166-170` — gradient only `via-black/35 to-black/15`; body relies on text-shadow (not a WCAG-valid contrast guarantee). Fix: localized `bg-black/40` scrim behind the text column, or deepen mid-stop to `via-black/50`.
- **[Medium] Sub-12px trust strip / kicker.** `Hero.tsx:131/195/214/226` — `text-[10px]`/`[11px]` at `white/80-90` on video; the COD/7-day/24h reassurance is the smallest, lowest-contrast text. Fix: ≥`text-xs`, raise to solid `text-white`.
- **[Low] Scroll indicator `text-white/55`.** `Hero.tsx:214` — below 3:1 (decorative). Fix: `text-white/70`.

### AnnouncementBar (`AnnouncementBar.tsx`)
**Dimensions OK:** `role="status"`, duplicated track, clone `aria-hidden`, `motion-reduce:animate-none`.
- **[Medium] White-on-brand-red at 12px borderline AA + live-region on a marquee.** `AnnouncementBar.tsx:31-34,41` — `#fff` on `#e11d2a` ≈ 3.9:1 (passes only for large text); `aria-live="polite"` on a perpetual ticker is an SR anti-pattern. Fix: use `--brand-red-hover` (#c4151f ≈4.6:1) bg or bump to `text-[13px]`; drop `aria-live`, use `role="region" aria-label`.
- **[Low] No pause-on-hover.** `globals.css:276`. Fix: `hover:[animation-play-state:paused]`.

### Header (`Header.tsx`)
**Dimensions OK:** transparent-over-hero vs solid-on-scroll logic + logo swap, cart badge `aria-label`, hydration-safe count, hamburger label toggles, size dropdown on hover+`group-focus-within`.
- **[Critical] Mobile menu drawer: no focus trap, no Escape, no scroll-lock.** `Header.tsx:298-313` (and size sheet `:272-295`) — plain conditional `<div>`s, unlike `CartDrawer`. Keyboard users tab into the page behind; SRs aren't told a dialog opened; body scrolls behind. Fix: reuse the `CartDrawer` pattern (`role="dialog" aria-modal`, Escape, scroll-lock, focus first link, outside-click backdrop).
- **[High] Desktop "Shop by size" is hover/CSS-only.** `Header.tsx:165-193` — trigger button has no `onClick`/`aria-expanded`/state; opens only via `group-hover`/`group-focus-within`. Keyboard users can't open a primary cross-sell nav. Fix: controlled disclosure (`useState`, toggle on click, `aria-expanded`), keep hover as enhancement.
- **[Medium] Transparent nav links `text-white/80` depend on video frame.** `Header.tsx:153-156,171-173,201-204` — can fall under 4.5:1 on bright frames. Fix: full `text-white` in transparent state.
- **[Medium] Sub-44px tap targets.** `Header.tsx:122-142` Sizes pill (~28-30px), `:231-242` cart (~40px), `:257` hamburger (~40px). Fix: `min-h-[44px] min-w-[44px]`/`p-3`.
- **[Low] Non-standard `sm:h-18`.** `Header.tsx:85` — Tailwind has no `h-18`; likely a no-op, so the header stays 64px while `page.tsx:82` offsets `-mt-20` (80px) → possible 16px overlap at `sm`. Fix: define `h-18` or use `sm:h-20`.

### HeroMiniFaq (`HeroMiniFaq.tsx`)
**Dimensions OK:** `section aria-label`, icons `aria-hidden`, responsive answer swap.
- **[Medium] Sub-12px objection-handling copy.** `HeroMiniFaq.tsx:54/67/70` — `text-[10px]/[11px]` answers in the buy zone. Fix: ≥`text-xs`.
- **[Low] Card-styled but non-interactive.** `HeroMiniFaq.tsx:59-77` — reads as tappable, does nothing. Fix: link to `/#faq` or flatten styling.

### Footer (`Footer.tsx`)
**Dimensions OK:** semantic `footer`, `h3` headings, logo alt, social `aria-label`+`rel`, decorative icons `alt=""`, responsive grid.
- **[High] Quick-links `text-brand-red` on `bg-brand-ink` fail AA.** `Footer.tsx:177` — `#e11d2a` on `#0a0a0a` ≈ 3.3:1 at `text-xs`; includes legally-required Privacy/Terms/Shipping links. Fix: `text-neutral-300 hover:text-brand-red`.
- **[Medium] "Flagship store · Coming soon" red on black.** `Footer.tsx:218-220` — same ~3.3:1. Fix: `text-white/90` + red dot/badge.
- **[Low] Footer body `text-[10px]/[11px]`; `neutral-500` hours ~4.1:1.** `Footer.tsx:100/169/232`. Fix: floor `text-xs`, `neutral-400`.
- **[Low] `h3` re-adds `font-display` (Nippo) at 11px.** `Footer.tsx:100/169/189` — display font far under its 40px floor. Fix: drop `font-display`.

### CartDrawer (`CartDrawer.tsx`) — model component
**Dimensions OK (exemplary):** `role="dialog" aria-modal`, real focus trap, Escape, scroll-lock, focus restore, backdrop close, labelled steppers, empty state, free-ship progress.
- **[Medium] Steppers/remove are 32px (`h-8 w-8`).** `CartDrawer.tsx:320-351` — checkout uses `h-11 w-11`; drawer is the sub-spec one on the pre-purchase control. Fix: `h-11 w-11`.
- **[Medium] Disabled checkout `<Link>` stays keyboard-activatable.** `CartDrawer.tsx:388-399` — `pointer-events-none`+`aria-disabled` don't stop Enter. Fix: render `<button disabled>` / `tabIndex={-1}` when subtotal 0.
- **[Medium] Drawer total ≠ checkout total** (shows `subtotal − bundleBonus`, omits prepaid bonus + shipping; CTA prints this changing figure). `CartDrawer.tsx:379-399`. Fix: label as "Subtotal" without a price, or compute the real total.
- **[Medium] Bundle bonus shown as % in drawer, ₹ at checkout.** `CartDrawer.tsx:235/376/382` vs `checkout/page.tsx:1620`. Fix: show ₹ (or ₹+%) in the drawer.
- **[Low] `aria-label="Cart"` instead of `aria-labelledby` the live-count h2.** `CartDrawer.tsx:148/156`.
- **[Low] Decrease not disabled at qty 1** (unlike checkout). `CartDrawer.tsx:320`.
- **[Low] `h2` "Your cart" is Nippo at 18px** — under the 40px floor. `CartDrawer.tsx:156`. Fix: `font-sans` or non-heading.

### StickyMobileCTA (`StickyMobileCTA.tsx`)
**Dimensions OK:** IntersectionObserver + fallback, `env(safe-area-inset-bottom)`, `min-h-[44px]` button.
- **[Medium] No focus state; sub-12px price tags.** `StickyMobileCTA.tsx:82-97` — Buy-now no `focus-visible`; "online" tag `text-[10px]`. Fix: add ring; ≥`text-[11px]`.
- **[Medium] z-40 collision with WhatsApp FAB (also z-40).** `StickyMobileCTA.tsx:72` vs `WhatsAppFab.tsx:15` — FAB overlaps the bar's right edge → mis-taps. Fix: raise FAB to `bottom-20` when bar visible, or reserve a right gutter.

### WhatsAppFab (`WhatsAppFab.tsx`)
**Dimensions OK:** `aria-label`, tokenized green, responsive size, funnel tracking.
- **[Low] No focus ring; `rel="noopener"` missing `noreferrer`.** `WhatsAppFab.tsx:9-16` (Header pill uses both). Fix: add ring; `rel="noopener noreferrer"`.

### ConsentBanner (`ConsentBanner.tsx`)
**Dimensions OK:** `role="dialog"`, hydration-safe, localStorage try/catch, links to Privacy.
- **[Medium] Close-X silently records "declined"; weak decline contrast; no focus mgmt.** `ConsentBanner.tsx:54-95` — X (`aria-label="Decline and close"`) writes a hard decline (dark-pattern-ish); "Decline" is low-emphasis `text-xs`; no auto-focus/`aria-modal`. Fix: X = dismiss-without-deciding; raise "Decline" to `text-sm`; focus on mount.
- **[Low] z-[60] buries sticky CTA/FAB on first load.** `ConsentBanner.tsx:57`. Fix: anchor clear of the bottom CTA zone.

### NavigationLoader (`NavigationLoader.tsx`)
**Dimensions OK:** `role="status"`, skips first mount, `z-[100]`, fires on path+params.
- **[Medium] Forced 700ms full-screen loader on every navigation** (incl. instant anchor jumps). `NavigationLoader.tsx:25-28`. Fix: cap ≤300ms or show only after a delay threshold; don't fire on in-page anchors.

### SocialProofToast (`SocialProofToast.tsx`) — shipped but NOT mounted
- **[Medium→High if mounted] Fabricated "✓ Verified" orders + sub-12px.** `SocialProofToast.tsx:50-58,118-127` — invented names/cities/times stamped "Verified". India CPA-2019/ASCI misleading-ad risk. Fix: drive from real orders or drop the "Verified" claim; confirm it stays unmounted.
- **[Low] 24px dismiss.** `SocialProofToast.tsx:129-136`.

### ExitIntentModal (`ExitIntentModal.tsx`) — shipped but NOT mounted (removed 2026-06-05)
- **[Low now / High if re-enabled] Phantom `DRIFT100` coupon that 404s at checkout; no Escape/focus trap.** `ExitIntentModal.tsx:9,96-115`. Fix: delete the retired component, or fix the coupon + add Escape/focus trap before re-enabling.
- **[Low] Coupon code is Nippo at 20px.** `ExitIntentModal.tsx:101`. Fix: `font-mono`.

---

## Screen cluster 2 — Home content sections

### SkuLineup (`SkuLineup.tsx`)
**Dimensions OK:** brand tokens, disabled states, INR formatting; uses the correct `focus-visible:ring` pattern at `:119`.
- **[High] Card-wide link overlaps the two action buttons → 3 tab stops/card, weak focus on body.** `SkuLineup.tsx:116-120,193-246`. Fix: `<article>` + `sr-only` link span; raise focus ring above body; `role="group"`.
- **[Medium] Hover-only title colour; focus ring sits behind body.** `SkuLineup.tsx:119/154`. Fix: `group-focus-within:text-brand-red`; ring `z-20`.
- **[Medium] Pick-reason badge can collide with scale label on narrow cards.** `SkuLineup.tsx:145-152`.
- **[Low] Buy-now label tight if prices reach 5 figures.** `SkuLineup.tsx:216`.

### FeatureCarousel (`FeatureCarousel.tsx`)
**Dimensions OK:** descriptive alt, lazy load, vignette contrast.
- **[High] Mobile carousel not keyboard-operable, no ARIA roles.** `FeatureCarousel.tsx:120-131` — plain `overflow-x-auto` div, swipe-only, cards 2–4 unreachable by keyboard. Fix: `tabIndex={0}`+`aria-label` on the scroller (or prev/next buttons).
- **[Low] Eyebrow contrast depends on image top-edge under the short vignette.** `FeatureCarousel.tsx:68,72`.

### OurStorySection (`OurStorySection.tsx`)
**Dimensions OK:** h2→h3 hierarchy, blockquote/figure semantics.
- **[High] `text-white/40` on near-black fails AA on the 8–10px "Coming soon".** `OurStorySection.tsx:109` (≈3.3:1). Fix: `text-white/70`.
- **[High] `text-[8px]` content on mobile.** `OurStorySection.tsx:56/73/88/106/109/128/147/164`. Fix: floor at 10–11px minimum.
- **[Medium] `grid-cols-2` at all breakpoints crams the smallest phones** (forces most copy `hidden sm:block`). `OurStorySection.tsx:33`. Fix: `grid-cols-1 sm:grid-cols-2`.
- **[Medium] Founder quote (top trust artefact) hidden on mobile.** `OurStorySection.tsx:174-180`. Fix: show a compact mobile variant.

### UgcGrid (`UgcGrid.tsx`)
**Dimensions OK:** reel alt, labelled play/sound buttons, lazy video, reduced-motion halts drift.
- **[High] Auto-scrolling rail: no pause control, not keyboard-reachable.** `UgcGrid.tsx:193-249,275-304` — WCAG 2.2.2 + 2.1.1. Fix: visible Pause/Play; `tabIndex={0}`+`aria-label` on track.
- **[Medium] 32px sound toggle.** `UgcGrid.tsx:152`. Fix: `w-11 h-11`.

### BundlePicker (`BundlePicker.tsx`)
**Dimensions OK:** `aria-pressed`, selected ring, badge contrast, CTA active scale.
- **[Medium] `scale-[1.02]` selected card can clip the `-top-3` "MOST POPULAR" badge in the scroller.** `BundlePicker.tsx:101,114-132`. Fix: `pt-4`+verify clipping.
- **[Low] Meaningful `alt` on `aria-hidden` image row (dead text).** `BundlePicker.tsx:154-177`. Fix: `alt=""`.
- **[Low] `<h3>` inside a `<button>` pollutes heading outline.** `BundlePicker.tsx:105,150`. Fix: styled `<span>`.

### OfferStack (`OfferStack.tsx`)
**Dimensions OK:** icons `aria-hidden`, brand chips, heading order.
- **[Medium] 72%-width cards, no keyboard handle, cards 4–5 swipe-only.** `OfferStack.tsx:70-71`. Fix: `tabIndex={0}`+`aria-label`; dots.
- **[Low] Dead `because` render branch (no data sets it).** `OfferStack.tsx:92-96`.

### FAQ (`FAQ.tsx`)
**Dimensions OK:** `aria-expanded`, native `<button>` toggles, +/- swap.
- **[Medium] Answer not associated with trigger (`aria-controls`/region missing).** `FAQ.tsx:20-52`. Fix: `aria-controls`+`id`+`role="region"`.
- **[Low] Height animation ignores reduced-motion.** `FAQ.tsx:40-45`.

### FinalCta (`FinalCta.tsx`)
**Dimensions OK:** white-on-red heading AA, `text-balance`.
- **[Medium] `text-white/80` at 11px on brand-red ≈3.6:1.** `FinalCta.tsx:43-45`. Fix: `text-white/90`+.
- **[Low] Emoji as meaningful glyph (no `aria-label`); inconsistent with lucide icons.** `FinalCta.tsx:41`. Fix: `<ShoppingBag aria-hidden/>`.
- **[Low] Gendered copy ("his gift") vs neutral elsewhere.** `FinalCta.tsx:29,41`.

### StatsStrip (`StatsStrip.tsx`)
**Dimensions OK:** white-on-ink AA, icons `aria-hidden`, responsive grid.
- **[Low] `font-display` (Nippo) at 14px** — violates the ≥40px rule. `StatsStrip.tsx:40`.

### UspIconRow (`UspIconRow.tsx`)
- **[Medium] Icons lack `aria-hidden`; section is an unlabeled landmark.** `UspIconRow.tsx:13,22-24`. Fix: `aria-hidden` on icons, `aria-label` on section.

### ValueStack (`ValueStack.tsx`)
**Dimensions OK:** success/red tokens, `tabular-nums`, white-on-red total AA.
- **[Medium] `truncate` hides included-item names on mobile** (defeats the section's purpose). `ValueStack.tsx:105`. Fix: `line-clamp-2`.
- **[Low] `text-[10px]/[11px]` mono labels.** `ValueStack.tsx:85/113/134/140`.

### TrustMarquee (`TrustMarquee.tsx`)
- **[High] Infinite marquee: no reduced-motion rule at all, no pause.** `TrustMarquee.tsx:55`, `globals.css:276`. Fix: add the reduced-motion rule (S7).
- **[Medium] Duplicated track read twice by SRs (clone not `aria-hidden`).** `TrustMarquee.tsx:41`.
- **[Low] `font-display` at 18-20px.** `TrustMarquee.tsx:32`.

### TrustStrip (`TrustStrip.tsx`)
- **[High] Gold `#d4a017` stars on cream ≈2.9:1** (the named pair). `TrustStrip.tsx:8`. Fix: darker gold + numeric rating in ink.
- **[Medium] Stars are decorative glyphs with no `role="img"`/`aria-label`.** `TrustStrip.tsx:8-15`.
- **[Medium] `whitespace-nowrap` trust line forces horizontal scroll on mobile.** `TrustStrip.tsx:6-7`. Fix: `whitespace-normal sm:whitespace-nowrap`.
- **[Low] `@highgear` handle not in `theme.featuredIn`.** `TrustStrip.tsx:14` vs `theme.ts:83`.

### CustomerReviewsSlider (`CustomerReviewsSlider.tsx`)
**Dimensions OK:** alt, `role="region"`+label, reduced-motion halts drift, priority images.
- **[High] Auto-scroll review rail: not keyboard-operable, no pause.** `CustomerReviewsSlider.tsx:181-192` — 18 photos unreachable by keyboard. Fix: `tabIndex={0}` + Pause toggle.
- **[Medium] Duplicated set (36 `<li>`) not `aria-hidden`.** `CustomerReviewsSlider.tsx:188`.
- **[Low] `cursor-grab` implies drag even if JS fails; `text-white/70` at 10px.** `:185,:223`.

### HowToUse (`HowToUse.tsx`) — cleanest in cluster
**Dimensions OK:** `<ol>` semantics, labelled section, icons hidden, responsive split.
- **[Low] `text-[10px]` detail strip (desktop-only).** `HowToUse.tsx:96`.

### LaunchCountdown (`LaunchCountdown.tsx`)
**Dimensions OK:** `aria-label` excludes seconds, `tabular-nums`, SSR-safe placeholder.
- **[Medium] `text-[8px]` unit labels; `text-white/55` fails on a red host.** `LaunchCountdown.tsx:108`. Fix: ≥10px, `text-white/75`.
- **[Medium] Ticking digits not `aria-hidden`** (verbose SRs may read seconds). `:105`.
- **[Low] `font-display` digits at 24-30px.** `:105`.

### RecentlyViewed (`RecentlyViewed.tsx`)
**Dimensions OK:** hover border+shadow, alt, responsive grid, MRP strike.
- **[Medium] Card links have no `focus-visible` ring.** `RecentlyViewed.tsx:59-63`.
- **[Low] `truncate` clips names at 2-up mobile; "See all" hidden on mobile.** `:74,:49`.

---

## Screen cluster 3 — Product Detail Page (PDP)

### PDPClient (`PDPClient.tsx`) — buy box, gallery, variants
**Dimensions OK:** add/buy disabled+sold-out states, qty stepper aria-labels+cap, `<ul>` bullets, `<dl>` spec table, sold-out swatches `disabled`+strike, single `<h1>`.
- **[High] Variant swatches: no roving tabindex / arrow-key nav and no focus ring distinct from selected.** `PDPClient.tsx:282-316`. Fix: roving `tabIndex`, arrow handlers, `focus-visible:ring` distinct from the selected ring.
- **[High] Add-to-Cart / Buy-Now have no loading/pending state** → double-tap risk. `PDPClient.tsx:450-467`. Fix: `pending` state + spinner + disable until `router.push`.
- **[High] Qty value not announced/focusable, no typed entry.** `PDPClient.tsx:437-439`. Fix: `aria-live="polite"` or real `<input type="number">`.
- **[High] Price hard-codes `−100` and free-ship `1099`** instead of `OFFERS.prepaidDiscountINR`/`THEME.freeShippingMinINR` → drift vs JSON-LD/checkout. `PDPClient.tsx:347-358,371-373`. Fix: import the tokens.
- **[High] Gallery thumbs not keyboard-coherent; no `aria-pressed`/focus ring.** `PDPClient.tsx:217-232`. Fix: `aria-pressed`+`focus-visible:ring`.
- **[Medium] Trust-row / box copy at 10-11px.** `PDPClient.tsx:476-493`.
- **[Medium] Sticky desktop gallery `no-scrollbar` can hide thumbs on short viewports.** `PDPClient.tsx:211`.
- **[Medium] `gallery.slice(0,4)` silently drops images 5+.** `PDPClient.tsx:215-217`.
- **[Medium] "Save" pill `bg-success/10 text-success` ~3:1 at small size.** `PDPClient.tsx:356-358`.
- **[Medium] Out-of-stock = dead end (no notify-me/alternative).** `PDPClient.tsx:460-467`.
- **[Low] Free-ship progress bar has no `role="progressbar"`.** `:387-392`. **[Low] Main image alt ignores selected colour.** `:213`.

### PDP loading (`product/[slug]/loading.tsx`)
**Dimensions OK:** `aria-busy`+`aria-label`, two-column mirror, pulse.
- **[Medium] Skeleton `max-w-7xl/px-10/gap-8` ≠ real `max-w-6xl/gap-12` → reflow.** `loading.tsx:12` vs `PDPClient.tsx:206`.
- **[Low] Skeleton swatch chips 40px vs real 44px.** `:36`.

### PDPStickyCTA (`PDPStickyCTA.tsx`)
**Dimensions OK:** desktop-only, `aria-hidden` toggle, disabled states, thumb alt.
- **[High] Shows `retailINR` (₹100 higher) while the buy box headlines `retailINR−100`** → conflicting prices. `PDPStickyCTA.tsx:88,117`. Fix: same online price or label "COD".
- **[High] Ignores selected quantity — always adds 1.** `PDPStickyCTA.tsx:45,51,117`. Fix: share qty state.
- **[Low] Hidden bar stays tab-focusable.** `:56-61`. Fix: `inert`/`tabIndex={-1}`.

### PDPBundleUpsell (`PDPBundleUpsell.tsx`)
**Dimensions OK:** brand tokens, INR, alt, success check.
- **[High] Checkbox-style toggle has no `role="checkbox"`/`aria-checked`/name.** `PDPBundleUpsell.tsx:99-139`. Fix: add role + `aria-checked` + `aria-label`.
- **[Medium] "Buy bundle" ignores selected colour & stock (uses default variant).** `PDPBundleUpsell.tsx:47-52`. Fix: pass selected colour + disabled.
- **[Medium] Third primary-button style + off-token `hover:bg-black`.** `PDPBundleUpsell.tsx:156-162`. Fix: `hover:bg-brand-ink/90`.
- **[Low] `text-success` small inline ~3:1.** `:124-126`.

### ReviewsBlock (`ReviewsBlock.tsx`) — not currently mounted
**Dimensions OK:** `id`+`aria-label`, `<ul>`, "Show more" button, verified badge.
- **[High] Stars are decorative SVGs, no aria → rating invisible to SRs.** `ReviewsBlock.tsx:132-143,196-206`. Fix: `role="img" aria-label="N out of 5"`.
- **[High] Gold `#d4a017` stars on white fail contrast.** `:139,158,202`. (S3)
- **[Medium] Body 13px / meta 10px.** `:188-215`. **[Medium] `<h2>` in body font at ≤24px** (mismatched type token). `:121`.
- **[Low] Different verified treatment vs `PdpReviews`.** `:216`.

### PdpReviews (`PdpReviews.tsx`) — not currently mounted
**Dimensions OK:** `Stars` has `aria-label`+hidden icons (correct), `<article>` semantics, empty state, display h2, en-IN dates.
- **[Medium] Stars `amber-400` here vs `--gold` in ReviewsBlock** (S2). `:20`.
- **[Low] Empty stars `text-brand-line` ≈1.2:1 (invisible).** `:22`.

### ProductImage (`ProductImage.tsx`)
**Dimensions OK:** `onError` fallback, `next/image` sizes/quality, muted/loop/playsInline video, play-dot hidden+desktop-only.
- **[Medium] Hover video unplayable on touch (stops on `touchEnd`); "Hover" hint desktop-only.** `ProductImage.tsx:72-79,125-135`. Fix: tap-to-toggle + mobile affordance.
- **[Low] Video `object-cover` vs poster `object-contain` → crop pop.** `:98,117`.

### ProductPlaceholder (`ProductPlaceholder.tsx`)
**Dimensions OK:** descriptive `aria-label`, decorative SVG `aria-hidden`, per-SKU gradients.
- **[Medium] Off-brand sky/violet/emerald/pink palette (S6).** `:6-40`. Fix: brand tints only.
- **[Low] Label `text-brand-ink/60` at 10px.** `:85-89`.

### Skeleton / PdpFloatingUi
**Dimensions OK:** `aria-hidden` skeletons with parent `aria-busy`; floating UI lazy-loads `ssr:false`.
- **[Low] Skeleton `bg-neutral-200/80` off-token (S6).** `Skeleton.tsx:21`. **[Low] FAB/sticky-CTA z-index not coordinated.** `PdpFloatingUi.tsx:20-23`.

---

## Screen cluster 4 — Checkout + Cart drawer + Pay button

### Checkout (`checkout/page.tsx`) — highest-stakes surface
**Dimensions OK:** phone `type="tel"`+digit-strip, pincode `inputMode="numeric"`+clamp, touched-gated inline validation, empty-cart redirect, double-submit + idempotency guard, Razorpay dismiss/failure recovery copy, sticky CTA honours safe-area, live serviceability/COD gating, 44px qty steppers.
- **[Critical] No `<label>` on any of the 8 address inputs — placeholder-only.** `checkout/page.tsx:1212-1358`. WCAG 4.1.2/3.3.2 on a payment form. Fix: real `<label htmlFor>`+`id` (or `aria-label`); placeholders as format hints only.
- **[High] No `autocomplete` tokens → mobile address autofill can't run.** `:1212-1351`. Fix: `name/tel/email/postal-code/address-line1/address-level2/address-level1`.
- **[High] Inputs `focus:outline-none` with no focus-visible ring (S1).** `:490,1243,1328,1559`.
- **[High] Errors not wired (`aria-invalid`/`aria-describedby`); submit error not a live region, no focus move.** `:1220-1363,1654-1658`. Fix: link errors by id, `role="alert"`+focus first invalid.
- **[High] Payment radios: no `fieldset`/`legend` / `radiogroup`.** `:1416-1496`. Fix: fieldset+legend or `role="radiogroup" aria-labelledby`.
- **[High] Submit error banner not announced, easy to miss on mobile** (perceived dead button). `:1654-1658`. Fix: `role="alert"`+`scrollIntoView`.
- **[Medium] line2 input bare (no wrapper, hardcoded classes); no `maxLength` on free-text; pincode `type="text"`; "Continue" disables only on `notServiceable`; COD disabled reason not tied via `aria-describedby`.** `:1320-1329,1212-1351,1266,1660-1664,1449-1465`.
- **[Low] mono `+91` prefix; `<h1>` Nippo at 30px; no `<form>` so Enter never submits.** `:1232,1015,1210`.

### PayButton (`PayButton.tsx`)
**Dimensions OK:** disables on loading, `data-loading` checkmark, ≥44px, label swaps.
- **[High] No `aria-busy`/live announcement while submitting** (silent for AT). `PayButton.tsx:31-45`. Fix: `aria-busy`+`role="status"`.
- **[Medium] Animated icon SVGs not `aria-hidden`; 2.5s infinite hover animation ignores reduced-motion.** `:47-83`, `globals.css:358-371`.
- **[Low] `type="button"` + no `<form>` → no Enter submit.** `:11,30`.

### Checkout loading (`checkout/loading.tsx`)
- **[High] Skeleton has a header bar + 2-col sidebar layout; the real page has no header and is a single `max-w-2xl` column → big hydration jump on the top-stakes page.** `loading.tsx:6-37` vs `page.tsx:985-1696`. Fix: rebuild to mirror real DOM.
- **[Low] Missing `bg-brand-cream`.** `:5`.

### Checkout error (`checkout/error.tsx`)
**Dimensions OK (excellent copy):** "don't pay again" + WhatsApp + last-4 recovery, logs digest, retry+home, shows digest, display h1.
- **[Medium] WhatsApp recovery styled as plain red text, no icon/green/`target`** (desktop nav-away). `error.tsx:39-45`. Fix: WhatsApp-green chip + icon + `target="_blank"`.
- **[Medium] "Try again" `reset()` can loop on deterministic crash.** `:49-55`. Fix: hard navigation.
- **[Low] Raw apostrophes vs project's `&apos;` convention.** `:29`.

### CartDrawer — checkout-relevant (see cluster 1 for the full list)
- **[High] 32px steppers/remove (`h-8 w-8`)** on the pre-purchase control. `CartDrawer.tsx:320-351`.
- Plus the drawer-total ≠ checkout-total and %-vs-₹ findings (cluster 1).

---

## Screen cluster 5 — Post-purchase & utility screens

### Order success (`orders/[id]/page.tsx`)
**Dimensions OK:** brand tokens, INR, COD/prepaid split, back link, `<dl>` receipt, masked phone, image alt.
- **[High] Order ID ("save this") is not copyable / selectable** — the only handle for track/review/replacement. `orders/[id]/page.tsx:150-157`. Fix: copy-to-clipboard button + "Copied".
- **[Medium] "refresh to see status" but no refresh control on a server page.** `:140-148`. Fix: visible "Refresh status" link.
- **[Medium] `text-[10px]` "Order ID" label** (the page's most critical value). `:151`.
- **[Low] Three competing WhatsApp CTAs.** `:394-439`.

### Order loading (`orders/[id]/loading.tsx`)
- **[Medium] `border-neutral-200` + `max-w-3xl` + fake header vs real `border-brand-line`/`max-w-2xl`/shared Header → reflow.** `loading.tsx:6-9`.

### Track order (`track/page.tsx`)
**Dimensions OK:** back link, input `aria-label`, error with icon, branded empty/cancelled/pending states with WhatsApp path, `<ol>` timeline, courier dead-end avoided.
- **[High] Status timeline conveys progress by colour/pulse only — no `aria-current`/sr-only state.** `track/page.tsx:259-308`. A blind user can't tell where the package is. Fix: `aria-current="step"` + sr-only "Completed/Current/Upcoming".
- **[High] "Now" marker is `animate-pulse` with no reduced-motion guard** (and is the only "current" cue). `:301`. Fix: `motion-reduce:animate-none` + text.
- **[Medium] Async fetch has no `aria-live` (errors/results not announced).** `:214-221`. **[Medium] status pills `text-[10px]/[11px]`** (meaning-bearing). `:225-241`. **[Medium] placeholder `text-brand-ink-soft/50` ~2:1.** `:202`.
- **[Low] Input focus is border-shift only; button no focus style (S1).** `:202-211`.

### Track loading (`track/loading.tsx`)
- **[Medium] `max-w-2xl` vs real `max-w-3xl`, `border-neutral-200`, no back-link placeholder → reflow.** `loading.tsx:6-14`.

### Review page (`review/[orderId]/page.tsx`)
**Dimensions OK:** branded "not delivered"/"no items" empty states with paths forward, `noindex`, per-SKU forms.
- **[High] `<h1>` `text-2xl/3xl` — below the Nippo 40px floor and smaller than sibling pages' h1.** `review/[orderId]/page.tsx:75-77`. Fix: `text-3xl sm:text-4xl`.
- **[Medium] No back link/nav** (track & policies have one). `:69-116`.
- **[Low] No route `loading.tsx`** (falls back to a product-grid skeleton). 

### Review form (`ReviewSubmitForm.tsx`)
**Dimensions OK:** all text inputs have `<label htmlFor>`, char limits, branded success, disabled submit until rating, `role="radiogroup"` on stars.
- **[Critical] Star rating not keyboard-operable as its declared radio group** (no arrow keys / roving tabindex) yet rating is required. `ReviewSubmitForm.tsx:116-142`. Fix: implement the radio pattern (roving tabindex, Arrow/Home/End, focus follows selection, per-star `aria-label`).
- **[High] Hover preview has no focus equivalent** (no `onFocus/onBlur`). `:127-138`.
- **[High] Stars/inputs/submit have no visible focus (S1).** `:130,158-214,226`.
- **[Medium] Error not `role="alert"`/associated; raw `data.reason` shown.** `:219-221,57`.
- **[Low] Stars `amber-400` (S2); empty stars `text-brand-line` ≈1.2:1.** `:136-137`.

### Policies (`policies/[slug]/page.tsx`)
**Dimensions OK:** back link, h1 clears the Nippo floor, `<article>`/`<h2>`/`<ul>` semantics, cross-links, external `rel`, `notFound()`.
- **[Medium] Inline links distinguished by colour only (no rest underline) + no focus style** (WCAG 1.4.1). `:63,170`. Fix: `underline underline-offset-4` + focus ring.
- **[Low] `text-[11px]` "Last updated".** `:153`.

### Policy loading (`policies/[slug]/loading.tsx`)
- **[Low] `border-neutral-200` + fake header (width matches, so minor).** `:6`.

### Maintenance / 503 (`maintenance/page.tsx`)
- **[High] Fully unbranded inline-styled dark page with NO path forward** (no WhatsApp, no retry, no home). `maintenance/page.tsx:15-90`. Hardcoded colours are defensible (DB-down resilience) but a dead-end with no exit is not. Fix: add a WhatsApp link + retry affordance.
- **[Low] `font-size:10px` eyebrow/ref.** `:34,80`.

### 404 not-found (`not-found.tsx`)
**Dimensions OK (strong):** branded ink bg + Nippo `text-5xl/7xl` h1, two CTAs + WhatsApp escape, decorative layers `aria-hidden`, responsive, `min-w-[200px]` buttons.
- **[Medium] `text-white/50` label on ink ≈3.5:1.** `:66`. Fix: `text-white/60`+.
- **[Low] No focus ring on the recovery CTAs.** `:49-77`.

### Root error boundary (`error.tsx`)
**Dimensions OK:** branded, `reset()`+home+WhatsApp, logs+digest, reassuring copy.
- **[Medium] Hardcoded phone + raw `wa.me` instead of `THEME.phoneDisplay`/`waLink()`.** `error.tsx:33`. Fix: import the constants (no DB/runtime).
- **[Low] No focus styling; `text-[10px]` digest.** `:36-51`.

### Loader / Skeleton / root loading
**Dimensions OK (model a11y):** `Loader` `role="status" aria-live="polite"`+hidden SVGs; root loading delegates to `RouteSkeleton`; skeletons `aria-hidden` with parent `aria-busy`.
- **[Medium] Truck `animate-truck-motion/road` has no reduced-motion guard (S7).** `Loader.tsx:20,117-135`.
- **[Medium] Skeletons use `bg-neutral-200` not `brand-line` (S6).** `Skeleton.tsx:19-117`.
- **[Low] Truck SVG hardcoded hex (`#282828`, `#E11D2A`) (S6).** `Loader.tsx:30-31`.

---

_(/16 store, admin, pack + COD clusters appended below as those audits complete.)_
