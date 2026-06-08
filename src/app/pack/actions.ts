"use server";

/**
 * Server actions for the /pack console.
 *
 * Every action gates on isPackAuthenticated() first — the page wrapper does
 * the same, but server actions are independently callable from any client so
 * the auth check must live here too.
 *
 * Notification UX:
 *   Each action returns either { ok: true, ... } with the URL/result the
 *   client should use, or { ok: false, error } with a string the client can
 *   toast. Throwing from a server action surfaces as a generic crash to the
 *   user — keep failures inside the return type instead.
 */

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, events } from "@/db/schema";
import { isPackAuthenticated } from "@/lib/pack-auth";
import {
  generateShippingLabel,
  generateManifest,
  schedulePickup,
  generateInvoice,
} from "@/lib/shiprocket";
import { logError } from "@/lib/logger";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type GateFailure = { ok: false; error: string };

async function gate(): Promise<GateFailure | null> {
  const ok = await isPackAuthenticated();
  return ok ? null : { ok: false, error: "Not signed in." };
}

// ============================================================
// Print shipping label PDF for a single order
// ============================================================
export async function printLabelAction(
  orderId: string,
): Promise<ActionResult<{ labelUrl: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: "Order not found." };
  if (!order.shiprocketShipmentId) {
    return {
      ok: false,
      error: "AWB not yet assigned. Wait ~30 sec and retry.",
    };
  }

  try {
    const { labelUrl } = await generateShippingLabel([order.shiprocketShipmentId]);
    if (!labelUrl) {
      return {
        ok: false,
        error: "Shiprocket didn't return a label URL. Try again in a moment.",
      };
    }
    return { ok: true, labelUrl };
  } catch (err) {
    logError("pack:print-label", err, { orderId });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Label generation failed.",
    };
  }
}

// ============================================================
// Print today's manifest — all PACKED orders with AWB
// ============================================================
export async function printManifestAction(): Promise<
  ActionResult<{ manifestUrl: string; count: number }>
> {
  const denied = await gate();
  if (denied) return denied;

  // Collect every order PACKED with an AWB that isn't yet handed to a
  // courier. We don't track "manifest_printed_at" yet, so the simple rule is
  // every PACKED-with-AWB row. The packing employee prints once at end-of-day
  // before the courier visit.
  const rows = await db
    .select({ shipmentId: orders.shiprocketShipmentId })
    .from(orders)
    .where(and(eq(orders.status, "PACKED")));

  const shipmentIds = rows
    .map((r) => r.shipmentId)
    .filter((id): id is string => !!id);

  if (shipmentIds.length === 0) {
    return { ok: false, error: "No packed orders ready for manifest." };
  }

  try {
    const { manifestUrl } = await generateManifest(shipmentIds);
    if (!manifestUrl) {
      return { ok: false, error: "Shiprocket didn't return a manifest URL." };
    }
    return { ok: true, manifestUrl, count: shipmentIds.length };
  } catch (err) {
    logError("pack:print-manifest", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Manifest failed.",
    };
  }
}

// ============================================================
// Print invoice for a single order
// ============================================================
export async function printInvoiceAction(
  orderId: string,
): Promise<ActionResult<{ invoiceUrl: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: "Order not found." };
  if (!order.shiprocketOrderId) {
    return {
      ok: false,
      error: "Order not yet created on Shiprocket.",
    };
  }

  try {
    const { invoiceUrl } = await generateInvoice([order.shiprocketOrderId]);
    if (!invoiceUrl) {
      return { ok: false, error: "Shiprocket didn't return an invoice URL." };
    }
    return { ok: true, invoiceUrl };
  } catch (err) {
    logError("pack:print-invoice", err, { orderId });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invoice generation failed.",
    };
  }
}

// ============================================================
// Schedule courier pickup for all packed orders
// ============================================================
export async function schedulePickupAction(): Promise<
  ActionResult<{ scheduledFor: string | null; count: number }>
> {
  const denied = await gate();
  if (denied) return denied;

  const rows = await db
    .select({ shipmentId: orders.shiprocketShipmentId })
    .from(orders)
    .where(and(eq(orders.status, "PACKED")));

  const shipmentIds = rows
    .map((r) => r.shipmentId)
    .filter((id): id is string => !!id);

  if (shipmentIds.length === 0) {
    return { ok: false, error: "No packed orders to schedule." };
  }

  const result = await schedulePickup(shipmentIds);
  if (!result.ok) {
    return { ok: false, error: result.message };
  }
  return {
    ok: true,
    scheduledFor: result.pickupScheduledDate,
    count: shipmentIds.length,
  };
}

