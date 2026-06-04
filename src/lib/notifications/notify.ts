/**
 * notifyOrderEvent — the single entry point for every customer-facing order
 * notification (confirmation, payment, shipment, out-for-delivery, delivered).
 *
 * It loads the order, builds the payload once, and fans the same event out to
 * every enabled channel (email always; WhatsApp when WHATSAPP_ENABLED is on),
 * enqueuing a durable outbox row per channel and best-effort inline-sending it.
 * Anything that fails inline is retried by the cron drain.
 *
 * Call sites:
 *   - order create (COD)               → ORDER_CONFIRMED
 *   - verify / razorpay webhook        → PAYMENT_CAPTURED
 *   - create-shipment (AWB assigned)   → SHIPMENT_CREATED
 *   - sync-shipments / courier webhook → OUT_FOR_DELIVERY, DELIVERED
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { resolveServiceability } from "@/lib/serviceability";
import { logError } from "@/lib/logger";
import { enqueueNotification, type NotificationChannel } from "./enqueue";
import { sendOutboxRow } from "./drain";
import type { EmailPayload, NotificationTemplate } from "./templates";

export function whatsappEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === "true";
}

/** Channels we send on by default. Email is always on; WhatsApp is env-gated. */
export function defaultChannels(): NotificationChannel[] {
  return whatsappEnabled() ? ["email", "whatsapp"] : ["email"];
}

type OrderRow = typeof orders.$inferSelect;

function buildPayload(order: OrderRow): EmailPayload {
  const addr = order.shippingAddress as {
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    pincode?: string | null;
  };
  const items = (order.items as Array<{
    name: string;
    qty: number;
    lineTotalInr: number;
    image?: string | null;
  }>) ?? [];
  const eta = addr.pincode
    ? resolveServiceability(addr.pincode).etaText || null
    : null;

  return {
    to: addr.email ?? "",
    toPhone: addr.phone ?? null,
    customerName: addr.fullName ?? "there",
    orderId: order.id,
    totalInr: order.totalInr,
    paymentMethod: order.paymentMethod,
    items: items.map((i) => ({
      name: i.name,
      qty: i.qty,
      lineTotalInr: i.lineTotalInr,
      image: i.image ?? null,
    })),
    awbCode: order.awbCode,
    courierName: order.courierName,
    trackingUrl: order.trackingUrl,
    paymentReference: order.razorpayPaymentId,
    etaText: eta,
    subtotalInr: order.subtotalInr,
    shippingInr: order.shippingInr,
    codFeeInr: order.codFeeInr,
    discountInr: order.discountInr,
    couponCode: order.couponCode,
    shippingAddress: addr.fullName && addr.line1 && addr.city && addr.state && addr.pincode
      ? {
          fullName: addr.fullName,
          phone: addr.phone ?? "",
          line1: addr.line1,
          line2: addr.line2 ?? null,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
        }
      : null,
  };
}

/**
 * Enqueue + inline-send a notification for an order across the given channels.
 * Safe to call fire-and-forget; never throws (errors are logged).
 *
 * @param channels override the channel list (e.g. ["whatsapp"] when the email
 *        for this event is already enqueued elsewhere). Defaults to
 *        defaultChannels().
 */
/**
 * Templates we ACTUALLY send to customers. Product decision: customers receive
 * exactly two emails per order — the confirmation (ORDER_CONFIRMED for COD,
 * PAYMENT_CAPTURED for prepaid) and the DELIVERED summary. Mid-flight
 * notifications (SHIPMENT_CREATED when the AWB is assigned, OUT_FOR_DELIVERY
 * from the courier sync) are intentionally suppressed at this single
 * chokepoint so no caller can leak them — every order-event call funnels
 * through notifyOrderEvent. The customer can still track from the order page
 * (link is in the confirmation email), and the events table records every
 * lifecycle transition for admin visibility.
 */
const CUSTOMER_FACING_TEMPLATES = new Set<NotificationTemplate>([
  "ORDER_RECEIVED",
  "ORDER_CONFIRMED",
  "PAYMENT_CAPTURED",
  "DELIVERED",
]);

export async function notifyOrderEvent(
  orderId: string,
  template: NotificationTemplate,
  channels: NotificationChannel[] = defaultChannels(),
): Promise<void> {
  if (channels.length === 0) return;
  if (!CUSTOMER_FACING_TEMPLATES.has(template)) return;
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) return;
    const payload = buildPayload(order);

    for (const channel of channels) {
      if (channel === "email" && !payload.to) continue;
      if (channel === "whatsapp" && !payload.toPhone) continue;
      try {
        const id = await enqueueNotification({
          siteId: order.siteId,
          orderId: order.id,
          customerId: order.customerId,
          channel,
          template,
          payload,
        });
        // Best-effort instant delivery; cron drains anything that fails. id is
        // null only if the dedup row vanished mid-flight — cron still covers it.
        if (id) sendOutboxRow(id).catch(() => {});
      } catch (err) {
        logError("notify:enqueue", err, { orderId, template, channel });
      }
    }
  } catch (err) {
    logError("notify:order-event", err, { orderId, template });
  }
}
