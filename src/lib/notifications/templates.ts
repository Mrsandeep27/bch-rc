/**
 * Email templates for transactional notifications.
 * Plain-text and HTML kept in lock-step. Both rendered server-side; never
 * trust the payload — escape every variable before injecting into HTML.
 */

const BRAND = "PRC Cars";
const BASE_URL = "https://pocketrccars.com";
const SUPPORT_PHONE = "+91 63623 46498";

export type NotificationTemplate =
  | "ORDER_CONFIRMED"
  | "PAYMENT_CAPTURED"
  | "SHIPMENT_CREATED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

export type EmailPayload = {
  to: string;
  customerName: string;
  orderId: string;
  totalInr: number;
  paymentMethod: "UPI" | "CARD" | "NETBANKING" | "WALLET" | "COD";
  items: Array<{ name: string; qty: number; lineTotalInr: number }>;
  awbCode?: string | null;
  courierName?: string | null;
  trackingUrl?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatINR(paise: number): string {
  return `₹${paise.toLocaleString("en-IN")}`;
}

function lineItems(items: EmailPayload["items"]): string {
  return items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.name)} × ${i.qty}</td><td style="padding:6px 0;text-align:right">${formatINR(i.lineTotalInr)}</td></tr>`,
    )
    .join("");
}

function lineItemsText(items: EmailPayload["items"]): string {
  return items.map((i) => `  ${i.name} × ${i.qty} — ${formatINR(i.lineTotalInr)}`).join("\n");
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en-IN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f7f4ed;font-family:-apple-system,system-ui,Segoe UI,Helvetica,sans-serif;color:#0b0b0c">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
<div style="font-weight:900;font-size:22px;letter-spacing:-0.5px">${BRAND}</div>
${body}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<div style="font-size:12px;color:#666">Questions? WhatsApp ${SUPPORT_PHONE} with your order ID.</div>
</div></body></html>`;
}

export function renderTemplate(
  template: NotificationTemplate,
  p: EmailPayload,
): { subject: string; html: string; text: string } {
  switch (template) {
    case "ORDER_CONFIRMED": {
      const trackUrl = `${BASE_URL}/orders/${p.orderId}`;
      const subject = `Order ${p.orderId} confirmed — ${BRAND}`;
      const codBlock =
        p.paymentMethod === "COD"
          ? `<p>You'll pay <b>${formatINR(p.totalInr)}</b> in cash on delivery. No prepayment needed.</p>`
          : `<p>Payment of <b>${formatINR(p.totalInr)}</b> received. Receipt is attached to this order page.</p>`;
      const codBlockText =
        p.paymentMethod === "COD"
          ? `You'll pay ${formatINR(p.totalInr)} in cash on delivery.`
          : `Payment of ${formatINR(p.totalInr)} received.`;
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Hi ${escapeHtml(p.customerName)}, we got your order.</h1>
<p style="color:#444">Order ID <b style="font-family:monospace">${escapeHtml(p.orderId)}</b></p>
${codBlock}
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${lineItems(p.items)}
<tr><td style="padding-top:10px;border-top:1px solid #eee;font-weight:700">Total</td><td style="padding-top:10px;border-top:1px solid #eee;text-align:right;font-weight:700">${formatINR(p.totalInr)}</td></tr>
</table>
<p><a href="${trackUrl}" style="display:inline-block;background:#e11d2a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Track your order</a></p>
<p style="color:#444">Ships in 24 hrs from our Yelahanka, Bangalore warehouse via Shiprocket.</p>`;
      const text = `Hi ${p.customerName}, your ${BRAND} order ${p.orderId} is confirmed.
${codBlockText}

${lineItemsText(p.items)}
Total: ${formatINR(p.totalInr)}

Track: ${trackUrl}

Questions? WhatsApp ${SUPPORT_PHONE}.
— ${BRAND}`;
      return { subject, html: shell(subject, body), text };
    }
    case "PAYMENT_CAPTURED": {
      const subject = `Payment received for order ${p.orderId}`;
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Payment received</h1>
<p>${formatINR(p.totalInr)} captured for order <b style="font-family:monospace">${escapeHtml(p.orderId)}</b>. We'll dispatch within 24 hrs.</p>`;
      const text = `Payment of ${formatINR(p.totalInr)} received for order ${p.orderId}. Dispatching within 24 hrs.`;
      return { subject, html: shell(subject, body), text };
    }
    case "SHIPMENT_CREATED": {
      const subject = `Order ${p.orderId} shipped`;
      const trackLine = p.awbCode
        ? `<p>AWB: <b style="font-family:monospace">${escapeHtml(p.awbCode)}</b>${p.courierName ? ` · via ${escapeHtml(p.courierName)}` : ""}</p>`
        : "";
      const trackBtn = p.trackingUrl
        ? `<p><a href="${escapeHtml(p.trackingUrl)}" style="display:inline-block;background:#0b0b0c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Track shipment</a></p>`
        : "";
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Your order is on the way</h1>
<p>Order <b style="font-family:monospace">${escapeHtml(p.orderId)}</b> has shipped.</p>
${trackLine}${trackBtn}`;
      const text = `Your ${BRAND} order ${p.orderId} has shipped.
${p.awbCode ? `AWB: ${p.awbCode}${p.courierName ? ` via ${p.courierName}` : ""}\n` : ""}${p.trackingUrl ? `Track: ${p.trackingUrl}\n` : ""}`;
      return { subject, html: shell(subject, body), text };
    }
    case "OUT_FOR_DELIVERY": {
      const subject = `Order ${p.orderId} out for delivery`;
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Out for delivery today</h1>
<p>${p.courierName ? `${escapeHtml(p.courierName)} is delivering` : "Your courier is delivering"} order <b style="font-family:monospace">${escapeHtml(p.orderId)}</b> today.</p>
${p.paymentMethod === "COD" ? `<p>Have <b>${formatINR(p.totalInr)}</b> ready for cash on delivery.</p>` : ""}`;
      const text = `Your ${BRAND} order ${p.orderId} is out for delivery today.${p.paymentMethod === "COD" ? ` Cash on delivery: ${formatINR(p.totalInr)}.` : ""}`;
      return { subject, html: shell(subject, body), text };
    }
    case "DELIVERED": {
      const subject = `Order ${p.orderId} delivered — drift it`;
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Delivered</h1>
<p>Your ${BRAND} arrived. Tag <a href="https://instagram.com/164prccars">@164prccars</a> on Instagram for a reshare.</p>
<p>7-day replacement on any manufacturing defect — WhatsApp ${SUPPORT_PHONE} with your order ID.</p>`;
      const text = `Your ${BRAND} order ${p.orderId} was delivered. Tag @164prccars on IG for a reshare. 7-day defect replacement — WhatsApp ${SUPPORT_PHONE}.`;
      return { subject, html: shell(subject, body), text };
    }
  }
}
