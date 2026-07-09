/**
 * Shared COD verification core — the confirm/reject state machine that both
 * the /cod operator console (src/app/cod/actions.ts) and the admin order-detail
 * page (src/app/admin/(authed)/orders/[id]/actions.ts) call.
 *
 * These functions do NOT check auth and do NOT revalidatePath — each caller
 * gates access its own way (COD cookie vs. requireAdmin + site check) and
 * revalidates its own route. The money/shipment logic (atomic PAID flip,
 * shipment enqueue, ORDER_CONFIRMED notifications) and the hold-release logic
 * live HERE, once, so the admin surface reuses the exact same path instead of
 * re-implementing it.
 *
 * The atomic conditional UPDATE (status = PENDING_COD_VERIFICATION → PAID /
 * CANCELLED) is the concurrency guard: two callers racing to act on the same
 * order — one operator on /cod, one admin — can't double-act; the second finds
 * no eligible row.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, orders } from "@/db/schema";
import {
  enqueueShipmentJob,
  runShipmentJobOnce,
} from "@/lib/fulfillment/shipment-queue";
import { releaseOrderHolds } from "@/lib/inventory/release";
import { notifyOrderEvent, whatsappEnabled } from "@/lib/notifications/notify";
import { logError } from "@/lib/logger";

export type CodActor = {
  /** events.source value — "admin" for both /cod operators and admins. */
  source: string;
  /** Admin email for the audit payload; omitted for /cod operators. */
  email?: string;
};

export type CodVerifyResult =
  | { ok: true; message: string; siteId: string }
  | { ok: false; error: string };

/**
 * PENDING_COD_VERIFICATION → PAID. Enqueues + runs the shipment job, fires the
 * ORDER_CONFIRMED email/WhatsApp, logs COD_VERIFIED. Idempotent via the atomic
 * flip: a second caller finds no eligible row and gets the "no longer pending"
 * error rather than double-confirming.
 */
export async function confirmCodOrderCore(
  orderId: string,
  actor: CodActor = { source: "admin" },
): Promise<CodVerifyResult> {
  const claimed = await db
    .update(orders)
    .set({
      status: "PAID",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(orders.id, orderId), eq(orders.status, "PENDING_COD_VERIFICATION")),
    )
    .returning({
      id: orders.id,
      siteId: orders.siteId,
      customerId: orders.customerId,
      totalInr: orders.totalInr,
    });

  if (claimed.length === 0) {
    return {
      ok: false,
      error: "Order is no longer pending — refresh the page.",
    };
  }
  const o = claimed[0];

  await db.insert(events).values({
    siteId: o.siteId,
    orderId: o.id,
    customerId: o.customerId,
    type: "COD_VERIFIED",
    payload: {
      total: o.totalInr,
      ...(actor.email ? { adminEmail: actor.email } : {}),
    },
    source: actor.source,
  });

  notifyOrderEvent(o.id, "ORDER_CONFIRMED").catch((err) =>
    logError("cod:confirm:notify", err, { orderId: o.id }),
  );
  if (whatsappEnabled()) {
    notifyOrderEvent(o.id, "ORDER_CONFIRMED", ["whatsapp"]).catch(() => {});
  }

  try {
    await enqueueShipmentJob(o.id);
    runShipmentJobOnce(o.id).catch((err) =>
      logError("cod:confirm:shipment", err, { orderId: o.id }),
    );
  } catch (err) {
    logError("cod:confirm:enqueue", err, { orderId: o.id });
  }

  return { ok: true, message: `Confirmed ${o.id}`, siteId: o.siteId };
}

/**
 * PENDING_COD_VERIFICATION → CANCELLED. Releases inventory + coupon holds.
 * Silent by design — no customer notification (don't tip off pranksters).
 * Logs COD_REJECTED.
 */
export async function rejectCodOrderCore(
  orderId: string,
  reason?: string,
  actor: CodActor = { source: "admin" },
): Promise<CodVerifyResult> {
  const claimed = await db
    .update(orders)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(orders.id, orderId), eq(orders.status, "PENDING_COD_VERIFICATION")),
    )
    .returning({
      id: orders.id,
      siteId: orders.siteId,
      customerId: orders.customerId,
      totalInr: orders.totalInr,
    });

  if (claimed.length === 0) {
    return {
      ok: false,
      error: "Order is no longer pending — refresh the page.",
    };
  }
  const o = claimed[0];

  await db.insert(events).values({
    siteId: o.siteId,
    orderId: o.id,
    customerId: o.customerId,
    type: "COD_REJECTED",
    payload: {
      total: o.totalInr,
      reason: reason ?? "operator-reject",
      ...(actor.email ? { adminEmail: actor.email } : {}),
    },
    source: actor.source,
  });

  try {
    await releaseOrderHolds(o.id, "CANCELLED");
  } catch (err) {
    logError("cod:reject:release", err, { orderId: o.id });
  }

  return { ok: true, message: `Rejected ${o.id}`, siteId: o.siteId };
}
