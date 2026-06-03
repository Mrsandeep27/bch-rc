/**
 * GET /api/cron/send-notifications
 *
 * Drains the notifications_outbox. Vercel Hobby allows one daily cron job,
 * which is reserved for /api/cron/sync-shipments — that handler also calls
 * drainNotificationsOutbox() at the end as the durable backstop. This route
 * exists for manual/CI triggers and for upgrading to per-minute cron on Pro.
 */

import { NextResponse } from "next/server";
import { drainNotificationsOutbox } from "@/lib/notifications/drain";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stats = await drainNotificationsOutbox();
  return NextResponse.json({ ok: true, ...stats });
}
