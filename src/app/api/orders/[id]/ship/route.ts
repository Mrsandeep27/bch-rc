/**
 * POST /api/orders/[id]/ship  (ADMIN ONLY)
 *
 * Manual admin retry of Shiprocket shipment creation. The post-payment
 * auto-trigger does NOT call this HTTP route — it calls
 * `triggerShipmentBackground()` in-process from /api/orders/create.
 *
 * Idempotent: if the order is already shipped (shiprocket_order_id +
 * awb_code present) we return the existing record without recreating.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import {
  createShipmentForOrder,
  NotShippableError,
  OrderNotFoundError,
} from "@/lib/fulfillment/create-shipment";
import { logError } from "@/lib/logger";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAdmin();
  const { id } = await params;

  // Site authorization: confirm this admin can act on this order's site.
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!ctx.siteIds.includes(order.siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await createShipmentForOrder(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderNotFoundError) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (err instanceof NotShippableError) {
      return NextResponse.json({ error: err.reason }, { status: 400 });
    }
    logError("ship:route", err, { orderId: id, adminEmail: ctx.email });
    return NextResponse.json(
      { error: "Shipment creation failed" },
      { status: 500 },
    );
  }
}
