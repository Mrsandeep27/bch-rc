/**
 * Server-only coupon validator. Single source of truth for both the preview
 * route (/api/coupons/validate) and the order-create transactional redemption.
 *
 * `validateCoupon` is a read-only check used at the preview/cart step.
 * `redeemCoupon` is an atomic UPDATE that increments used_count only if all
 * gates pass; pass `tx` to participate in the order creation transaction so
 * a coupon and its order are committed together.
 */

import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { coupons } from "@/db/schema";

export type CouponDiscount = {
  code: string;
  type: "FLAT_INR" | "PERCENT" | "FREE_SHIPPING";
  discountInr: number;
};

export class CouponError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "CouponError";
  }
}

function applyValue(
  type: "FLAT_INR" | "PERCENT" | "FREE_SHIPPING",
  value: number,
  subtotalInr: number,
  shippingInr: number,
  maxDiscountInr: number | null,
): number {
  if (type === "FLAT_INR") {
    return Math.min(value, subtotalInr);
  }
  if (type === "PERCENT") {
    // value stored as percent×100 (e.g. 1500 = 15%)
    const raw = Math.floor((subtotalInr * value) / 10000);
    return maxDiscountInr != null ? Math.min(raw, maxDiscountInr) : raw;
  }
  // FREE_SHIPPING
  return shippingInr;
}

export async function validateCoupon(input: {
  code: string;
  siteId: string;
  subtotalInr: number;
  shippingInr: number;
}): Promise<CouponDiscount> {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new CouponError("Enter a coupon code");

  const rows = await db
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.code, code),
        eq(coupons.active, true),
        or(isNull(coupons.siteId), eq(coupons.siteId, input.siteId)),
      ),
    )
    .limit(1);

  const c = rows[0];
  if (!c) throw new CouponError("Coupon not found");
  if (c.validFrom > new Date()) throw new CouponError("Coupon not yet active");
  if (c.validTo && c.validTo < new Date()) throw new CouponError("Coupon expired");
  if (c.minOrderInr > input.subtotalInr) {
    throw new CouponError(`Minimum order ₹${c.minOrderInr.toLocaleString("en-IN")}`);
  }
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
    throw new CouponError("Coupon fully redeemed");
  }

  const discountInr = applyValue(
    c.type,
    c.value,
    input.subtotalInr,
    input.shippingInr,
    c.maxDiscountInr,
  );

  if (discountInr <= 0) {
    throw new CouponError("Coupon yields no discount on this order");
  }

  return { code: c.code, type: c.type, discountInr };
}

/**
 * Atomic redemption. Increments used_count ONLY if the coupon still passes
 * every gate (race-safe against parallel redemptions of a capped coupon).
 *
 * Returns the discount applied. Throws CouponError on any gate failure.
 *
 * Designed to be called inside a Drizzle transaction so a failed redemption
 * rolls back the order insert too.
 */
export async function redeemCoupon(input: {
  tx: PgTransaction<any, any, any> | typeof db;
  code: string;
  siteId: string;
  subtotalInr: number;
  shippingInr: number;
}): Promise<CouponDiscount> {
  const tx = input.tx;
  const code = input.code.trim().toUpperCase();
  if (!code) throw new CouponError("Enter a coupon code");

  // Atomic UPDATE: bumps used_count only if every gate holds. We use the
  // RETURNING clause to read the row that just incremented; zero rows back
  // means the coupon was rejected (and we know why via a follow-up read).
  const updated = await tx
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(
      and(
        eq(coupons.code, code),
        eq(coupons.active, true),
        or(isNull(coupons.siteId), eq(coupons.siteId, input.siteId)),
        sql`${coupons.validFrom} <= now()`,
        or(isNull(coupons.validTo), gt(coupons.validTo, sql`now()`)),
        sql`${coupons.minOrderInr} <= ${input.subtotalInr}`,
        or(
          isNull(coupons.usageLimit),
          sql`${coupons.usedCount} < ${coupons.usageLimit}`,
        ),
      ),
    )
    .returning();

  if (updated.length === 0) {
    // Fallback read to produce a precise error.
    await validateCoupon({
      code,
      siteId: input.siteId,
      subtotalInr: input.subtotalInr,
      shippingInr: input.shippingInr,
    });
    // If validateCoupon DIDN'T throw, the row was redeemed by a concurrent request.
    throw new CouponError("Coupon fully redeemed");
  }

  const c = updated[0];
  const discountInr = applyValue(
    c.type,
    c.value,
    input.subtotalInr,
    input.shippingInr,
    c.maxDiscountInr,
  );

  return { code: c.code, type: c.type, discountInr };
}
