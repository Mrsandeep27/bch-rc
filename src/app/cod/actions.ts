"use server";

/**
 * Server actions backing the /cod operator console.
 *
 *   confirmCodOrder(orderId)
 *     - Atomic PENDING_COD_VERIFICATION → PAID transition.
 *     - Enqueues the shipment job (durable, exactly-once) and runs it inline.
 *     - Fires the full ORDER_CONFIRMED email + WhatsApp.
 *     - Logs COD_VERIFIED so the timeline shows who/when.
 *
 *   rejectCodOrder(orderId, reason?)
 *     - Atomic PENDING_COD_VERIFICATION → CANCELLED transition.
 *     - Releases inventory + coupon holds.
 *     - Silent by design — no customer email/SMS (don't tip off pranksters).
 *     - Logs COD_REJECTED.
 *
 * The state-machine + money/shipment logic lives in @/lib/cod-verify so the
 * admin order-detail page reuses the exact same path. These wrappers add only
 * the /cod operator-cookie gate and the /cod revalidation. The atomic
 * conditional UPDATE inside the core means two operators clicking Confirm at
 * the same moment can't double-act — the second finds no eligible row.
 */

import { revalidatePath } from "next/cache";
import { isCodAuthenticated } from "@/lib/cod-auth";
import {
  confirmCodOrderCore,
  rejectCodOrderCore,
} from "@/lib/cod-verify";

export type CodActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function confirmCodOrder(orderId: string): Promise<CodActionResult> {
  if (!(await isCodAuthenticated())) {
    return { ok: false, error: "Not signed in." };
  }

  const res = await confirmCodOrderCore(orderId, { source: "admin" });
  if (res.ok) {
    revalidatePath("/cod");
    return { ok: true, message: res.message };
  }
  return res;
}

export async function rejectCodOrder(
  orderId: string,
  reason?: string,
): Promise<CodActionResult> {
  if (!(await isCodAuthenticated())) {
    return { ok: false, error: "Not signed in." };
  }

  const res = await rejectCodOrderCore(orderId, reason, { source: "admin" });
  if (res.ok) {
    revalidatePath("/cod");
    return { ok: true, message: res.message };
  }
  return res;
}
