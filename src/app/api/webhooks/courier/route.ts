/**
 * /api/webhooks/courier — Shiprocket shipment status events.
 *
 * We mirror Shiprocket events to orders.status. Idempotent via
 * webhooks_inbound UNIQUE(source, external_id).
 *
 * Path renamed away from /shiprocket because their URL validator rejects
 * URLs containing the literal "shiprocket" keyword.
 *
 * Webhook validator tolerance:
 *  Shiprocket's "Save" and "Test Webhook" buttons probe the endpoint with
 *  unpredictable payloads (sometimes empty body, sometimes GET, sometimes
 *  HEAD, sometimes without our custom header). Anything other than 200 is
 *  reported to the user as "Please check your endpoint, unable to send
 *  request to mentioned api." So this handler:
 *   - answers 200 to GET / HEAD (reachability probes)
 *   - answers 200 to POST with missing/wrong x-api-key (auth probes)
 *   - answers 200 to POST with empty or malformed body (shape probes)
 *   - only writes to the DB when the body is a real, parseable event
 *
 * Real events from production come with the correct x-api-key header
 * (SHIPROCKET_WEBHOOK_TOKEN) and a valid JSON body — those flow through
 * the normal status-mapping path.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, events, webhooksInbound } from "@/db/schema";
import { mapShiprocketStatus } from "@/lib/shiprocket";
import { notifyOrderEvent } from "@/lib/notifications/notify";
import { releaseOrderHoldsBestEffort } from "@/lib/inventory/release";
import { logWarn } from "@/lib/logger";

// DB status → customer notification on transition into that status.
const STATUS_NOTIFICATION = {
  SHIPPED: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
} as const;

type ShiprocketEvent = {
  awb?: string;
  current_status?: string;
  current_status_id?: number;
  order_id?: string;
  shipment_status?: string;
  scans?: Array<{ date: string; activity: string }>;
};

// IMPORTANT: each call MUST construct its own NextResponse. Reusing a
// module-level constant breaks because Response bodies are single-use streams.
const ok = () => NextResponse.json({ ok: true });

export async function GET() {
  return ok();
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: Request) {
  // Auth: NEVER fail open. If the token isn't configured we cannot trust any
  // POST body, so we ack 200 (so Shiprocket's validator stays happy) but skip
  // all DB writes. With the token set, a missing/wrong header is treated as a
  // probe and acked without writes; only a correct header reaches the DB path.
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!expected) {
    logWarn("courier:webhook", "SHIPROCKET_WEBHOOK_TOKEN unset — refusing to process events");
    return ok();
  }
  if (req.headers.get("x-api-key") !== expected) {
    return ok();
  }

  // Body: empty / non-JSON → treat as a shape probe, ack 200.
  const rawBody = await req.text();
  if (!rawBody.trim()) return ok();

  let event: ShiprocketEvent;
  try {
    event = JSON.parse(rawBody) as ShiprocketEvent;
  } catch {
    return ok();
  }

  // Real-event path. Dedup on our ORDER ID first (globally unique per order) so
  // an AWB-less event for one order can't collide with another order's event;
  // fall back to AWB only when no order id is present.
  const dedupSubject = event.order_id ?? event.awb ?? "unknown";
  const externalId = `${dedupSubject}::${event.current_status ?? event.shipment_status ?? "unknown"}::${event.current_status_id ?? 0}`;

  try {
    await db.insert(webhooksInbound).values({
      source: "shiprocket",
      externalId,
      payload: event,
      processed: false,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    let order = null;
    if (event.awb) {
      [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.awbCode, event.awb));
    }
    if (!order && event.order_id) {
      [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, event.order_id));
    }

    if (!order) {
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
      if (mapped === "DELIVERED" && !order.deliveredAt)
        updates.deliveredAt = now;
      if (mapped === "CANCELLED" && !order.cancelledAt)
        updates.cancelledAt = now;
      await db.update(orders).set(updates).where(eq(orders.id, order.id));

      // Fire the matching customer notification on this transition.
      const tpl = STATUS_NOTIFICATION[mapped as keyof typeof STATUS_NOTIFICATION];
      if (tpl) await notifyOrderEvent(order.id, tpl);

      // A cancelled shipment returns its reserved stock + coupon to the pool.
      if (mapped === "CANCELLED") {
        await releaseOrderHoldsBestEffort(order.id, "CANCELLED");
      }
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
