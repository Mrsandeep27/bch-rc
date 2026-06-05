/**
 * Email templates for transactional notifications.
 * Plain-text and HTML kept in lock-step. Both rendered server-side; never
 * trust the payload — escape every variable before injecting into HTML.
 */

const BRAND = "PRC Cars";
const BASE_URL = "https://pocketrccars.com";
const SUPPORT_PHONE = "+91 63623 46498";

export type NotificationTemplate =
  | "ORDER_RECEIVED"
  | "ORDER_CONFIRMED"
  | "PAYMENT_CAPTURED"
  | "SHIPMENT_CREATED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

export type EmailPayload = {
  /** Destination email (email channel). */
  to: string;
  /** Destination phone in E.164-ish digits (whatsapp channel). */
  toPhone?: string | null;
  customerName: string;
  orderId: string;
  totalInr: number;
  paymentMethod: "UPI" | "CARD" | "NETBANKING" | "WALLET" | "COD";
  items: Array<{ name: string; qty: number; lineTotalInr: number; image?: string | null }>;
  awbCode?: string | null;
  courierName?: string | null;
  trackingUrl?: string | null;
  /** Razorpay payment id — shown as the transaction reference on receipts. */
  paymentReference?: string | null;
  /** Human delivery estimate, e.g. "Wed, 04 Jun–Fri, 06 Jun". */
  etaText?: string | null;
  /** Order price breakdown — rendered in the confirmation email so the
   *  customer can verify the prepaid discount and shipping were applied
   *  exactly as quoted at checkout. */
  subtotalInr?: number;
  shippingInr?: number;
  codFeeInr?: number;
  discountInr?: number;
  couponCode?: string | null;
  /** Shipping address — shown so the customer catches typos BEFORE dispatch.
   *  The single biggest source of RTO (return-to-origin) is wrong addresses,
   *  and an email lets the customer spot one in seconds. */
  shippingAddress?: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
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
    .map((i) => {
      const thumb = i.image
        ? `<img src="${escapeHtml(i.image.startsWith("http") ? i.image : `${BASE_URL}${i.image}`)}" alt="${escapeHtml(i.name)}" width="48" height="48" style="border-radius:8px;object-fit:cover;border:1px solid #eee;vertical-align:middle;margin-right:10px">`
        : "";
      return `<tr><td style="padding:6px 0">${thumb}<span style="vertical-align:middle">${escapeHtml(i.name)} × ${i.qty}</span></td><td style="padding:6px 0;text-align:right;vertical-align:middle">${formatINR(i.lineTotalInr)}</td></tr>`;
    })
    .join("");
}

function lineItemsText(items: EmailPayload["items"]): string {
  return items.map((i) => `  ${i.name} × ${i.qty} — ${formatINR(i.lineTotalInr)}`).join("\n");
}

const PAYMENT_METHOD_LABEL: Record<EmailPayload["paymentMethod"], string> = {
  UPI: "UPI",
  CARD: "Card",
  NETBANKING: "Net banking",
  WALLET: "Wallet",
  COD: "Cash on Delivery",
};

function priceBreakdown(p: EmailPayload): string {
  if (p.subtotalInr === undefined) return "";
  const rows: string[] = [];
  rows.push(
    `<tr><td style="padding:3px 0;color:#555">Subtotal</td><td style="padding:3px 0;text-align:right">${formatINR(p.subtotalInr)}</td></tr>`,
  );
  if (p.shippingInr !== undefined) {
    rows.push(
      `<tr><td style="padding:3px 0;color:#555">Shipping</td><td style="padding:3px 0;text-align:right">${p.shippingInr === 0 ? "FREE" : formatINR(p.shippingInr)}</td></tr>`,
    );
  }
  if (p.codFeeInr && p.codFeeInr > 0) {
    rows.push(
      `<tr><td style="padding:3px 0;color:#555">COD handling fee</td><td style="padding:3px 0;text-align:right">${formatINR(p.codFeeInr)}</td></tr>`,
    );
  }
  if (p.discountInr && p.discountInr > 0) {
    const label = p.couponCode
      ? `Online-pay bonus + coupon (${escapeHtml(p.couponCode)})`
      : "Online-pay bonus";
    rows.push(
      `<tr><td style="padding:3px 0;color:#0a7d2c">${label}</td><td style="padding:3px 0;text-align:right;color:#0a7d2c">-${formatINR(p.discountInr)}</td></tr>`,
    );
  }
  rows.push(
    `<tr><td style="padding-top:10px;border-top:1px solid #eee;font-weight:700">Total</td><td style="padding-top:10px;border-top:1px solid #eee;text-align:right;font-weight:700">${formatINR(p.totalInr)}</td></tr>`,
  );
  return rows.join("");
}

