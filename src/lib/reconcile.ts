/**
 * Reconciliation orchestrator — the surge safety net. Run frequently from the
 * cron. Each step is independent, idempotent, and concurrency-safe so two
 * overlapping cron invocations cannot double-act.
 *
 * Steps:
 *  1. sweepAbandonedOrders — PENDING prepaid orders that never paid (closed the
 *     Razorpay modal, lost network, timed out) are marked ABANDONED and their
 *     reserved inventory + coupon usage released. This is what stops the
 *     "inventory leak": stock reserved at checkout is always returned.
 *  2. drainShipmentJobs — durable fulfillment queue; also re-enqueues any PAID
 *     order missing a shipment and reaps stuck PROCESSING leases.
 *  3. drainNotificationsOutbox — retry any notification that failed inline.
 *  4. alert if permanently-failed shipment jobs exist.
 */

import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { releaseOrderHolds } from "@/lib/inventory/release";
import {
  drainShipmentJobs,
  countFailedShipmentJobs,
} from "@/lib/fulfillment/shipment-queue";
import { drainNotificationsOutbox } from "@/lib/notifications/drain";
import { alertOps } from "@/lib/alert";
import { logError } from "@/lib/logger";

/** A prepaid order PENDING longer than this is considered abandoned. */
const ABANDON_AFTER_MINUTES = 30;

export async function sweepAbandonedOrders(
  olderThanMinutes = ABANDON_AFTER_MINUTES,
  limit = 200,
): Promise<{ swept: number; released: number }> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  // Only prepaid orders sit at PENDING — COD is marked PAID at create. Claim a
  // batch by flipping PENDING → ABANDONED atomically (the conditional UPDATE is
  // the claim; a concurrent sweep gets the remaining rows, never the same one).
  const claimed = await db
    .update(orders)
    .set({ status: "ABANDONED", cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(orders.status, "PENDING"),
        lt(orders.placedAt, cutoff),
        inArray(
          orders.id,
          db
            .select({ id: orders.id })
            .from(orders)
            .where(and(eq(orders.status, "PENDING"), lt(orders.placedAt, cutoff)))
            .limit(limit),
        ),
      ),
    )
    .returning({ id: orders.id });

  let released = 0;
  for (const o of claimed) {
    try {
      const r = await releaseOrderHolds(o.id, "ABANDONED");
      if (r.released) released++;
    } catch (err) {
      logError("reconcile:release", err, { orderId: o.id });
    }
  }

  return { swept: claimed.length, released };
}

export type ReconcileSummary = {
  abandoned: { swept: number; released: number };
  shipments: Awaited<ReturnType<typeof drainShipmentJobs>>;
  notifications: Awaited<ReturnType<typeof drainNotificationsOutbox>>;
  failedShipmentJobs: number;
};

export async function reconcileAll(): Promise<ReconcileSummary> {
  const abandoned = await sweepAbandonedOrders().catch((err) => {
    logError("reconcile:sweep", err);
    return { swept: 0, released: 0 };
  });

  const shipments = await drainShipmentJobs(50).catch((err) => {
    logError("reconcile:shipments", err);
    return { enqueued: 0, reaped: 0, processed: 0, done: 0, failed: 0 };
  });

  const notifications = await drainNotificationsOutbox(200).catch((err) => {
    logError("reconcile:notifications", err);
    return { drained: 0, sent: 0, failed: 0, exhausted: 0 };
  });

  const failedShipmentJobs = await countFailedShipmentJobs().catch(() => 0);
  if (failedShipmentJobs > 0) {
    await alertOps({
      scope: "reconcile",
      message: `${failedShipmentJobs} shipment job(s) parked FAILED and need manual attention`,
      context: { failedShipmentJobs },
    });
  }

  return { abandoned, shipments, notifications, failedShipmentJobs };
}