// ============================================================
// Mark an order as dispatched (PACKED → SHIPPED)
//
// Confirms the employee has physically handed the parcel to the courier.
// This is BEFORE Shiprocket's tracking webhook fires SHIPPED (which depends
// on the courier's scan). Acts as the human confirmation.
// ============================================================
export async function markDispatchedAction(
  orderId: string,
): Promise<ActionResult<{ status: "SHIPPED" }>> {
  const denied = await gate();
  if (denied) return denied;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: "Order not found." };

  // Only PACKED orders can be marked SHIPPED from here. PAID-without-AWB
  // would skip a state; CANCELLED/DELIVERED/RETURNED are terminal.
  if (order.status !== "PACKED") {
    return {
      ok: false,
      error: `Order is in ${order.status}, cannot mark as dispatched.`,
    };
  }
  if (!order.awbCode) {
    return {
      ok: false,
      error: "AWB not yet assigned — cannot dispatch yet.",
    };
  }

  const now = new Date();
  await db
    .update(orders)
    .set({ status: "SHIPPED", shippedAt: now, updatedAt: now })
    .where(eq(orders.id, orderId));

  await db.insert(events).values({
    siteId: order.siteId,
    orderId: order.id,
    customerId: order.customerId,
    type: "DISPATCH_CONFIRMED",
    payload: {
      awbCode: order.awbCode,
      courierName: order.courierName,
      confirmedBy: "pack-console",
    },
    source: "operator",
  });

  revalidatePath("/pack");
  return { ok: true, status: "SHIPPED" };
}

// ============================================================
// Cancel an order from /pack (test / smoke / wrong-address cleanup)
//
// Moves the order to CANCELLED and cancels the corresponding Shiprocket
// order so we aren't billed for an AWB we won't ship. Refund of any
// captured prepaid payment is NOT triggered here — that stays an admin
// action so the packer can't accidentally trigger a refund.
// ============================================================
export async function cancelOrderFromPackAction(
  orderId: string,
  reason: string,
): Promise<ActionResult<{ status: "CANCELLED" }>> {
  const denied = await gate();
  if (denied) return denied;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: "Order not found." };
  if (
    order.status === "SHIPPED" ||
    order.status === "DELIVERED" ||
    order.status === "RETURNED"
  ) {
    return {
      ok: false,
      error: `Order is ${order.status} - too late to cancel from here. Use /admin.`,
    };
  }
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    return { ok: false, error: `Order is already ${order.status}.` };
  }

  // Best-effort cancel on Shiprocket so we don't pay for an AWB we won't use.
  // Errors are logged but do not block the local DB cancel - admin can clean
  // up Shiprocket separately if needed.
  if (order.shiprocketOrderId) {
    try {
      const { cancelShiprocketOrder } = await import("@/lib/shiprocket");
      await cancelShiprocketOrder(order.shiprocketOrderId);
    } catch (err) {
      logError("pack:cancel-shiprocket", err, { orderId });
    }
  }

  const now = new Date();
  await db
    .update(orders)
    .set({ status: "CANCELLED", cancelledAt: now, updatedAt: now })
    .where(eq(orders.id, orderId));

  await db.insert(events).values({
    siteId: order.siteId,
    orderId: order.id,
    customerId: order.customerId,
    type: "CANCELLED_FROM_PACK",
    payload: { reason: reason.slice(0, 200), cancelledBy: "pack-console" },
    source: "operator",
  });

  revalidatePath("/pack");
  return { ok: true, status: "CANCELLED" };
}

// ============================================================
// Bulk mark dispatched — used when the courier picks up a whole batch
// ============================================================
export async function markBulkDispatchedAction(
  orderIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const denied = await gate();
  if (denied) return denied;
  if (orderIds.length === 0)
    return { ok: false, error: "No orders selected." };

  const eligible = await db
    .select({ id: orders.id, awb: orders.awbCode })
    .from(orders)
    .where(
      and(eq(orders.status, "PACKED"), inArray(orders.id, orderIds)),
    );

  const dispatchable = eligible
    .filter((r) => !!r.awb)
    .map((r) => r.id);

  if (dispatchable.length === 0) {
    return { ok: false, error: "Selected orders aren't ready to dispatch." };
  }

  const now = new Date();
  await db
    .update(orders)
    .set({ status: "SHIPPED", shippedAt: now, updatedAt: now })
    .where(inArray(orders.id, dispatchable));

  revalidatePath("/pack");
  return { ok: true, count: dispatchable.length };
}
