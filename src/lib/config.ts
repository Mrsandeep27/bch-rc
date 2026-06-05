/**
 * Legacy config — re-exports from theme.ts so existing imports keep working
 * while the single source of truth lives in theme.ts.
 *
 * To clone this template for a new store: edit theme.ts only.
 */
import { THEME, waLink as themeWaLink } from "./theme";

export const BRAND = {
  name: THEME.brandName,
  fullName: THEME.fullName,
  city: THEME.city,
  whatsappNumber: THEME.whatsappNumber,
  email: THEME.email,
  phoneDisplay: THEME.phoneDisplay,
  address: `${THEME.city} HQ`,
  instagram: `@${THEME.instagramHandle}`,
  youtube: `@${THEME.youtubeHandle}`,
} as const;

export const OFFERS = {
  prepaidDiscountINR: THEME.prepaidDiscountINR,
  freeShippingMinINR: THEME.freeShippingMinINR,
  codFeeINR: THEME.codFeeINR,
  codFeeAppliesBelowINR: THEME.codFeeAppliesBelowINR,
  bundle2PriceINR: THEME.bundle2PriceINR,
  bundle2SaveINR: THEME.bundle2SaveINR,
  ledSmokeUpgradeINR: THEME.ledSmokeUpgradeINR,
} as const;

/**
 * Bundle-bonus tiers — auto-apply at checkout based on TOTAL cart quantity
 * (mix any cars). Single source of truth used by:
 *   - client checkout summary  (src/app/checkout/page.tsx)
 *   - server order creator     (src/app/api/orders/create/route.ts)
 *   - order receipt page       (src/app/orders/[id]/page.tsx)
 *   - email templates          (src/lib/notifications/templates.ts)
 *   - cart drawer nudge        (src/components/CartDrawer.tsx)
 *   - BundlePicker marketing   (src/components/BundlePicker.tsx)
 *
 * Tiers are evaluated highest-first so 5+ cars always get the top-tier
 * bonus. Add new tiers in ascending-qty order — the lookup picks the
 * largest tier whose `minQty` is <= cart count.
 */
export const BUNDLE_TIERS = [
  { minQty: 2, bonusInr: 298, label: "2-car bundle" },
  { minQty: 3, bonusInr: 698, label: "3-car bundle" },
] as const;

export function bundleDiscountInr(itemCount: number): number {
  let bonus = 0;
  for (const tier of BUNDLE_TIERS) {
    if (itemCount >= tier.minQty) bonus = tier.bonusInr;
  }
  return bonus;
}

export function bundleTierLabel(itemCount: number): string | null {
  let label: string | null = null;
  for (const tier of BUNDLE_TIERS) {
    if (itemCount >= tier.minQty) label = tier.label;
  }
  return label;
}

/**
 * The first-order coupon we surface and auto-apply at checkout. Kept here (not
 * hard-coded in the UI) so it's the single place to change/disable the headline
 * offer. The server still validates + redeems it transactionally — auto-apply
 * is a convenience, never a source of truth.
 */
export const AUTO_COUPON = {
  code: "CODEPRC100",
  label: "₹100 OFF your first order",
} as const;

export const TRUST = {
  ordersShipped: THEME.ordersShipped,
  rating: THEME.rating,
  reviewCount: THEME.reviewCount,
  instagramFollowers: THEME.instagramFollowers,
} as const;

export const waLink = themeWaLink;
