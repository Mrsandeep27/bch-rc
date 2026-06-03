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
