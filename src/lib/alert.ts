/**
 * Ops alerting. Used when an automated recovery path gives up — an exhausted
 * shipment job, a paid order that can't be fulfilled, etc. Alerts are durable
 * (an `events` row of type OPS_ALERT, queryable in the admin) and, when
 * OPS_ALERT_EMAIL is configured, also emailed best-effort.
 *
 * Never throws — alerting must not break the caller.
 */

import { db } from "@/db";
import { events } from "@/db/schema";
import { sendEmail } from "@/lib/notifications/send-email";
import { logError, logWarn } from "@/lib/logger";

export type AlertInput = {
  scope: string;
  message: string;
  siteId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  context?: Record<string, string | number | boolean | null | undefined>;
};

export async function alertOps(input: AlertInput): Promise<void> {
  logWarn(`alert:${input.scope}`, input.message, input.context ?? {});

  try {
    await db.insert(events).values({
      siteId: input.siteId ?? null,
      orderId: input.orderId ?? null,
      customerId: input.customerId ?? null,
      type: "OPS_ALERT",
      payload: {
        scope: input.scope,
        message: input.message,
        ...(input.context ?? {}),
      },
      source: "system",
    });
  } catch (err) {
    logError("alert:event", err, { scope: input.scope });
  }

  const to = process.env.OPS_ALERT_EMAIL;
  if (!to) return;
  try {
    const ctx = Object.entries(input.context ?? {})
      .map(([k, v]) => `${k}: ${v ?? "-"}`)
      .join("\n");
    await sendEmail({
      to,
      subject: `⚠️ [${input.scope}] ${input.message}`.slice(0, 120),
      html: `<p><strong>${input.scope}</strong></p><p>${input.message}</p><pre>${ctx}</pre>`,
      text: `${input.scope}\n${input.message}\n\n${ctx}`,
      // Dedup repeated alerts about the same order/scope within Resend.
      idempotencyKey: `alert:${input.scope}:${input.orderId ?? "global"}`,
    });
  } catch (err) {
    logError("alert:email", err, { scope: input.scope });
  }
}
