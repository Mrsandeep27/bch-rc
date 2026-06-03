/**
 * Outbox writer. Inserting a row here doesn't block the customer's checkout
 * response; the cron worker drains the outbox out-of-band.
 *
 * Exactly-once: every notification carries a `dedupKey` (default
 * `${orderId}:${template}:${channel}`) under a UNIQUE constraint. Enqueue is
 * ON CONFLICT DO NOTHING, so /verify and the Razorpay webhook both enqueuing
 * the same PAYMENT_CAPTURED notification produce exactly one outbox row per
 * channel. Returns the row id of the existing or newly-created row, or null if
 * it could not be resolved.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationsOutbox } from "@/db/schema";
import type { EmailPayload, NotificationTemplate } from "./templates";

export type NotificationChannel = "email" | "whatsapp";

export type EnqueueInput = {
  siteId: string | null;
  orderId: string;
  customerId: string;
  // "whatsapp" rows are only enqueued when WHATSAPP_ENABLED is on (see notify.ts);
  // the transport seam (send-whatsapp.ts) is live regardless.
  channel: NotificationChannel;
  template: NotificationTemplate;
  payload: EmailPayload;
  /** Override the default `${orderId}:${template}:${channel}` idempotency key. */
  dedupKey?: string;
};

export async function enqueueNotification(input: EnqueueInput): Promise<string | null> {
  const dedupKey =
    input.dedupKey ?? `${input.orderId}:${input.template}:${input.channel}`;

  const inserted = await db
    .insert(notificationsOutbox)
    .values({
      siteId: input.siteId,
      orderId: input.orderId,
      customerId: input.customerId,
      channel: input.channel,
      template: input.template,
      payload: input.payload,
      dedupKey,
    })
    .onConflictDoNothing({ target: notificationsOutbox.dedupKey })
    .returning({ id: notificationsOutbox.id });

  if (inserted.length > 0) return inserted[0].id;

  // Conflict → a row for this dedupKey already exists. Return its id so the
  // caller can still attempt an inline send (which is itself idempotent).
  const [existing] = await db
    .select({ id: notificationsOutbox.id })
    .from(notificationsOutbox)
    .where(eq(notificationsOutbox.dedupKey, dedupKey))
    .limit(1);
  return existing?.id ?? null;
}
