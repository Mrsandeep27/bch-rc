/**
 * Outbox writer. Inserting a row here doesn't block the customer's checkout
 * response; the cron worker drains the outbox out-of-band.
 *
 * Failure mode: if the INSERT itself fails (DB outage), we throw so the caller
 * can decide. Currently callers wrap in try/catch + log; the customer-facing
 * order still succeeds. The notification will need to be re-queued manually.
 */

import { db } from "@/db";
import { notificationsOutbox } from "@/db/schema";
import type { EmailPayload, NotificationTemplate } from "./templates";

export type EnqueueInput = {
  siteId: string | null;
  orderId: string;
  customerId: string;
  channel: "email"; // WhatsApp deferred to phase 2 (DLT registration)
  template: NotificationTemplate;
  payload: EmailPayload;
};

export async function enqueueNotification(input: EnqueueInput): Promise<string> {
  const [row] = await db
    .insert(notificationsOutbox)
    .values({
      siteId: input.siteId,
      orderId: input.orderId,
      customerId: input.customerId,
      channel: input.channel,
      template: input.template,
      payload: input.payload,
    })
    .returning({ id: notificationsOutbox.id });
  return row.id;
}
