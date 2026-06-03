/**
 * POST /api/orders/[id]/verify
 *
 * Called by the client right after Razorpay's checkout modal returns success.
 * Verifies HMAC signature → marks order as PAID. If signature is bad, we
 * reject — almost certainly a forged "paid" claim, never a real Razorpay
 * event since they always sign with the correct secret.
 *
 * Webhooks at /api/webhooks/razorpay are the redundant backup — they also
 * capture this transition, idempotently, in case the client never returns
 * (network drop, customer closes tab right after pay).
 *
 * After capture: enqueue + inline-send PAYMENT_CAPTURED email, trigger
 * Shiprocket shipment in-process (no HTTP self-call so the admin-gated route
 * stays admin-gated).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, events } from "@/db/schema";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { triggerShipmentBackground } from "@/lib/fulfillment/create-shipment";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { sendOutboxRow } from "@/lib/notifications/drain";
import { logError } from "@/lib/logger";

const Body = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!order.razorpayOrderId) {
    return NextResponse.json(
      { error: "Order has no razorpay_order_id (was this a COD order?)" },
      { status: 400 },
    );
  }
  if (order.paymentStatus === "CAPTURED") {
    return NextResponse.json({ ok: true, orderId: id, alreadyPaid: true });
  }
  if (
    order.paymentStatus === "FAILED" ||
    order.paymentStatus === "REFUNDED" ||
    order.paymentStatus === "PARTIALLY_REFUNDED"
  ) {
    return NextResponse.json(
      { error: `Order in ${order.paymentStatus} state — cannot capture` },
      { status: 409 },
    );
  }

  const valid = verifyRazorpaySignature({
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: body.razorpayPaymentId,
    razorpaySignature: body.razorpaySignature,
  });

  if (!valid) {
    await db.insert(events).values({
      siteId: order.siteId,
      orderId: id,
      customerId: order.customerId,
      type: "PAYMENT_SIGNATURE_INVALID",
      payload: { razorpayPaymentId: body.razorpayPaymentId },
      source: "system",
    });
    return NextResponse.json(
      { error: "Signature mismatch — payment not verified" },
      { status: 400 },
    );
  }

  await db
    .update(orders)
    .set({
      status: "PAID",
      paymentStatus: "CAPTURED",
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  await db.insert(events).values({
    siteId: order.siteId,
    orderId: id,
    customerId: order.customerId,
    type: "PAYMENT_CAPTURED",
    payload: {
      razorpayPaymentId: body.razorpayPaymentId,
      amountInr: order.totalInr,
    },
    source: "user",
  });

  // Confirmation email — best-effort inline + outbox backstop.
  const addr = order.shippingAddress as {
    fullName: string;
    email?: string;
  };
  const items = order.items as Array<{
    name: string;
    qty: number;
    lineTotalInr: number;
  }>;
  if (addr.email) {
    try {
      const notificationId = await enqueueNotification({
        siteId: order.siteId,
        orderId: id,
        customerId: order.customerId,
        channel: "email",
        template: "PAYMENT_CAPTURED",
        payload: {
          to: addr.email,
          customerName: addr.fullName,
          orderId: id,
          totalInr: order.totalInr,
          paymentMethod: order.paymentMethod,
          items: items.map((i) => ({
            name: i.name,
            qty: i.qty,
            lineTotalInr: i.lineTotalInr,
          })),
        },
      });
      sendOutboxRow(notificationId).catch(() => {});
    } catch (err) {
      logError("verify:enqueue-email", err, { orderId: id });
    }
  }

  // In-process shipment creation. No HTTP self-call → admin-gated route stays gated.
  triggerShipmentBackground(id);

  return NextResponse.json({ ok: true, orderId: id });
}
