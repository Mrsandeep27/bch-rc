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
  // Shiprocket sends AWB as a JSON NUMBER in real payloads (e.g. 59629792084),
  // even though docs show it quoted. awb_code is a text column, so every read
  // of this must String()-coerce or the match query throws "text = integer".
  awb?: string | number;
  current_status?: string;
  current_status_id?: number;
  /** Shiprocket's OWN numeric order id (not ours). */
  order_id?: string | number;
  /** OUR order id (PRC-XXXX) — what we sent as order_id at shipment create. */
  channel_order_id?: string;
  sr_order_id?: string | number;
  courier_name?: string;
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
    // Ack 200 (validator tolerance) but leave a trace: a wrong token pasted in
    // the Shiprocket dashboard is otherwise indistinguishable from "never
    // configured" — every real event silently vanishes.
    logWarn("courier:webhook", "POST with missing/wrong x-api-key — event dropped");
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
  const dedupSubject =
    event.channel_order_id ?? event.order_id ?? event.awb ?? "unknown";
  const externalId = `${dedupSubject}::${event.current_status ?? event.shipment_status ?? "unknown"}::${event.current_status_id ?? 0}`;

  // Idempotent insert via ON CONFLICT DO NOTHING on (source, external_id).
  // Shiprocket's "Test Webhook" button sends the SAME payload every time, so
  // every test after the first is a duplicate. The previous code relied on
  // catching a Postgres 23505 by `err.code`, but drizzle/postgres-js wraps the
  // error so `code` wasn't reachable — the duplicate re-threw and the endpoint
  // 500'd, which Shiprocket reports as "unable to send request." Letting the DB
  // handle the conflict is robust and needs no error-shape guessing.
  const inserted = await db
    .insert(webhooksInbound)
    .values({
      source: "shiprocket",
      externalId,
      payload: event,
      processed: false,
    })
    .onConflictDoNothing({
      target: [webhooksInbound.source, webhooksInbound.externalId],
    })
    .returning({ id: webhooksInbound.id });

  if (inserted.length === 0) {
    // Already processed this exact event. Ack 200 and stop.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    // Match priority: AWB → channel_order_id (OUR PRC-XXXX id, which we sent
    // as order_id at shipment create) → order_id as ours (legacy/tests) →
    // order_id as Shiprocket's own id via orders.shiprocket_order_id. Real
    // Shiprocket payloads put THEIR numeric id in order_id, so pre-AWB events
    // only match through the last two paths.
    let order = null;
    if (event.awb) {
      [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.awbCode, String(event.awb)));
    }
    if (!order && event.channel_order_id) {
      [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, String(event.channel_order_id)));
    }
    if (!order && event.order_id) {
      [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, String(event.order_id)));
    }
    if (!order && event.order_id) {
      [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.shiprocketOrderId, String(event.order_id)));
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
      // A shipment can jump straight to DELIVERED between events — never
      // leave shipped_at NULL on a delivered order.
      if (mapped === "DELIVERED" && !order.shippedAt) updates.shippedAt = now;
      if (mapped === "CANCELLED" && !order.cancelledAt)
        updates.cancelledAt = now;
      // Backfill shipment facts the order row is missing (empty string counts
      // as missing — Shiprocket's create response persists "" couriers).
      if (event.awb && !order.awbCode) updates.awbCode = String(event.awb);
      if (event.courier_name && !(order.courierName ?? "").trim())
        updates.courierName = event.courier_name;
      await db.update(orders).set(updates).where(eq(orders.id, order.id));

      // Fire the matching customer notification on this transition.
      const tpl = STATUS_NOTIFICATION[mapped as keyof typeof STATUS_NOTIFICATION];
      if (tpl) await notifyOrderEvent(order.id, tpl);

      // A cancelled OR returned-to-origin shipment returns its reserved stock
      // + coupon to the pool. RTO is the common COD case: the parcel comes
      // back, so the stock is ours again. Idempotent via holds_released.
      if (mapped === "CANCELLED") {
        await releaseOrderHoldsBestEffort(order.id, "CANCELLED");
      } else if (mapped === "RETURNED") {
        await releaseOrderHoldsBestEffort(order.id, "RTO");
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
