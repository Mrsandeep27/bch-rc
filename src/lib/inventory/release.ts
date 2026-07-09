/**
 * Exactly-once release of an order's reserved holds — inventory stock AND
 * coupon usage — back to the pool.
 *
 * Design: stock and coupon usage are RESERVED at order-create (the PENDING
 * order row is the reservation record). When an order reaches a terminal,
 * un-fulfilled state — payment FAILED, abandoned/timed-out, CANCELLED, or
 * REFUNDED — those reservations must be returned, once and only once.
 *
 * Concurrency: the whole release runs in a single transaction. The first
 * statement atomically flips `orders.holds_released` false → true with a
 * conditional UPDATE; that row-locked flip IS the claim. If it returns zero
 * rows another caller already released (or the order never existed), and we
 * no-op. So firing this from the failed-webhook, the refund-webhook, AND the
 * abandoned-sweeper concurrently is safe — exactly one of them does the work.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  inventory,
  customerCouponRedemptions,
  coupons,
  events,
} from "@/db/schema";
import { logError } from "@/lib/logger";
import { INVENTORY_SITE_ID } from "@/lib/inventory";

type OrderItem = {
  skuId: string;
  variantSlug: string | null;
  qty: number;
};

export type ReleaseReason =
  | "PAYMENT_FAILED"
  | "ABANDONED"
  | "CANCELLED"
  | "REFUNDED";

export type ReleaseResult = {
  released: boolean;
  orderId: string;
  restoredLines: number;
  couponRowsReleased: number;
};

/**
 * Release inventory + coupon holds for an order. Idempotent + concurrency-safe.
 * Never throws on the no-op path; surfaces DB errors to the caller.
 */
export async function releaseOrderHolds(
  orderId: string,
  reason: ReleaseReason,
): Promise<ReleaseResult> {
  return db.transaction(async (tx) => {
    // ── Atomic claim: flip false → true exactly once. ──────────────────
    const claimed = await tx
      .update(orders)
      .set({ holdsReleased: true, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.holdsReleased, false)))
      .returning({
        items: orders.items,
        siteId: orders.siteId,
        customerId: orders.customerId,
      });

    if (claimed.length === 0) {
      // Already released by another path, or order doesn't exist. No-op.
      return { released: false, orderId, restoredLines: 0, couponRowsReleased: 0 };
    }

    const { items, siteId, customerId } = claimed[0];
    const lines = (items as OrderItem[]) ?? [];

    // ── Restore reserved stock for each line. Single inventory: restore
    //    targets INVENTORY_SITE_ID, symmetric with the order-create decrement
    //    (the order row's own siteId is a storefront label, not a keyspace). ─
    let restoredLines = 0;
    for (const line of lines) {
      const variantKey = line.variantSlug ?? "";
      await tx
        .update(inventory)
        .set({
          stock: sql`${inventory.stock} + ${line.qty}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventory.siteId, INVENTORY_SITE_ID),
            eq(inventory.skuId, line.skuId),
            eq(inventory.variantSlug, variantKey),
          ),
        );
      restoredLines++;
    }

    // ── Release coupon usage. The ledger is the source of truth: delete
    //    this order's redemption rows and decrement the matching coupons. ─
    const released = await tx
      .delete(customerCouponRedemptions)
      .where(eq(customerCouponRedemptions.orderId, orderId))
      .returning({ couponId: customerCouponRedemptions.couponId });

    for (const r of released) {
      await tx
        .update(coupons)
        .set({ usedCount: sql`GREATEST(0, ${coupons.usedCount} - 1)` })
        .where(eq(coupons.id, r.couponId));
    }

    await tx.insert(events).values({
      siteId,
      orderId,
      customerId,
      type: "HOLDS_RELEASED",
      payload: { reason, restoredLines, couponRowsReleased: released.length },
      source: "system",
    });

    return {
      released: true,
      orderId,
      restoredLines,
      couponRowsReleased: released.length,
    };
  });
}

/**
 * RE-ACQUIRE holds for an order whose stock was previously released — used when
 * a captured payment arrives AFTER a failed attempt already released the order
 * (a Razorpay retry: fail → release → succeed). A captured payment is ground
 * truth, so we must re-reserve the stock before marking the order PAID, or we'd
 * under-ship / oversell. Idempotent + concurrency-safe via the same holds_released
 * flag (true → false flip is the claim).
 *
 * Coupon usage is intentionally NOT re-redeemed: the redemption ledger rows were
 * deleted on release and the discount is already baked into the order total, so
 * re-charging coupon usage adds risk for no customer-facing benefit. Logged so
 * it's visible if it ever matters for coupon-limit accounting.
 */
export async function reacquireOrderHolds(
  orderId: string,
): Promise<{ reacquired: boolean; restoredLines: number }> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(orders)
      .set({ holdsReleased: false, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.holdsReleased, true)))
      .returning({
        items: orders.items,
        siteId: orders.siteId,
        customerId: orders.customerId,
      });

    if (claimed.length === 0) {
      // Holds were never released (normal paid path) or already re-acquired.
      return { reacquired: false, restoredLines: 0 };
    }

    const { items, siteId, customerId } = claimed[0];
    const lines = (items as OrderItem[]) ?? [];

    let restoredLines = 0;
    for (const line of lines) {
      const variantKey = line.variantSlug ?? "";
      // Re-reserve: decrement. Allowed to go negative — a PAID order must be
      // honoured; ops can correct stock in /admin/products if it does.
      await tx
        .update(inventory)
        .set({
          stock: sql`${inventory.stock} - ${line.qty}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventory.siteId, INVENTORY_SITE_ID),
            eq(inventory.skuId, line.skuId),
            eq(inventory.variantSlug, variantKey),
          ),
        );
      restoredLines++;
    }

    await tx.insert(events).values({
      siteId,
      orderId,
      customerId,
      type: "HOLDS_REACQUIRED",
      payload: { restoredLines, note: "captured payment recovered a released order; coupon usage not re-applied" },
      source: "system",
    });

    return { reacquired: true, restoredLines };
  });
}

/** Fire-and-forget wrapper for webhook hot paths; logs and swallows errors. */
export async function releaseOrderHoldsBestEffort(
  orderId: string,
  reason: ReleaseReason,
): Promise<void> {
  try {
    await releaseOrderHolds(orderId, reason);
  } catch (err) {
    logError("inventory:release", err, { orderId, reason });
  }
}
