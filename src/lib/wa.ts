/**
 * Customer-directed WhatsApp helpers — "manual but prefilled" messaging.
 *
 * Without the official WhatsApp Cloud API we can't auto-SEND a message, but we
 * can build a wa.me deep link to the CUSTOMER's number with the whole message
 * pre-written, so a support/sales lead taps it → WhatsApp opens with the text
 * ready → they hit send. Used for order-confirmation nudges in /admin.
 *
 * (waLink() in theme.ts is the opposite — it chats the STORE's number; use this
 * when messaging a customer.)
 */

import { formatINR } from "@/lib/utils";

/** Normalise a stored 10-digit Indian number to +91 E.164. null if unusable. */
export function e164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  return digits.length === 10 ? `91${digits}` : digits;
}

/** wa.me link to a customer with a prefilled message. null if no valid phone. */
export function customerWaLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const num = e164(phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

type ConfirmOrder = {
  id: string;
  items: unknown;
  totalInr: number;
  paymentMethod: string;
  paymentStatus?: string | null;
  confirmationFeeInr?: number | null;
  trackingUrl?: string | null;
  awbCode?: string | null;
};

type ItemLike = { name?: string; skuId?: string; qty?: number };

/** The prefilled order-confirmation text. WhatsApp markup: *bold*. */
export function orderConfirmationMessage(
  order: ConfirmOrder,
  customerName?: string | null,
): string {
  const first = (customerName ?? "").trim().split(" ")[0] || "there";
  const items = (Array.isArray(order.items) ? order.items : []) as ItemLike[];
  const itemLines =
    items.map((i) => `• ${i.name ?? i.skuId ?? "Item"} × ${i.qty ?? 1}`).join("\n") ||
    "• your order";

  const fee = order.confirmationFeeInr ?? 0;
  let payLine: string;
  if (order.paymentMethod !== "COD") {
    payLine =
      order.paymentStatus === "PAID"
        ? `Paid ${formatINR(order.totalInr)} online ✅`
        : `Total ${formatINR(order.totalInr)} (paid online)`;
  } else if (fee > 0) {
    payLine =
      `${formatINR(fee)} paid to confirm ✅ · ` +
      `${formatINR(order.totalInr - fee)} to pay on delivery (COD)`;
  } else {
    payLine = `${formatINR(order.totalInr)} — Cash on Delivery`;
  }

  const track = order.trackingUrl
    ? `\n📍 Track here: ${order.trackingUrl}`
    : order.awbCode
      ? `\n📍 Tracking (AWB): ${order.awbCode}`
      : `\nWe'll share the tracking link the moment it ships.`;

  return (
    `Hi ${first}! 🏎️\n\n` +
    `Your *Pocket RC Cars* order *${order.id}* is confirmed ✅\n\n` +
    `${itemLines}\n\n` +
    `${payLine}\n\n` +
    `📦 Ships within 24 hrs from our Bangalore warehouse.` +
    `${track}\n\n` +
    `Any questions, just reply here 🙏\n— Team PRC Cars`
  );
}

/** Convenience: full confirmation deep link for an order + phone. */
export function orderConfirmationWaLink(
  order: ConfirmOrder,
  phone: string | null | undefined,
  customerName?: string | null,
): string | null {
  return customerWaLink(phone, orderConfirmationMessage(order, customerName));
}