function priceBreakdownText(p: EmailPayload): string {
  if (p.subtotalInr === undefined) return `Total: ${formatINR(p.totalInr)}`;
  const lines: string[] = [`  Subtotal: ${formatINR(p.subtotalInr)}`];
  if (p.shippingInr !== undefined) {
    lines.push(`  Shipping: ${p.shippingInr === 0 ? "FREE" : formatINR(p.shippingInr)}`);
  }
  if (p.codFeeInr && p.codFeeInr > 0) {
    lines.push(`  COD fee: ${formatINR(p.codFeeInr)}`);
  }
  if (p.discountInr && p.discountInr > 0) {
    const label = p.couponCode
      ? `Online-pay bonus + coupon (${p.couponCode})`
      : "Online-pay bonus";
    lines.push(`  ${label}: -${formatINR(p.discountInr)}`);
  }
  lines.push(`  Total: ${formatINR(p.totalInr)}`);
  return lines.join("\n");
}

function shippingBlock(p: EmailPayload): string {
  if (!p.shippingAddress) return "";
  const a = p.shippingAddress;
  return `<div style="background:#f7f4ed;border-radius:12px;padding:14px 16px;margin:12px 0;font-size:14px">
<div style="font-weight:600;margin-bottom:4px">Shipping to</div>
<div style="color:#444;line-height:1.5">
${escapeHtml(a.fullName)}<br>
${escapeHtml(a.line1)}${a.line2 ? `, ${escapeHtml(a.line2)}` : ""}<br>
${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.pincode)}<br>
Phone: ${escapeHtml(a.phone)}
</div></div>`;
}

function shippingBlockText(p: EmailPayload): string {
  if (!p.shippingAddress) return "";
  const a = p.shippingAddress;
  return `Shipping to:
  ${a.fullName}
  ${a.line1}${a.line2 ? `, ${a.line2}` : ""}
  ${a.city}, ${a.state} ${a.pincode}
  Phone: ${a.phone}`;
}

/** Edit-window CTA — biggest RTO reducer. Catches wrong colour/address before
 *  dispatch. Both confirmation emails carry this. */
function editWindowBlock(): string {
  return `<div style="background:#fff8e1;border-radius:12px;padding:12px 14px;margin:12px 0;font-size:13px;color:#5a4a00">
<b>Need to change colour or address?</b> WhatsApp <a href="https://wa.me/91${SUPPORT_PHONE.replace(/\D/g, "")}" style="color:#5a4a00">${SUPPORT_PHONE}</a> within 2 hrs of placing your order. After that, we've already handed it to the courier.
</div>`;
}

function editWindowText(): string {
  return `Need to change colour or address? WhatsApp ${SUPPORT_PHONE} within 2 hrs of placing your order.`;
}

/** Replacement policy line — 7 days, manufacturing defects ONLY (no
 *  buyer-remorse refunds). */
function policyLine(): string {
  return `<p style="color:#777;font-size:12px;margin:14px 0 0">7-day replacement on manufacturing defects only — <a href="${BASE_URL}/policies/replacement" style="color:#777">full policy</a>.</p>`;
}

