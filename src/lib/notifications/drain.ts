/**
 * Outbox drainer — shared by the standalone /api/cron/send-notifications
 * route AND the daily /api/cron/sync-shipments route (Vercel Hobby allows
 * one cron job; the daily shipment sync calls this at the end as a backstop).
 *
 * Most notifications go out via the inline `sendImmediately` path from the
 * order-create handler. This is the durability net for anything that fails
 * inline.
 */

import { and, lte, isNull, asc, sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationsOutbox, events } from "@/db/schema";
import { sendEmail } from "./send-email";
import { renderTemplate, type EmailPayload, type NotificationTemplate } from "./templates";
import { logError } from "@/lib/logger";

const DEFAULT_BATCH = 50;
const MAX_ATTEMPTS = 10;

function nextDelaySeconds(attempt: number): number {
  if (attempt <= 1) return 60;
  if (attempt === 2) return 300;
  return 1800;
}

export async function drainNotificationsOutbox(
  batchSize: number = DEFAULT_BATCH,
): Promise<{ drained: number; sent: number; failed: number; exhausted: number }> {
  const due = await db
    .select()
    .from(notificationsOutbox)
    .where(
      and(
        isNull(notificationsOutbox.sentAt),
        lte(notificationsOutbox.nextAttemptAt, new Date()),
      ),
    )
    .orderBy(asc(notificationsOutbox.nextAttemptAt))
    .limit(batchSize);

  if (due.length === 0) return { drained: 0, sent: 0, failed: 0, exhausted: 0 };

  let sent = 0;
  let failed = 0;
  let exhausted = 0;

  for (const row of due) {
    const payload = row.payload as EmailPayload;
    let result: { ok: true; id: string } | { ok: false; error: string };

    try {
      const rendered = renderTemplate(row.template as NotificationTemplate, payload);
      result = await sendEmail({
        to: payload.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    if (result.ok) {
      await db
        .update(notificationsOutbox)
        .set({ sentAt: new Date(), lastError: null })
        .where(eq(notificationsOutbox.id, row.id));
      sent++;
      continue;
    }

    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(notificationsOutbox)
        .set({
          attempts,
          lastError: result.error.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + 24 * 3600 * 1000),
        })
        .where(eq(notificationsOutbox.id, row.id));

      if (row.orderId) {
        await db
          .insert(events)
          .values({
            siteId: row.siteId,
            orderId: row.orderId,
            customerId: row.customerId,
            type: "NOTIFICATION_EXHAUSTED",
            payload: { template: row.template, channel: row.channel, error: result.error.slice(0, 500) },
            source: "system",
          })
          .catch(() => {});
      }
      exhausted++;
      continue;
    }

    const nextAttemptAt = new Date(Date.now() + nextDelaySeconds(attempts) * 1000);
    await db
      .update(notificationsOutbox)
      .set({ attempts, lastError: result.error.slice(0, 500), nextAttemptAt })
      .where(eq(notificationsOutbox.id, row.id));
    failed++;
    logError("notifications:drain", new Error(result.error), {
      notificationId: row.id,
      template: row.template,
      attempts,
    });
  }

  return { drained: due.length, sent, failed, exhausted };
}

/**
 * Best-effort inline send. Called from order-create right after the outbox
 * row is inserted. Idempotent — if the row already has `sent_at`, no-op.
 * Failures are silently absorbed (the cron will retry).
 */
export async function sendOutboxRow(rowId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(notificationsOutbox)
    .where(eq(notificationsOutbox.id, rowId));
  if (!row || row.sentAt) return true;

  const payload = row.payload as EmailPayload;
  try {
    const rendered = renderTemplate(row.template as NotificationTemplate, payload);
    const result = await sendEmail({
      to: payload.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (result.ok) {
      await db
        .update(notificationsOutbox)
        .set({ sentAt: new Date(), lastError: null })
        .where(eq(notificationsOutbox.id, rowId));
      return true;
    }
    await db
      .update(notificationsOutbox)
      .set({
        attempts: row.attempts + 1,
        lastError: result.error.slice(0, 500),
        nextAttemptAt: new Date(Date.now() + 60_000),
      })
      .where(eq(notificationsOutbox.id, rowId));
    return false;
  } catch (err) {
    logError("notifications:inline-send", err, { rowId });
    return false;
  }
}
