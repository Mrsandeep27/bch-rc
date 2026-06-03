/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay calls this on every payment event. The redundant backup to the
 * client-side verify call — if the customer closes the tab right after pay,
 * the webhook is what marks their order PAID.
 *
 * Idempotency: every event has Razorpay's `id` (e.g. `evt_*`). We INSERT
 * into webhooks_inbound with UNIQUE(source, external_id) — retries become
 * no-ops.
 *
 * Webhook secret must be set in Razorpay dashboard → Settings → Webhooks →
 * Add → Secret. Mirror the same value in RAZORPAY_WEBHOOK_SECRET env var.
 *
 * Events handled:
 *  - payment.captured     → PAID  + CAPTURED
 *  - payment.failed       → FAILED + FAILED
 *  - refund.created       → REFUNDED + REFUNDED
 *  - refund.processed     → idempotent confirm of refund state
 */

import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, events, webhooksInbound } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { notifyOrderEvent } from "@/lib/notifications/notify";
import {
  enqueueShipmentJob,
  runShipmentJobOnce,
} from "@/lib/fulfillment/shipment-queue";
import { releaseOrderHoldsBestEffort } from "@/lib/inventory/release";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    id?: string;
    event: string;
    payload?: {
      payment?: { entity?: { id: string; order_id: string; amount: number; status: string; error_description?: string } };
      refund?: { entity?: { id: string; payment_id: string; amount: number; status: string } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const externalId = event.id ?? `${event.event}-${Date.now()}`;

  // Idempotency check. UNIQUE(source, external_id) makes this a no-op on retry.
  try {
    await db.insert(webhooksInbound).values({
      source: "razorpay",
      externalId,
      payload: event,
      processed: false,
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      // Already received. Acknowledge so Razorpay stops retrying.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  // Process the event.
  try {
    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload?.payment?.entity;
        if (!payment) break;
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.razorpayOrderId, payment.order_id));
        if (order && order.paymentStatus !== "CAPTURED" && order.paymentStatus !== "FAILED" && order.paymentStatus !== "REFUNDED") {
          await db
            .update(orders)
            .set({
              status: "PAID",
              paymentStatus: "CAPTURED",
              razorpayPaymentId: payment.id,
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));
          await db.insert(events).values({
            siteId: order.siteId,
            orderId: order.id,
            customerId: order.customerId,
            type: "WEBHOOK_PAYMENT_CAPTURED",
            payload: { paymentId: payment.id, amount: payment.amount },
            source: "webhook",
          });

          // Confirmation + shipment trigger — webhook is the safety net for
          // customers who closed the tab before /verify fired. notifyOrderEvent
          // reads the just-updated row so the txn ref renders on the receipt.
          await notifyOrderEvent(order.id, "PAYMENT_CAPTURED");
          // Durable + exactly-once: enqueue the job, run it past the response.
          // Dedups against /verify via the job PK + atomic claim.
          await enqueueShipmentJob(order.id);
          after(() => runShipmentJobOnce(order.id).catch(() => {}));
        }
        break;
      }
      case "payment.failed": {
        const payment = event.payload?.payment?.entity;
        if (!payment) break;
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.razorpayOrderId, payment.order_id));
        if (order && order.paymentStatus !== "CAPTURED") {
          await db
            .update(orders)
            .set({
              status: "FAILED",
              paymentStatus: "FAILED",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));
          await db.insert(events).values({
            siteId: order.siteId,
            orderId: order.id,
            customerId: order.customerId,
            type: "WEBHOOK_PAYMENT_FAILED",
            payload: {
              paymentId: payment.id,
              error: payment.error_description,
            },
            source: "webhook",
          });
          // Return the reserved stock + coupon usage to the pool.
          await releaseOrderHoldsBestEffort(order.id, "PAYMENT_FAILED");
        }
        break;
      }
      case "refund.created":
      case "refund.processed": {
        const refund = event.payload?.refund?.entity;
        if (!refund) break;
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.razorpayPaymentId, refund.payment_id));
        if (order) {
          await db
            .update(orders)
            .set({
              status: "REFUNDED",
              paymentStatus: "REFUNDED",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));
          await db.insert(events).values({
            siteId: order.siteId,
            orderId: order.id,
            customerId: order.customerId,
            type: `WEBHOOK_${event.event.toUpperCase().replace(".", "_")}`,
            payload: { refundId: refund.id, amount: refund.amount },
            source: "webhook",
          });
          // Refunded goods go back to sellable stock; coupon usage is released.
          await releaseOrderHoldsBestEffort(order.id, "REFUNDED");
        }
        break;
      }
    }

    await db
      .update(webhooksInbound)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(webhooksInbound.externalId, externalId));
  } catch (err) {
    await db
      .update(webhooksInbound)
      .set({ error: String(err) })
      .where(eq(webhooksInbound.externalId, externalId));
    throw err;
  }

  return NextResponse.json({ ok: true });
}