function policyLineText(): string {
  return `7-day replacement on manufacturing defects only — ${BASE_URL}/policies/replacement`;
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
    case "ORDER_RECEIVED": {
      // Placeholder email for COD: order is placed but NOT yet confirmed.
      // Our team has to call the customer to verify they really want it
      // (kills prank/kid orders). Customer learns: order is received,
      // we'll call to confirm within 24h, no dispatch yet. The full
      // ORDER_CONFIRMED email fires after the operator clicks Confirm.
      const subject = `Order ${p.orderId} received — we'll call to confirm`;
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Hi ${escapeHtml(p.customerName)}, we got your order.</h1>
<p style="color:#444">Order ID <b style="font-family:monospace">${escapeHtml(p.orderId)}</b></p>
<div style="background:#fff8e1;border-radius:12px;padding:14px 16px;margin:14px 0;font-size:14px;color:#5a4a00">
<b>Our team will call you within 24 hrs to confirm your order before dispatch.</b><br>
This is a Cash-on-Delivery order, so we ring every customer to verify the address and delivery time. Please pick up when we call from a Bangalore number.
</div>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${lineItems(p.items)}</table>
<table style="width:100%;border-collapse:collapse;margin:0 0 8px;font-size:14px">${priceBreakdown(p)}</table>
${shippingBlock(p)}
<p style="color:#444"><b>Cash on Delivery</b> — keep <b>${formatINR(p.totalInr)}</b> ready when the courier arrives (after we confirm).</p>
${editWindowBlock()}
<p style="color:#777;font-size:13px">If you didn't place this order or want to cancel, just reply to this email or WhatsApp ${SUPPORT_PHONE} — no questions asked.</p>
${policyLine()}`;
      const text = `Hi ${p.customerName}, we received your ${BRAND} order ${p.orderId}.

Our team will call you within 24 hrs to confirm your order before dispatch. This is a Cash-on-Delivery order so we ring every customer to verify. Please pick up when we call from a Bangalore number.

${lineItemsText(p.items)}
${priceBreakdownText(p)}
${shippingBlockText(p)}

Cash on Delivery — keep ${formatINR(p.totalInr)} ready when the courier arrives (after we confirm).

${editWindowText()}

Didn't place this order or want to cancel? Reply to this email or WhatsApp ${SUPPORT_PHONE} — no questions asked.

${policyLineText()}
— ${BRAND}`;
      return { subject, html: shell(subject, body), text };
    }
    case "ORDER_CONFIRMED": {
      const trackUrl = `${BASE_URL}/orders/${p.orderId}`;
      const subject = `Order ${p.orderId} confirmed — ${BRAND}`;
      const payLine =
        p.paymentMethod === "COD"
          ? `<p><b>Cash on Delivery</b> — keep <b>${formatINR(p.totalInr)}</b> ready when the courier arrives.</p>`
          : `<p>Payment of <b>${formatINR(p.totalInr)}</b> received via <b>${PAYMENT_METHOD_LABEL[p.paymentMethod]}</b>.</p>`;
      const payLineText =
        p.paymentMethod === "COD"
          ? `Payment method: Cash on Delivery — keep ${formatINR(p.totalInr)} ready.`
          : `Payment method: ${PAYMENT_METHOD_LABEL[p.paymentMethod]} — ${formatINR(p.totalInr)} received.`;
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Hi ${escapeHtml(p.customerName)}, we got your order.</h1>
<p style="color:#444">Order ID <b style="font-family:monospace">${escapeHtml(p.orderId)}</b></p>
${payLine}
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${lineItems(p.items)}</table>
<table style="width:100%;border-collapse:collapse;margin:0 0 8px;font-size:14px">${priceBreakdown(p)}</table>
${shippingBlock(p)}
${editWindowBlock()}
<p><a href="${trackUrl}" style="display:inline-block;background:#e11d2a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Track your order</a></p>
<p style="color:#444">Ships in 24 hrs from our Yelahanka, Bangalore warehouse via Shiprocket.${p.etaText ? ` Estimated delivery <b>${escapeHtml(p.etaText)}</b>.` : ""}</p>
${policyLine()}`;
      const text = `Hi ${p.customerName}, your ${BRAND} order ${p.orderId} is confirmed.
${payLineText}

${lineItemsText(p.items)}
${priceBreakdownText(p)}
${p.etaText ? `Estimated delivery: ${p.etaText}\n` : ""}
${shippingBlockText(p)}

${editWindowText()}

Track: ${trackUrl}

${policyLineText()}
Questions? WhatsApp ${SUPPORT_PHONE}.
— ${BRAND}`;
      return { subject, html: shell(subject, body), text };
    }
    case "PAYMENT_CAPTURED": {
      // This is the ONLY email a prepaid customer receives at order time
      // (mid-flight shipment/OFD emails are suppressed by design). It must
      // therefore double as the full order confirmation — items with the
      // variant/colour, totals, ETA, track-link, and the txn reference.
      const trackUrl = `${BASE_URL}/orders/${p.orderId}`;
      const subject = `Order ${p.orderId} confirmed — ${BRAND}`;
      const refLine = p.paymentReference
        ? `<p style="color:#444;font-size:12px">Transaction reference <b style="font-family:monospace">${escapeHtml(p.paymentReference)}</b> — keep this for your records.</p>`
        : "";
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Hi ${escapeHtml(p.customerName)}, payment received.</h1>
<p style="color:#444">Order ID <b style="font-family:monospace">${escapeHtml(p.orderId)}</b></p>
<p>${formatINR(p.totalInr)} captured via <b>${PAYMENT_METHOD_LABEL[p.paymentMethod]}</b>. We'll dispatch within 24 hrs.${p.etaText ? ` Estimated delivery <b>${escapeHtml(p.etaText)}</b>.` : ""}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${lineItems(p.items)}</table>
<table style="width:100%;border-collapse:collapse;margin:0 0 8px;font-size:14px">${priceBreakdown(p)}</table>
${shippingBlock(p)}
${editWindowBlock()}
<p><a href="${trackUrl}" style="display:inline-block;background:#e11d2a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Track your order</a></p>
<p style="color:#444">Ships in 24 hrs from our Yelahanka, Bangalore warehouse via Shiprocket.</p>
${refLine}
${policyLine()}`;
      const text = `Hi ${p.customerName}, your ${BRAND} order ${p.orderId} is confirmed.
Payment of ${formatINR(p.totalInr)} received via ${PAYMENT_METHOD_LABEL[p.paymentMethod]}. Dispatching within 24 hrs.

${lineItemsText(p.items)}
${priceBreakdownText(p)}
${p.etaText ? `Estimated delivery: ${p.etaText}\n` : ""}
${shippingBlockText(p)}

${editWindowText()}

Track: ${trackUrl}
${p.paymentReference ? `\nTransaction ref: ${p.paymentReference}\n` : ""}
${policyLineText()}
Questions? WhatsApp ${SUPPORT_PHONE}.
— ${BRAND}`;
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
      const itemsBlock = p.items.length
        ? `<p style="color:#444;margin-bottom:4px">What's in this shipment:</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 12px;font-size:14px">${lineItems(p.items)}</table>`
        : "";
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Your order is on the way</h1>
<p>Order <b style="font-family:monospace">${escapeHtml(p.orderId)}</b> has shipped.</p>
${itemsBlock}${trackLine}${trackBtn}`;
      const text = `Your ${BRAND} order ${p.orderId} has shipped.
${lineItemsText(p.items)}
${p.awbCode ? `AWB: ${p.awbCode}${p.courierName ? ` via ${p.courierName}` : ""}\n` : ""}${p.trackingUrl ? `Track: ${p.trackingUrl}\n` : ""}`;
      return { subject, html: shell(subject, body), text };
    }
    case "OUT_FOR_DELIVERY": {
      const subject = `Order ${p.orderId} out for delivery`;
      const itemsBlock = p.items.length
        ? `<table style="width:100%;border-collapse:collapse;margin:8px 0 0;font-size:14px">${lineItems(p.items)}</table>`
        : "";
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Out for delivery today</h1>
<p>${p.courierName ? `${escapeHtml(p.courierName)} is delivering` : "Your courier is delivering"} order <b style="font-family:monospace">${escapeHtml(p.orderId)}</b> today.</p>
${itemsBlock}
${p.paymentMethod === "COD" ? `<p>Have <b>${formatINR(p.totalInr)}</b> ready for cash on delivery.</p>` : ""}`;
      const text = `Your ${BRAND} order ${p.orderId} is out for delivery today.
${lineItemsText(p.items)}${p.paymentMethod === "COD" ? `\nCash on delivery: ${formatINR(p.totalInr)}.` : ""}`;
      return { subject, html: shell(subject, body), text };
    }
    case "DELIVERED": {
      const subject = `Order ${p.orderId} delivered — drift it`;
      const itemsBlock = p.items.length
        ? `<p style="color:#444;margin-bottom:4px">Delivered:</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 12px;font-size:14px">${lineItems(p.items)}</table>`
        : "";
      const body = `
<h1 style="font-size:24px;margin:14px 0 4px">Delivered</h1>
<p>Your ${BRAND} arrived. Tag <a href="https://instagram.com/164prccars">@164prccars</a> on Instagram for a reshare.</p>
${itemsBlock}<p>7-day replacement on any manufacturing defect — WhatsApp ${SUPPORT_PHONE} with your order ID.</p>`;
      const text = `Your ${BRAND} order ${p.orderId} was delivered.
${lineItemsText(p.items)}
Tag @164prccars on IG for a reshare. 7-day defect replacement — WhatsApp ${SUPPORT_PHONE}.`;
      return { subject, html: shell(subject, body), text };
    }
  }
}

