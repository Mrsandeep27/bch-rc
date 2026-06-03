/**
 * Server-only fulfillment helper. Wraps Shiprocket order/AWB creation behind
 * a single in-process function so the HTTP route /api/orders/[id]/ship can be
 * admin-gated without breaking the internal post-payment trigger.
 *
 * Idempotency:
 *  - If the order already has shiprocket_order_id + awb_code, return the existing
 *    record without re-creating (Shiprocket has already been charged).
 *  - If the order is in a non-shippable state (PENDING / CANCELLED / FAILED /
 *    REFUNDED / ABANDONED), throw NotShippableError — callers decide how to
 *    surface it.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, events } from "@/db/schema";
import { createShipment as shiprocketCreate } from "@/lib/shiprocket";
import { notifyOrderEvent } from "@/lib/notifications/notify";
import { logError } from "@/lib/logger";

type OrderItem = {
  skuId: string;
  variantSlug: string | null;
  name: string;
  image: string | null;
  unitPriceInr: number;
  qty: number;
  lineTotalInr: number;
};

type ShippingAddress = {
  fullName: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

export class NotShippableError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "NotShippableError";
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found");
    this.name = "OrderNotFoundError";
  }
}

export type ShipmentResult = {
  shiprocketOrderId: string;
  shipmentId: string | null;
  awbCode: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  idempotent: boolean;
};

export async function createShipmentForOrder(orderId: string): Promise<ShipmentResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new OrderNotFoundError();

  // Idempotency: already shipped → return the existing record.
  if (order.shiprocketOrderId && order.awbCode) {
    return {
      shiprocketOrderId: order.shiprocketOrderId,
      shipmentId: order.shiprocketShipmentId,
      awbCode: order.awbCode,
      courierName: order.courierName,
      trackingUrl: order.trackingUrl,
      idempotent: true,
    };
  }

  if (order.status === "PENDING") {
    throw new NotShippableError("Order not yet paid");
  }
  if (
    ["CANCELLED", "REFUNDED", "FAILED", "ABANDONED"].includes(order.status)
  ) {
    throw new NotShippableError(`Order in ${order.status} state`);
  }

  const items = order.items as OrderItem[];
  const addr = order.shippingAddress as ShippingAddress;

  const result = await shiprocketCreate({
    orderId: order.id,
    orderPlacedAt: order.placedAt,
    customer: {
      name: addr.fullName,
      phone: addr.phone,
      email: addr.email,
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    },
    items: items.map((i) => ({
      // The snapshot `name` already reads "Pocket BMW · Blue" — the order
      // create handler resolves variant name into the line name. The
      // picker-facing label is unambiguous without the slug suffix.
      name: i.name,
      sku: i.variantSlug ? `${i.skuId}-${i.variantSlug}` : i.skuId,
      units: i.qty,
      selling_price: i.unitPriceInr,
    })),
    subtotalInr: order.subtotalInr,
    paymentMethod: order.paymentMethod === "COD" ? "COD" : "Prepaid",
  });

  await db
    .update(orders)
    .set({
      shiprocketOrderId: result.shiprocketOrderId,
      shiprocketShipmentId: result.shipmentId,
      awbCode: result.awbCode,
      courierName: result.courierName,
      trackingUrl: result.trackingUrl,
      status: result.awbCode ? "PACKED" : order.status,
      packedAt: result.awbCode ? new Date() : order.packedAt,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await db.insert(events).values({
    siteId: order.siteId,
    orderId: order.id,
    customerId: order.customerId,
    type: result.awbCode ? "SHIPMENT_CREATED" : "SHIPMENT_PENDING_AWB",
    payload: {
      shiprocketOrderId: result.shiprocketOrderId,
      shipmentId: result.shipmentId,
      awbCode: result.awbCode,
      courierName: result.courierName,
    },
    source: "system",
  });

  // Notify the customer their order has shipped — only once an AWB exists so
  // the email/WhatsApp carries a real tracking number. Idempotent: the early
  // return above means a re-run for an already-shipped order never gets here.
  if (result.awbCode) {
    await notifyOrderEvent(order.id, "SHIPMENT_CREATED");
  }

  return {
    shiprocketOrderId: result.shiprocketOrderId,
    shipmentId: result.shipmentId,
    awbCode: result.awbCode,
    courierName: result.courierName,
    trackingUrl: result.trackingUrl,
    idempotent: false,
  };
}

/**
 * Fire-and-forget wrapper for the post-payment auto-trigger. Errors are
 * persisted to the events table and swallowed — admin retry path via
 * /api/orders/[id]/ship handles recovery.
 */
export async function triggerShipmentBackground(orderId: string): Promise<void> {
  try {
    await createShipmentForOrder(orderId);
  } catch (err) {
    logError("fulfillment:auto-trigger", err, { orderId });
    // Persist failure so admin can see it without trawling Vercel logs.
    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (order) {
        await db.insert(events).values({
          siteId: order.siteId,
          orderId,
          customerId: order.customerId,
          type: "SHIPMENT_AUTO_TRIGGER_FAILED",
          payload: { error: err instanceof Error ? err.message : String(err) },
          source: "system",
        });
      }
    } catch (eventErr) {
      logError("fulfillment:event-log", eventErr, { orderId });
    }
  }
}
