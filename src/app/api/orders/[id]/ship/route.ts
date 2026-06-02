/**
 * POST /api/orders/[id]/ship
 *
 * Creates a Shiprocket shipment for an order. Called automatically after
 * payment is captured AND can be retried manually from the admin order
 * detail page if the auto-trigger failed.
 *
 * Idempotency: if the order already has a shiprocket_order_id, we return
 * the existing one without recreating. To force a fresh creation, admin
 * has to clear the field manually.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, events } from "@/db/schema";
import { createShipment } from "@/lib/shiprocket";

type OrderItem = {
  skuId: string;
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Idempotency: don't re-create if already shipped.
  if (order.shiprocketOrderId && order.awbCode) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      shiprocketOrderId: order.shiprocketOrderId,
      awbCode: order.awbCode,
      courierName: order.courierName,
      trackingUrl: order.trackingUrl,
    });
  }

  // Must be paid before shipping (or COD, which marks itself PAID immediately).
  if (order.status === "PENDING") {
    return NextResponse.json(
      { error: "Order not yet paid — cannot ship" },
      { status: 400 },
    );
  }
  if (["CANCELLED", "REFUNDED", "FAILED", "ABANDONED"].includes(order.status)) {
    return NextResponse.json(
      { error: `Cannot ship order in ${order.status} state` },
      { status: 400 },
    );
  }

  const items = order.items as OrderItem[];
  const addr = order.shippingAddress as ShippingAddress;

  try {
    const result = await createShipment({
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
        name: i.name,
        sku: i.skuId,
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
        // Only advance to PACKED if AWB was assigned. Otherwise stay PAID until manual retry.
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

    return NextResponse.json({
      ok: true,
      shiprocketOrderId: result.shiprocketOrderId,
      shipmentId: result.shipmentId,
      awbCode: result.awbCode,
      courierName: result.courierName,
      trackingUrl: result.trackingUrl,
    });
  } catch (err) {
    await db.insert(events).values({
      siteId: order.siteId,
      orderId: order.id,
      customerId: order.customerId,
      type: "SHIPMENT_FAILED",
      payload: { error: String(err) },
      source: "system",
    });
    return NextResponse.json(
      { error: "Shipment creation failed", details: String(err) },
      { status: 500 },
    );
  }
}
