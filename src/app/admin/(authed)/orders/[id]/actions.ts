"use server";

/**
 * Server actions for the admin order detail page.
 *
 *   saveOrderNote(orderId, notes)
 *     - Operator notes go on the orders.notes column (already on schema).
 *     - Authorises the admin context against the order's site.
 *     - Emits an `ADMIN_NOTE_SAVED` event so the change shows in the timeline.
 *
 *   refundOrderFully(orderId)
 *     - Calls Razorpay /v1/payments/{id}/refund for the full captured amount.
 *     - Updates orders.status + paymentStatus to REFUNDED.
 *     - Emits a `REFUND_INITIATED` event.
 *     - Refuses if the order isn't refundable (no payment id, already
 *       refunded, or COD without a captured payment).
 *
 * Both actions revalidatePath the order detail route so the page renders
 * fresh state after the action returns.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { razorpay } from "@/lib/razorpay";
import { logError } from "@/lib/logger";

const MAX_NOTE_LENGTH = 2000;

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function saveOrderNote(
  orderId: string,
  notes: string,
): Promise<ActionResult> {
  const ctx = await requireAdmin();

  const trimmed = (notes ?? "").slice(0, MAX_NOTE_LENGTH);

  const [order] = await db
    .select({ siteId: orders.siteId, notes: orders.notes })
    .from(orders)
    .where(eq(orders.id, orderId));

  if (!order) return { ok: false, error: "Order not found." };
  if (!ctx.siteIds.includes(order.siteId)) {
    return { ok: false, error: "You don't have access to this order's site." };
  }
  if ((order.notes ?? "") === trimmed) {
    return { ok: true, message: "No changes to save." };
  }

  await db
    .update(orders)
    .set({ notes: trimmed, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(events).values({
    siteId: order.siteId,
    orderId,
    type: "ADMIN_NOTE_SAVED",
    source: "admin",
    payload: {
      adminEmail: ctx.email,
      previewBefore: (order.notes ?? "").slice(0, 200),
      previewAfter: trimmed.slice(0, 200),
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Note saved." };
}

export async function refundOrderFully(orderId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId));

  if (!order) return { ok: false, error: "Order not found." };
  if (!ctx.siteIds.includes(order.siteId)) {
    return { ok: false, error: "You don't have access to this order's site." };
  }
  if (!order.razorpayPaymentId) {
    return {
      ok: false,
      error:
        order.paymentMethod === "COD"
          ? "COD orders can't be refunded online — cancel instead and refund cash on return."
          : "No captured Razorpay payment on this order yet.",
    };
  }
  if (order.status === "REFUNDED" || order.paymentStatus === "REFUNDED") {
    return { ok: false, error: "Already refunded." };
  }
  // Refunding from CANCELLED/FAILED/ABANDONED is fine — we still want to
  // give the customer their money back if anything captured. The only
  // hard block above is "already refunded".

  try {
    // Razorpay refund API: amount in paise. totalInr stores rupees, so ×100.
    // Omitting `amount` would do a full refund of whatever Razorpay knows
    // about; we pass it explicitly so partial captures are handled
    // intentionally.
    await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: order.totalInr * 100,
      speed: "normal",
      notes: {
        order_id: order.id,
        site_id: order.siteId,
        admin_email: ctx.email,
      },
    });
  } catch (err) {
    logError("admin:refund:razorpay", err, {
      orderId,
      paymentId: order.razorpayPaymentId,
    });
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Razorpay refund failed: ${msg}` };
  }

  await db
    .update(orders)
    .set({
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(events).values({
    siteId: order.siteId,
    orderId,
    type: "REFUND_INITIATED",
    source: "admin",
    payload: {
      adminEmail: ctx.email,
      amountInr: order.totalInr,
      paymentId: order.razorpayPaymentId,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return {
    ok: true,
    message: "Refund initiated. Razorpay will settle within 5-7 days.",
  };
}
