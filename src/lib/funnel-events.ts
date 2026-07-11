/**
 * Funnel event vocabulary — the single source of truth for every user action
 * we record. Pure + dependency-free so it can be imported from client
 * components, the edge, and node routes alike.
 *
 * The ORDER of FUNNEL_STAGES is the canonical conversion path; the dashboard
 * renders drop-off between consecutive stages. Some events (payment_failed,
 * payment_cancelled, serviceability blocked) are NOT stages — they are
 * "leak" reasons that explain WHY a visitor fell out between two stages.
 */

export const FUNNEL_EVENTS = [
  "page_view", // any storefront page (path in `path`)
  "product_view", // a PDP / product card detail opened
  "add_to_cart", // added an item (also fired by Buy-Now)
  "view_cart", // opened the cart drawer
  "checkout_started", // landed on /checkout with a non-empty cart
  "serviceability_checked", // pincode checked (metadata.serviceable true/false)
  "payment_method_selected", // chose UPI/prepaid vs COD
  "order_submitted", // /api/orders/create succeeded (order row exists)
  "razorpay_opened", // Razorpay modal opened
  "payment_succeeded", // payment captured client-side
  "payment_failed", // Razorpay reported a failure (metadata.reason)
  "payment_cancelled", // customer dismissed the Razorpay modal
  "purchase", // order success page reached
  // --- engagement / leak signals (not funnel stages) ---
  "hero_cta_click", // tapped the hero primary CTA (metadata.variant)
  "whatsapp_click", // left to WhatsApp chat (metadata.placement: fab|header)
  // --- spin-wheel lead capture (hub "drift for your discount") ---
  "wheel_open", // popup shown (metadata.via: auto|tab)
  "wheel_spin", // tapped HIT THE THROTTLE (drifted)
  "wheel_lead", // claimed the code (metadata.code) — NO raw phone stored here
  "wheel_wa_claim", // tapped "send code to WhatsApp"
  // --- "Name your price" bargain game (exit-intent haggle) ---
  "bargain_ab", // A/B bucket assigned for this session (metadata.bucket: on|off)
  "bargain_open", // modal shown (metadata.trigger: back|idle|return|manual, skuId)
  "bargain_seen_no_play", // modal closed without ever making a guess
  "bargain_guess", // submitted a guess (metadata.outcome: close|low|won|lost)
  "bargain_won", // won a price (metadata.skuId, discountInr) — no code/PII here
  "bargain_lost", // used all 3 guesses without winning
  "bargain_checkout", // tapped "Buy now" → went to checkout with the won code
  "bargain_coupon_applied", // a BG- coupon validated at checkout (metadata.discountInr)
  "bargain_payment_success", // order paid on a BG- coupon (attribution; orders table is authoritative)
] as const;

export type FunnelEventType = (typeof FUNNEL_EVENTS)[number];

const FUNNEL_EVENT_SET = new Set<string>(FUNNEL_EVENTS);
export function isFunnelEvent(t: string): t is FunnelEventType {
  return FUNNEL_EVENT_SET.has(t);
}

/**
 * The ordered conversion funnel shown on the dashboard. Each stage maps to the
 * event(s) that mark a visitor as having reached it. A visitor counts toward a
 * stage if they fired ANY of its events at least once in the window.
 */
export type FunnelStage = {
  key: string;
  label: string;
  /** Events that count as reaching this stage. */
  events: FunnelEventType[];
};

// The top four stages are distinct-visitor counts from funnel_events; the bottom
// two ("order", "paid") are sourced from the ORDERS TABLE in getFunnelReport
// (authoritative — order_submitted/purchase events undercount real orders, which
// made the funnel show a false checkout→order cliff). The old "pincode" and
// "pay_open" event stages were dropped from the linear funnel: serviceability
// has its own panel, and "opened payment" was a noisy intermediate that broke
// the funnel shape once orders became real counts.
export const FUNNEL_STAGES: FunnelStage[] = [
  { key: "visit", label: "Visited site", events: ["page_view"] },
  { key: "product", label: "Viewed a product", events: ["product_view"] },
  { key: "cart", label: "Added to cart", events: ["add_to_cart"] },
  { key: "checkout", label: "Started checkout", events: ["checkout_started"] },
  { key: "order", label: "Placed order", events: ["order_submitted"] },
  { key: "paid", label: "Paid", events: ["payment_succeeded", "purchase"] },
];

/** Max events accepted in a single ingest batch (abuse guard). */
export const MAX_FUNNEL_BATCH = 30;
