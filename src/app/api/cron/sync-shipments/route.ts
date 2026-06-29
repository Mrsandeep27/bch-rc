/**
 * /api/cron/sync-shipments — poll Shiprocket for in-transit orders.
 *
 * Replaces the Shiprocket webhook (their UI Save button is broken). Runs
 * every 10 minutes via Vercel Cron, pulls the latest tracking status for
 * each shipment that isn't terminal, and updates orders.status accordingly.
 *
 * Auth: Vercel Cron sends an `Authorization: Bearer <CRON_SECRET>` header
 * automatically when the route is listed in vercel.json's crons. We verify
 * that env var here so randoms can't trigger it.
 *
 * Idempotency: we only update orders.status when the mapped status differs
 * from the current row, and we stamp the matching *_at column once.
 */

import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { orders, events } from "@/db/schema";
import { getShipmentStatus, mapShiprocketStatus } from "@/lib/shiprocket";
import { drainNotificationsOutbox } from "@/lib/notifications/drain";
import { notifyOrderEvent } from "@/lib/notifications/notify";
import { logError } from "@/lib/logger";

// DB status → customer notification on transition into that status.
const STATUS_NOTIFICATION = {
  SHIPPED: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
} as const;

// Statuses we still poll Shiprocket for. PAID is included so orders whose AWB
// was assigned MANUALLY in the Shiprocket dashboard (auto-AWB is off, so they
// never advanced past PAID at create time) get their AWB + status pulled back
// here. Without PAID in this set those orders strand forever — invisible to
// this cron because it only ever looked at PACKED/SHIPPED. The
// `shiprocketShipmentId IS NOT NULL` guard below keeps brand-new PAID orders
// (never pushed to Shiprocket) out. Terminal statuses (DELIVERED, CANCELLED,
// RETURNED, REFUNDED) are excluded — nothing left to poll.
const IN_FLIGHT_STATUSES = ["PAID", "PACKED", "SHIPPED"] as const;

export const maxDuration = 60; // give the function room for N tracking calls

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // Silent catch-up mode. The first run after this fix ships will pull a
  // backlog of long-stuck orders forward in one sweep; without a guard that
  // sweep would fire a burst of "out for delivery"/"delivered" emails for old
  // orders. Trigger once with ?backfill=1 to sync statuses + AWBs WITHOUT
  // notifying, then let the scheduled cron notify only genuine go-forward
  // transitions from then on.
  const backfill = new URL(req.url).searchParams.get("backfill") === "1";

  const inFlight = await db
    .select({
      id: orders.id,
      siteId: orders.siteId,
      customerId: orders.customerId,
      status: orders.status,
      shipmentId: orders.shiprocketShipmentId,
      awb: orders.awbCode,
      packedAt: orders.packedAt,
      shippedAt: orders.shippedAt,
      deliveredAt: orders.deliveredAt,
      cancelledAt: orders.cancelledAt,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.status, IN_FLIGHT_STATUSES),
        isNotNull(orders.shiprocketShipmentId),
      ),
    );

  const results: Array<{
    orderId: string;
    awb: string | null;
    from: string;
    to: string | null;
    changed: boolean;
    error?: string;
  }> = [];

  for (const o of inFlight) {
    if (!o.shipmentId) continue;
    try {
      const status = await getShipmentStatus(o.shipmentId);
      const awbNow = status.awb ?? o.awb;
      let mapped = mapShiprocketStatus(status.current_status);

      // Promotion rule: an AWB existing means the parcel is at least PACKED.
      // Shiprocket's pre-pickup text ("AWB Assigned", "New", "Ready To Ship")
      // doesn't always map, so a PAID order that just got a manual AWB would
      // otherwise stay PAID. Treat "AWB now exists while still PAID" as PACKED
      // so it leaves the PAID limbo and joins the normal SHIPPED/DELIVERED path.
      if (!mapped && awbNow && o.status === "PAID") mapped = "PACKED";

      const awbJustLanded = !!awbNow && !o.awb;
      const statusChanged = !!mapped && mapped !== o.status;

      if (statusChanged || awbJustLanded) {
        const now = new Date();
        const updates: Partial<typeof orders.$inferInsert> = { updatedAt: now };
        if (statusChanged && mapped) {
          updates.status = mapped;
          if (mapped === "PACKED" && !o.packedAt) updates.packedAt = now;
          if (mapped === "SHIPPED" && !o.shippedAt) updates.shippedAt = now;
          if (mapped === "DELIVERED" && !o.deliveredAt) updates.deliveredAt = now;
          if (mapped === "CANCELLED" && !o.cancelledAt) updates.cancelledAt = now;
        }
        // Persist the AWB the instant Shiprocket reveals it, so the DB row and
        // the customer's tracking link finally carry a real number.
        if (awbJustLanded) {
          updates.awbCode = awbNow;
          updates.trackingUrl = `https://shiprocket.co/tracking/${awbNow}`;
        }

        await db.update(orders).set(updates).where(eq(orders.id, o.id));

        await db.insert(events).values({
          siteId: o.siteId,
          orderId: o.id,
          customerId: o.customerId,
          type: statusChanged
            ? `POLL_SHIPROCKET_${mapped}`
            : "POLL_SHIPROCKET_AWB",
          payload: {
            awb: awbNow,
            statusText: status.current_status,
            statusId: status.current_status_id,
            from: o.status,
            to: mapped ?? o.status,
            backfill,
          },
          source: "cron",
        });

        // Customer notifications — suppressed during a ?backfill=1 catch-up so
        // the one-time backlog sweep never blasts old customers.
        if (!backfill && statusChanged) {
          // First time an AWB appears and the order becomes PACKED → send the
          // "shipped, here's your tracking" email. The manual-AWB flow never
          // fired it at create time (no AWB existed then).
          if (mapped === "PACKED" && awbJustLanded) {
            await notifyOrderEvent(o.id, "SHIPMENT_CREATED");
          }
          const tpl = mapped
            ? STATUS_NOTIFICATION[mapped as keyof typeof STATUS_NOTIFICATION]
            : undefined;
          if (tpl) await notifyOrderEvent(o.id, tpl);
        }
      }

      results.push({
        orderId: o.id,
        awb: awbNow,
        from: o.status,
        to: mapped,
        changed: statusChanged || awbJustLanded,
      });
    } catch (err) {
      results.push({
        orderId: o.id,
        awb: o.awb,
        from: o.status,
        to: null,
        changed: false,
        error: String(err),
      });
    }
  }

  // Backstop: drain the notifications outbox as part of the same cron run.
  // On Vercel Hobby we only get one daily cron slot, so we co-locate.
  let notificationStats = { drained: 0, sent: 0, failed: 0, exhausted: 0 };
  try {
    notificationStats = await drainNotificationsOutbox(200);
  } catch (err) {
    logError("cron:drain-outbox", err);
  }

  return NextResponse.json({
    ok: true,
    polled: inFlight.length,
    changed: results.filter((r) => r.changed).length,
    errors: results.filter((r) => r.error).length,
    results,
    notifications: notificationStats,
  });
}
