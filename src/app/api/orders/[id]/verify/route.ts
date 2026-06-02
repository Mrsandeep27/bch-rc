/**
 * POST /api/orders/[id]/verify
 *
 * Called by the client right after Razorpay's checkout modal returns success.
 * Verifies HMAC signature → marks order as PAID. If signature is bad, we reject
 * (it's almost certainly a forged "paid" claim, never a real Razorpay event).
 *
 * Webhooks at /api/webhooks/razorpay are the redundant backup — they also
 * capture this transition, idempotently, in case the client never returns
 * (network drop, customer closes tab right after pay).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, events } from "@/db/schema";
import { verifyRazorpaySignature } from "@/lib/razorpay";

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
      { error: "Invalid body", details: String(err) },
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
    // Idempotent re-call: don't double-process, just confirm.
    return NextResponse.json({ ok: true, orderId: id, alreadyPaid: true });
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
      payload: {
        razorpayPaymentId: body.razorpayPaymentId,
      },
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

  // Fire-and-forget shipment creation. Customer sees success page immediately;
  // shipment + AWB happen in background. Admin retries if it fails.
  triggerShipment(id).catch((err) =>
    console.error(`Shipment auto-trigger failed for ${id}:`, err),
  );

  return NextResponse.json({ ok: true, orderId: id });
}

async function triggerShipment(orderId: string): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  await fetch(`${baseUrl}/api/orders/${orderId}/ship`, { method: "POST" });
}
