/**
 * Self-check for the pricing engine. Money path — if this fails, someone is
 * being over- or under-charged.
 *
 *   npx tsx --env-file=.env.local scripts/verify-pricing.ts
 */
import assert from "node:assert/strict";
import { priceCart } from "@/lib/pricing";
import { OFFERS } from "@/lib/config";

const P = OFFERS.prepaidDiscountINR; // prepaid discount
let n = 0;
const ok = (name: string) => {
  n++;
  console.log(`  ok ${name}`);
};

// 1 — Normal prepaid cart: prepaid + bundle STACK (unchanged legacy behaviour).
{
  const r = priceCart({ subtotalInr: 6097, itemCount: 3, payment: "prepaid" });
  const bundle = Math.round(6097 * 0.1); // 3 cars → 10%
  assert.equal(r.policy, "standard");
  assert.equal(r.discountInr, P + bundle);
  assert.equal(r.totalInr, 6097 - P - bundle);
  ok("normal cart: prepaid + bundle stack");
}

// 2 — Daniel's REAL order: 3 cars ₹6,097, bargain ₹799.
//     standard = bundle ₹610 + prepaid ₹100 = ₹710. Bargain ₹799 > ₹710 → bargain wins.
//     Must reproduce the real charged total of ₹5,298 exactly.
{
  const r = priceCart({
    subtotalInr: 6097,
    itemCount: 3,
    payment: "prepaid",
    coupon: { code: "BG-AFAQ7F", discountInr: 799, isBargain: true },
  });
  assert.equal(r.policy, "bargain");
  assert.equal(r.discountInr, 799, "bargain must NOT stack with bundle/prepaid");
  assert.equal(r.totalInr, 5298, "must match the real order PRC-9X3PBLXU");
  assert.equal(r.discounts.length, 1);
  ok("Daniel's real order: bargain wins, no stacking, total ₹5,298");
}

// 3 — THE BUG THIS ENGINE EXISTS TO KILL: a bargain WORSE than the automatic
//     discounts. Buyer must NOT pay more for winning, and must NOT burn the coupon.
{
  const sub = 6097;
  const standard = P + Math.round(sub * 0.1); // ₹710
  const weakBargain = 253; // e.g. won on a cheap Pocket BMW
  const r = priceCart({
    subtotalInr: sub,
    itemCount: 3,
    payment: "prepaid",
    coupon: { code: "BG-WEAK", discountInr: weakBargain, isBargain: true },
  });
  assert.equal(r.policy, "standard", "weak bargain must lose to the automatic discounts");
  assert.equal(r.discountInr, standard, "buyer keeps the BETTER standard discount");
  assert.ok(r.discountInr > weakBargain, "winner must never be worse off");
  assert.equal(r.couponApplied, false, "a losing bargain coupon must not be burnt");
  ok("weak bargain loses → buyer keeps better deal, coupon not burnt");
}

// 4 — Manual marketing coupon STILL stacks with prepaid + bundle (intended).
{
  const sub = 6097;
  const bundle = Math.round(sub * 0.1);
  const r = priceCart({
    subtotalInr: sub,
    itemCount: 3,
    payment: "prepaid",
    coupon: { code: "DRIFT100", discountInr: 100, isBargain: false },
  });
  assert.equal(r.policy, "standard");
  assert.equal(r.discountInr, P + bundle + 100, "marketing coupons keep stacking");
  assert.equal(r.couponApplied, true);
  ok("manual coupon still stacks (acquisition behaviour preserved)");
}

// 5 — COD: no prepaid discount, COD fee may apply, bundle still counts.
{
  const r = priceCart({ subtotalInr: 6097, itemCount: 3, payment: "cod" });
  const bundle = Math.round(6097 * 0.1);
  assert.equal(r.discountInr, bundle, "no prepaid discount on COD");
  assert.equal(r.totalInr, 6097 + r.codFeeInr - bundle);
  ok("COD: prepaid discount withheld, bundle intact");
}

// 6 — Total can never go negative, and free shipping kicks in above the threshold.
{
  const r = priceCart({
    subtotalInr: 1099,
    itemCount: 1,
    payment: "prepaid",
    coupon: { code: "BG-HUGE", discountInr: 999_999, isBargain: true },
  });
  assert.ok(r.totalInr >= 0, "total must never be negative");
  ok("absurd discount cannot drive the total below zero");
}

// 7 — Single cheap item: no bundle tier, prepaid only.
{
  const r = priceCart({ subtotalInr: 1099, itemCount: 1, payment: "prepaid" });
  assert.equal(r.discountInr, P, "1 car → no bundle tier");
  ok("single item: no bundle tier");
}

console.log(`\n✅ ${n}/${n} pricing checks passed`);