/**
 * WhatsApp body for a template. Plain text (WhatsApp doesn't render HTML); we
 * reuse the email plain-text where it already reads well. Kept separate so the
 * messaging team can tune WhatsApp copy without touching email. Wired through
 * the same outbox/drain machinery as email — only the transport differs.
 */
export function renderWhatsApp(
  template: NotificationTemplate,
  p: EmailPayload,
): { text: string } {
  const track = `${BASE_URL}/orders/${p.orderId}`;
  switch (template) {
    case "ORDER_RECEIVED":
      return {
        text: `📥 *${BRAND}* — order *${p.orderId}* received.\nOur team will call you within 24 hrs to confirm before dispatch (Cash on Delivery: ${formatINR(p.totalInr)}).\nDidn't place this? Reply STOP — no questions asked.`,
      };
    case "ORDER_CONFIRMED":
      return {
        text: `✅ *${BRAND}* — order *${p.orderId}* confirmed.\n${
          p.paymentMethod === "COD"
            ? `Pay ${formatINR(p.totalInr)} cash on delivery.`
            : `Payment of ${formatINR(p.totalInr)} received.`
        }${p.etaText ? `\nEstimated delivery: ${p.etaText}` : ""}\nTrack: ${track}`,
      };
    case "PAYMENT_CAPTURED": {
      const itemsLine = p.items.length
        ? `\nItems:\n${p.items.map((i) => `• ${i.name} × ${i.qty}`).join("\n")}`
        : "";
      return {
        text: `✅ *${BRAND}* — payment of ${formatINR(p.totalInr)} received for order *${p.orderId}*.${itemsLine}${
          p.paymentReference ? `\nTxn ref: ${p.paymentReference}` : ""
        }\nDispatching within 24 hrs. Track: ${track}`,
      };
    }
    case "SHIPMENT_CREATED": {
      const itemsLine = p.items.length
        ? `\nIn this shipment:\n${p.items.map((i) => `• ${i.name} × ${i.qty}`).join("\n")}`
        : "";
      return {
        text: `📦 *${BRAND}* — order *${p.orderId}* shipped!${itemsLine}${
          p.awbCode ? `\nAWB: ${p.awbCode}${p.courierName ? ` (${p.courierName})` : ""}` : ""
        }${p.trackingUrl ? `\nTrack: ${p.trackingUrl}` : `\nTrack: ${track}`}`,
      };
    }
    case "OUT_FOR_DELIVERY": {
      const itemsLine = p.items.length
        ? `\nDelivering: ${p.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}`
        : "";
      return {
        text: `🚚 *${BRAND}* — order *${p.orderId}* is out for delivery today!${itemsLine}${
          p.paymentMethod === "COD" ? `\nKeep ${formatINR(p.totalInr)} cash ready.` : ""
        }`,
      };
    }
    case "DELIVERED":
      return {
        text: `🎉 *${BRAND}* — order *${p.orderId}* delivered. Enjoy the drift! 7-day defect replacement — reply here with your order ID.`,
      };
  }
}
