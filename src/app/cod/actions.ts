"use server";

/**
 * Server actions backing the /cod operator console.
 *
 *   confirmCodOrder(orderId)
 *     - Atomic PENDING_COD_VERIFICATION → PAID transition.
 *     - Enqueues the shipment job (durable, exactly-once) and runs it inline.
 *     - Fires the full ORDER_CONFIRMED email + WhatsApp.
 *     - Logs COD_VERIFIED so the timeline shows who/when.
 *
 *   rejectCodOrder(orderId, reason?)
 *     - Atomic PENDING_COD_VERIFICATION → CANCELLED transition.
 *     - Releases inventory + coupon holds.
 *     - Silent by design — no customer email/SMS (don't tip off pranksters).
 *     - Logs COD_REJECTED.
 *
 * Both gate on the operator's cookie session via isCodAuthenticated. The
 * atomic conditional UPDATE means two operators clicking Confirm at the same
 * moment can't double-act — second one finds no eligible row.
 */

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, orders } from "@/db/schema";
import { isCodAuthenticated } from "@/lib/cod-auth";
import {
  enqueueShipmentJob,
  runShipmentJobOnce,
} from "@/lib/fulfillment/shipment-queue";
import { releaseOrderHolds } from "@/lib/inventory/release";
import { notifyOrderEvent, whatsappEnabled } from "@/lib/notifications/notify";
import { logError } from "@/lib/logger";

export type CodActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function confirmCodOrder(orderId: string): Promise<CodActionResult> {
  if (!(await isCodAuthenticated())) {
    return { ok: false, error: "Not signed in." };
  }

  const claimed = await db
    .update(orders)
    .set({
      status: "PAID",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "PENDING_COD_VERIFICATION"),
      ),
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
    payload: { total: o.totalInr },
    source: "admin",
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

  revalidatePath("/cod");
  return { ok: true, message: `Confirmed ${o.id}` };
}

export async function rejectCodOrder(
  orderId: string,
  reason?: string,
): Promise<CodActionResult> {
  if (!(await isCodAuthenticated())) {
    return { ok: false, error: "Not signed in." };
  }

  const claimed = await db
    .update(orders)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "PENDING_COD_VERIFICATION"),
      ),
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
    payload: { total: o.totalInr, reason: reason ?? "operator-reject" },
    source: "admin",
  });

  try {
    await releaseOrderHolds(o.id, "CANCELLED");
  } catch (err) {
    logError("cod:reject:release", err, { orderId: o.id });
  }

  revalidatePath("/cod");
  return { ok: true, message: `Rejected ${o.id}` };
}
