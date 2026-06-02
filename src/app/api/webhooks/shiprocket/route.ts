/**
 * POST /api/webhooks/shiprocket
 *
 * Shiprocket pings us when a shipment's status changes. We mirror it to
 * orders.status. Idempotent via webhooks_inbound UNIQUE(source, external_id).
 *
 * Auth: Shiprocket lets you set a custom header token in their webhook
 * config. We compare `x-api-key` against SHIPROCKET_WEBHOOK_TOKEN.
 *
 * Set the token in Shiprocket Dashboard → Settings → Webhooks → Add → Token,
 * then mirror in SHIPROCKET_WEBHOOK_TOKEN env var.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, events, webhooksInbound } from "@/db/schema";
import { mapShiprocketStatus } from "@/lib/shiprocket";

export async function POST(req: Request) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (expected) {
    const got = req.headers.get("x-api-key");
    if (got !== expected) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 },
      );
    }
  }

  const rawBody = await req.text();
  let event: {
    awb?: string;
    current_status?: string;
    current_status_id?: number;
    order_id?: string;
    shipment_status?: string;
    scans?: Array<{ date: string; activity: string }>;
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // External ID for idempotency: AWB + current_status. Shiprocket may retry
  // the same state, but won't retry different states with the same combo.
  const externalId = `${event.awb ?? "unknown"}::${event.current_status ?? event.shipment_status ?? "unknown"}::${event.current_status_id ?? 0}`;

  try {
    await db.insert(webhooksInbound).values({
      source: "shiprocket",
      externalId,
      payload: event,
      processed: false,
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    // Look up the order by AWB. Fallback to order_id (our PRC-XXXX).
    let order = null;
    if (event.awb) {
      [order] = await db.select().from(orders).where(eq(orders.awbCode, event.awb));
    }
    if (!order && event.order_id) {
      [order] = await db.select().from(orders).where(eq(orders.id, event.order_id));
    }

    if (!order) {
      // No matching order — log and ack so Shiprocket stops retrying.
      await db
        .update(webhooksInbound)
        .set({
          processed: true,
          processedAt: new Date(),
          error: "No matching order",
        })
        .where(eq(webhooksInbound.externalId, externalId));
      return NextResponse.json({ ok: true, matched: false });
    }

    const statusText = event.current_status ?? event.shipment_status ?? "";
    const mapped = mapShiprocketStatus(statusText);

    if (mapped && mapped !== order.status) {
      const now = new Date();
      const updates: Partial<typeof orders.$inferInsert> = {
        status: mapped,
        updatedAt: now,
      };
      if (mapped === "SHIPPED" && !order.shippedAt) updates.shippedAt = now;
      if (mapped === "DELIVERED" && !order.deliveredAt) updates.deliveredAt = now;
      if (mapped === "CANCELLED" && !order.cancelledAt) updates.cancelledAt = now;

      await db.update(orders).set(updates).where(eq(orders.id, order.id));
    }

    await db.insert(events).values({
      siteId: order.siteId,
      orderId: order.id,
      customerId: order.customerId,
      type: `WEBHOOK_SHIPROCKET_${(mapped ?? "RAW").toUpperCase()}`,
      payload: {
        awb: event.awb,
        statusText,
        statusId: event.current_status_id,
        mapped,
      },
      source: "webhook",
    });

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
