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

// Statuses where polling is still useful — terminal statuses (DELIVERED,
// CANCELLED, RETURNED, REFUNDED) get skipped.
const IN_FLIGHT_STATUSES = ["PACKED", "SHIPPED"] as const;

export const maxDuration = 60; // give the function room for N tracking calls

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const inFlight = await db
    .select({
      id: orders.id,
      siteId: orders.siteId,
      customerId: orders.customerId,
      status: orders.status,
      shipmentId: orders.shiprocketShipmentId,
      awb: orders.awbCode,
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
      const mapped = mapShiprocketStatus(status.current_status);

      const changed = !!mapped && mapped !== o.status;
      if (changed && mapped) {
        const now = new Date();
        const updates: Partial<typeof orders.$inferInsert> = {
          status: mapped,
          updatedAt: now,
        };
        if (mapped === "SHIPPED" && !o.shippedAt) updates.shippedAt = now;
        if (mapped === "DELIVERED" && !o.deliveredAt) updates.deliveredAt = now;
        if (mapped === "CANCELLED" && !o.cancelledAt) updates.cancelledAt = now;

        await db.update(orders).set(updates).where(eq(orders.id, o.id));

        await db.insert(events).values({
          siteId: o.siteId,
          orderId: o.id,
          customerId: o.customerId,
          type: `POLL_SHIPROCKET_${mapped}`,
          payload: {
            awb: status.awb ?? o.awb,
            statusText: status.current_status,
            statusId: status.current_status_id,
            from: o.status,
            to: mapped,
          },
          source: "cron",
        });

        // Fire the matching customer notification on this transition. Guarded
        // by `changed` so a steady-state poll never re-notifies.
        const tpl = STATUS_NOTIFICATION[mapped as keyof typeof STATUS_NOTIFICATION];
        if (tpl) await notifyOrderEvent(o.id, tpl);
      }

      results.push({
        orderId: o.id,
        awb: status.awb ?? o.awb,
        from: o.status,
        to: mapped,
        changed,
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
