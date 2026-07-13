/**
 * THE pricing engine — the single place that decides what a cart costs.
 *
 * Before this existed, the total was computed independently in checkout/page.tsx
 * (the preview the buyer sees) and orders/create (the money actually charged).
 * Two copies of the same arithmetic is how a discount silently drifts between
 * what you promise and what you bill. Both now call `priceCart`.
 *
 * ── THE POLICY: "best compatible discount wins" ───────────────────────────────
 *
 * Discounts are NOT summed blindly. We build every legal combination, then keep
 * the one that saves the buyer the most:
 *
 *   STANDARD  = prepaid + bundle + manual coupon      (these stack, as they always have)
 *   BARGAIN   = the won bargain price, ALONE          (exclusive — it IS the negotiated price)
 *
 *   winner = whichever saves more
 *
 * Two things fall out of that, both of which used to be bugs:
 *
 *   1. NO STACKING. A bargain can never be added on top of bundle+prepaid, so a
 *      ₹1,099 car can't be talked down and then discounted twice more.
 *
 *   2. A WINNER CAN NEVER PAY MORE. If the buyer's negotiated price is worse than
 *      the automatic discounts they already had, we silently give them the better
 *      STANDARD deal instead. Winning a game must never cost you money — that is
 *      the fastest way to destroy trust in the game.
 *
 * Manual marketing coupons deliberately keep stacking with prepaid/bundle. That is
 * existing, intended acquisition behaviour (DRIFT100 is meant to feel additive);
 * changing it is a pricing-policy decision, not a side effect of fixing the bargain.
 *
 * Adding a new discount later (cashback, loyalty) means adding it to a candidate
 * here — and nowhere else.
 */

import { OFFERS, bundleDiscountInr, bundleTierLabel } from "@/lib/config";

/** Flat shipping charged below the free-shipping threshold. */
export const SHIPPING_FLAT_INR = 85;

export type PaymentMode = "cod" | "prepaid";

export type PricingCoupon = {
  code: string;
  discountInr: number;
  /** A won-bargain coupon (SKU-bound). Exclusive — never stacks. */
  isBargain: boolean;
};

export type PricingInput = {
  subtotalInr: number;
  /** Total UNITS in the cart (drives the bundle tier). */
  itemCount: number;
  payment: PaymentMode;
  coupon?: PricingCoupon | null;
};

export type AppliedDiscount = {
  kind: "prepaid" | "bundle" | "coupon" | "bargain";
  label: string;
  amountInr: number;
};

export type Pricing = {
  subtotalInr: number;
  shippingInr: number;
  codFeeInr: number;
  /** The discounts that actually won — render exactly these, nothing else. */
  discounts: AppliedDiscount[];
  /** Sum of `discounts`. This is what goes in orders.discount_inr. */
  discountInr: number;
  totalInr: number;
  /** Which candidate won. */
  policy: "standard" | "bargain";
  /**
   * Did the supplied coupon actually contribute? A bargain coupon that LOST to the
   * standard discounts contributes nothing — so the caller must not burn it.
   */
  couponApplied: boolean;
};

export function priceCart(input: PricingInput): Pricing {
  const subtotal = Math.max(0, Math.round(input.subtotalInr));
  const coupon = input.coupon ?? null;

  // ── Fees (not discounts — they don't compete) ──────────────────────────────
  const shipping = subtotal >= OFFERS.freeShippingMinINR ? 0 : SHIPPING_FLAT_INR;
  const codFee =
    input.payment === "cod" && subtotal < OFFERS.codFeeAppliesBelowINR
      ? OFFERS.codFeeINR
      : 0;

  // ── Every eligible discount, computed independently ────────────────────────
  const prepaid = input.payment !== "cod" ? OFFERS.prepaidDiscountINR : 0;
  const bundle = bundleDiscountInr(input.itemCount, subtotal);
  const bundleName = bundleTierLabel(input.itemCount);
  const manualCoupon = coupon && !coupon.isBargain ? Math.max(0, coupon.discountInr) : 0;
  const bargain = coupon?.isBargain ? Math.max(0, coupon.discountInr) : 0;

  // ── Candidate A: STANDARD (prepaid + bundle + manual coupon all stack) ─────
  const standard: AppliedDiscount[] = [];
  if (prepaid > 0) {
    standard.push({ kind: "prepaid", label: "Prepaid (pay-online) discount", amountInr: prepaid });
  }
  if (bundle > 0) {
    standard.push({
      kind: "bundle",
      label: `Bundle offer${bundleName ? ` (${bundleName})` : ""}`,
      amountInr: bundle,
    });
  }
  if (manualCoupon > 0 && coupon) {
    standard.push({ kind: "coupon", label: `Coupon (${coupon.code})`, amountInr: manualCoupon });
  }
  const standardTotal = standard.reduce((n, d) => n + d.amountInr, 0);

  // ── Candidate B: BARGAIN (alone — it IS the negotiated price) ──────────────
  const bargainSet: AppliedDiscount[] =
    bargain > 0 && coupon
      ? [{ kind: "bargain", label: `Coupon (${coupon.code}) · negotiated price`, amountInr: bargain }]
      : [];

  // ── Best compatible discount wins. A bargain that loses is simply not applied,
  //    so the buyer keeps the better automatic deal AND their coupon isn't burnt.
  const bargainWins = bargain > 0 && bargain > standardTotal;
  const discounts = bargainWins ? bargainSet : standard;
  const discountInr = discounts.reduce((n, d) => n + d.amountInr, 0);

  const totalInr = Math.max(0, subtotal + shipping + codFee - discountInr);

  return {
    subtotalInr: subtotal,
    shippingInr: shipping,
    codFeeInr: codFee,
    discounts,
    discountInr,
    totalInr,
    policy: bargainWins ? "bargain" : "standard",
    couponApplied: bargainWins ? true : manualCoupon > 0,
  };
}
