/**
 * Razorpay server-side helper.
 *
 * - `razorpay` instance for creating orders, fetching payments, refunding.
 * - `verifyRazorpaySignature()` for the post-checkout callback that proves
 *   the client didn't fake a "paid" state. Uses HMAC-SHA256 with the secret
 *   over `<orderId>|<paymentId>`.
 * - `verifyWebhookSignature()` for incoming Razorpay webhooks. Uses HMAC-SHA256
 *   with the **webhook secret** (different from the key secret) over the raw body.
 */

import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error(
    "NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set.",
  );
}

export const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export function verifyRazorpaySignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
  const expected = createHmac("sha256", keySecret!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpaySignature),
    );
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export type ConfirmCaptureResult =
  | { ok: true; payment: { id: string; amount: number; status: string; order_id: string; method: string | null } }
  | { ok: false; reason: string };

/**
 * Authoritative payment confirmation. After signature verification, call this
 * to hit Razorpay's API and confirm the payment is actually CAPTURED, belongs
 * to the expected order, and matches the expected amount.
 *
 * Why this is required even with a valid signature: the HMAC only proves
 * Razorpay generated a payment_id for an order_id. It does NOT prove the
 * money was captured — an authorized-only payment, a payment that was
 * subsequently voided/reversed by the bank, or a payment that timed out in
 * Razorpay's capture window would all still carry a valid signature but
 * deliver zero funds to the merchant.
 *
 * Returns ok:false with a reason for any mismatch — callers should reject
 * and leave the order PENDING (or transition to FAILED).
 */
export async function fetchAndConfirmCapture(params: {
  paymentId: string;
  expectedRazorpayOrderId: string;
  expectedAmountPaise: number;
}): Promise<ConfirmCaptureResult> {
  const { paymentId, expectedRazorpayOrderId, expectedAmountPaise } = params;
  let payment: { id: string; amount: number; status: string; order_id: string; method?: string | null };
  try {
    const fetched = (await razorpay.payments.fetch(paymentId)) as unknown as {
      id: string;
      amount: number;
      status: string;
      order_id: string;
      method?: string | null;
    };
    payment = fetched;
  } catch (err) {
    return {
      ok: false,
      reason: `Razorpay fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (payment.order_id !== expectedRazorpayOrderId) {
    return {
      ok: false,
      reason: `Payment order_id mismatch: ${payment.order_id} ≠ ${expectedRazorpayOrderId}`,
    };
  }
  if (payment.status !== "captured") {
    return {
      ok: false,
      reason: `Payment status is "${payment.status}", expected "captured"`,
    };
  }
  if (payment.amount !== expectedAmountPaise) {
    return {
      ok: false,
      reason: `Payment amount mismatch: ${payment.amount} ≠ ${expectedAmountPaise}`,
    };
  }
  return {
    ok: true,
    payment: {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      order_id: payment.order_id,
      method: payment.method ?? null,
    },
  };
}

// ============================================================
// Payment Links — for the admin manual-order flow.
// ============================================================

export type CreatePaymentLinkInput = {
  /** Amount in paise. ₹1,299 → 129900. */
  amountPaise: number;
  /** Our internal order id (PRC-XXXXXXXX) — round-trips back to us in the
   *  webhook payload as payment_link.reference_id so we can flip the order
   *  to PAID. UNIQUE in our orders table; reusing a value will collide. */
  referenceId: string;
  /** Customer-facing label on the hosted page. Keep under ~100 chars. */
  description: string;
  customer: {
    name: string;
    /** Indian phone in the form "+919xxxxxxxxx" or "9xxxxxxxxx" — Razorpay
     *  accepts both but normalize to E.164 (+91...) for SMS to fire. */
    contact: string;
    email?: string;
  };
  /** Where the customer is sent after they pay. Use the order details page so
   *  they land on a real "thank you" experience. */
  callbackUrl: string;
  /** Optional unix epoch seconds; if set, link expires unpaid after this. We
   *  pass +48h for manual orders so unpaid links don't hang around forever. */
  expireBySec?: number;
  /** Arbitrary key:value notes we can read back from the webhook. */
  notes?: Record<string, string>;
};

export type PaymentLinkRecord = {
  id: string;
  shortUrl: string;
  status: string;
  amount: number;
};

/**
 * Create a Razorpay Payment Link. Razorpay hosts the payment page and
 * automatically sends SMS + email to the customer on creation.
 *
 * Errors bubble up — caller should wrap in try/catch and roll back the
 * order row (or leave it PENDING so reconcile cleans it up later).
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput,
): Promise<PaymentLinkRecord> {
  // The Node SDK's `paymentLink.create` returns a loosely-typed any. We assert
  // the response shape we depend on.
  const resp = (await (razorpay as unknown as {
    paymentLink: {
      create: (body: Record<string, unknown>) => Promise<{
        id: string;
        short_url: string;
        status: string;
        amount: number;
      }>;
    };
  }).paymentLink.create({
    amount: input.amountPaise,
    currency: "INR",
    accept_partial: false,
    reference_id: input.referenceId,
    description: input.description,
    customer: {
      name: input.customer.name,
      contact: input.customer.contact,
      ...(input.customer.email ? { email: input.customer.email } : {}),
    },
    notify: { sms: true, email: !!input.customer.email },
    reminder_enable: true,
    callback_url: input.callbackUrl,
    callback_method: "get",
    ...(input.expireBySec ? { expire_by: input.expireBySec } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  }));
  return {
    id: resp.id,
    shortUrl: resp.short_url,
    status: resp.status,
    amount: resp.amount,
  };
}
