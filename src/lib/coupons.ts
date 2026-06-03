/**
 * Server-only coupon validator. Single source of truth for both the preview
 * route (/api/coupons/validate) and the order-create transactional redemption.
 *
 * `validateCoupon` — read-only preview (no perCustomerLimit check; caller
 * passes customerId if known to gate this).
 *
 * `redeemCoupon` — atomic redemption inside a Drizzle transaction:
 *   1. UPDATE coupons SET used_count = used_count + 1 WHERE <every gate>
 *      RETURNING — zero rows means another concurrent redemption won.
 *   2. Lock the customer row, count existing redemptions of this coupon
 *      by this customer, reject if perCustomerLimit exceeded.
 *   3. INSERT into customer_coupon_redemptions ledger.
 * Any failure throws CouponError and rolls back the whole order transaction.
 */

import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { coupons, customerCouponRedemptions, customers } from "@/db/schema";

export type CouponDiscount = {
  couponId: string;
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
  /** If present, also reject when this customer has already redeemed the
   *  coupon as many times as perCustomerLimit allows. */
  customerId?: string | null;
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

  // Per-customer limit — only enforce when we know the customer.
  if (input.customerId && c.perCustomerLimit != null) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerCouponRedemptions)
      .where(
        and(
          eq(customerCouponRedemptions.customerId, input.customerId),
          eq(customerCouponRedemptions.couponId, c.id),
        ),
      );
    if (count >= c.perCustomerLimit) {
      throw new CouponError("You've already used this coupon");
    }
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

  return { couponId: c.id, code: c.code, type: c.type, discountInr };
}

/**
 * Atomic redemption. Bumps used_count + writes the per-customer ledger row,
 * race-safe under concurrent redemptions of the same coupon by the same
 * customer (the customer row is SELECT … FOR UPDATE locked, serialising
 * concurrent transactions over the same customer).
 *
 * Throws CouponError on every rejection path. Designed to be called inside
 * the order-create transaction so a failed redemption rolls back the order.
 */
export async function redeemCoupon(input: {
  tx: PgTransaction<any, any, any> | typeof db;
  code: string;
  siteId: string;
  customerId: string;
  orderId: string;
  subtotalInr: number;
  shippingInr: number;
}): Promise<CouponDiscount> {
  const tx = input.tx;
  const code = input.code.trim().toUpperCase();
  if (!code) throw new CouponError("Enter a coupon code");

  // 1. Atomic used_count++ under every aggregate gate.
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
    // Re-read for a precise error message. If the row genuinely passes today
    // but our UPDATE lost the count race, surface a generic retry message.
    try {
      await validateCoupon({
        code,
        siteId: input.siteId,
        subtotalInr: input.subtotalInr,
        shippingInr: input.shippingInr,
      });
    } catch (err) {
      if (err instanceof CouponError) throw err;
      throw err;
    }
    throw new CouponError("Coupon redemption failed — try again");
  }

  const c = updated[0];

  // 2. Per-customer limit — lock the customer row so concurrent transactions
  //    can't both pass the count check.
  if (c.perCustomerLimit != null) {
    await tx.execute(
      sql`SELECT id FROM customers WHERE id = ${input.customerId} FOR UPDATE`,
    );
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(customerCouponRedemptions)
      .where(
        and(
          eq(customerCouponRedemptions.customerId, input.customerId),
          eq(customerCouponRedemptions.couponId, c.id),
        ),
      );
    if (count >= c.perCustomerLimit) {
      throw new CouponError("You've already used this coupon");
    }
  }

  const discountInr = applyValue(
    c.type,
    c.value,
    input.subtotalInr,
    input.shippingInr,
    c.maxDiscountInr,
  );

  // 3. Append-only ledger row — links discount to a specific order.
  await tx.insert(customerCouponRedemptions).values({
    customerId: input.customerId,
    couponId: c.id,
    orderId: input.orderId,
    discountInr,
  });

  return { couponId: c.id, code: c.code, type: c.type, discountInr };
}

// `customers` import is used inside the SQL FOR UPDATE — re-export it as a
// no-op to make TypeScript treat the import as used.
export type _CustomersRef = typeof customers;
