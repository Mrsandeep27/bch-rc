/**
 * GET /api/cron/reconcile — the surge safety net, run every few minutes.
 *
 * Sweeps abandoned PENDING orders (releasing reserved inventory + coupons),
 * drains the durable shipment job queue (creating shipments for any PAID order
 * that doesn't have one, reaping stuck leases), drains the notification outbox,
 * and alerts on permanently-failed shipment jobs.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We require it
 * so the endpoint can't be triggered by randoms.
 *
 * Idempotent + concurrency-safe: every step claims its work atomically, so an
 * overlapping invocation (or a manual trigger) can't double-act.
 */

import { NextResponse } from "next/server";
import { reconcileAll } from "@/lib/reconcile";
import { logError } from "@/lib/logger";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await reconcileAll();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    logError("cron:reconcile", err);
    return NextResponse.json({ ok: false, error: "reconcile failed" }, { status: 500 });
  }
}
