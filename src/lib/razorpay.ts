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
