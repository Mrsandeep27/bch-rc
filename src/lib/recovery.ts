/**
 * Cart-recovery data layer — the single source of truth for "who abandoned a
 * cart and can still be called". Used by BOTH the full admin page
 * (/admin/recovery) and the scoped caller desk (/desk/[token]) so the two can
 * never drift apart. Server-only (touches the DB).
 *
 * A cart is "recoverable" if an order row exists but never got paid:
 *   PENDING   — order created, payment never captured (still open / pre-sweep)
 *   ABANDONED — reconcile sweep marked a stale PENDING dead (modal closed)
 *   FAILED    — Razorpay payment.failed: the attempt timed out or was declined.
 *               The HOTTEST lead — they actively tried to pay.
 * Plus step-1 "leads": customers who filled contact + address at checkout but
 * never reached the payment step (no order row) — an OPEN checkout_leads row.
 *
 * PENDING_COD_VERIFICATION is a different (manual) queue. CANCELLED / RETURNED /
 * REFUNDED are deliberate exits and stay out.
 */

import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { orders, checkoutLeads } from "@/db/schema";
import { formatINR } from "@/lib/utils";

const RECOVERABLE = ["PENDING", "ABANDONED", "FAILED"] as const;
const PAID = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;

// Don't show carts idle for less than this — the customer may still be mid-
// checkout. Tight (5 min) so the team can call a fresh drop-off while it's hot;
// safe because recent orders are Razorpay-verified first and leads gate on last
// activity (updatedAt), so someone still typing won't surface.
export const MIN_AGE_MIN = 5;
// Carts up to this age are "hot" — fresh lead, worth a nudge/call.
export const FRESH_DAYS = 14;
// FRESH_DAYS..COLD_DAYS = "cold lead" — still callable, lower odds. Past this we
// stop showing them (genuinely stale).
export const COLD_DAYS = 90;

export type Addr = { fullName?: string; phone?: string; city?: string; state?: string };
export type Item = { skuId?: string; name?: string; qty?: number };
export type Cart = {
  id: string;
  // "order" = a created-but-unpaid order. "lead" = a step-1 detail capture
  // (customer entered contact + address but never reached payment).
  kind: "order" | "lead";
  status: string;
  items: unknown;
  shippingAddress: unknown;
  totalInr: number;
  paymentMethod: string;
  source: string;
  customerId: string;
  placedAt: Date;
};

export type RecoveryData = {
  fresh: Cart[];
  cold: Cart[];
  freshValue: number;
  coldValue: number;
};

/** Normalise a stored 10-digit Indian number to +91 E.164 (for wa.me / tel:). */
export function e164(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function ageLabel(d: Date, nowMs: number): string {
  const mins = Math.floor((nowMs - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** WhatsApp deep link to the CUSTOMER (not the store) with a recovery nudge.
 *  `kind` tailors the copy: an order-cart got as far as a payment attempt; a
 *  lead only filled their details and never reached payment. */
export function recoveryWaLink(
  phone: string,
  name: string,
  ref: string,
  totalInr: number,
  kind: "order" | "lead",
): string {
  const first = (name || "there").split(" ")[0];
  const msg =
    kind === "lead"
      ? `Hi ${first}! This is Pocket RC Cars 🏎️ — you were ordering with us ` +
        `(${formatINR(totalInr)}) but didn't finish. Want me to help you ` +
        `complete it? You can pay online or Cash on Delivery, whichever is ` +
        `easier. Just reply here 🙂`
      : `Hi ${first}! This is Pocket RC Cars 🏎️ — you started an order ` +
        `(${ref}) for ${formatINR(totalInr)} but the payment didn't go ` +
        `through. Want me to help you finish it? You can also pay Cash on ` +
        `Delivery if that's easier. Just reply here 🙂`;
  return `https://wa.me/${e164(phone)}?text=${encodeURIComponent(msg)}`;
}

/**
 * Build the recoverable-cart list for the given sites, deduped per customer and
 * split into hot (<FRESH_DAYS) / cold buckets. Callers should run
 * recoverCapturedPayments() BEFORE this so anyone who just paid is excluded.
 */
export async function getRecoverableCarts(siteIds: string[]): Promise<RecoveryData> {
  if (siteIds.length === 0) {
    return { fresh: [], cold: [], freshValue: 0, coldValue: 0 };
  }

  const nowMs = Date.now();
  const since = new Date(nowMs - COLD_DAYS * 86_400_000);
  const until = new Date(nowMs - MIN_AGE_MIN * 60_000);
  const freshCutoff = nowMs - FRESH_DAYS * 86_400_000;

  const [cartRows, paidRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        status: orders.status,
        items: orders.items,
        shippingAddress: orders.shippingAddress,
        totalInr: orders.totalInr,
        paymentMethod: orders.paymentMethod,
        source: orders.source,
        customerId: orders.customerId,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.siteId, siteIds),
          inArray(orders.status, [...RECOVERABLE]),
          gte(orders.placedAt, since),
          lt(orders.placedAt, until),
        ),
      )
      .orderBy(desc(orders.placedAt))
      .limit(500),
    // Customers who DID pay in the window — exclude their abandoned attempts so
    // we never nudge someone who already bought (they retried and succeeded).
    db
      .selectDistinct({ customerId: orders.customerId })
      .from(orders)
      .where(
        and(
          inArray(orders.siteId, siteIds),
          inArray(orders.status, [...PAID]),
          gte(orders.placedAt, since),
        ),
      ),
  ]);

  const paidSet = new Set(paidRows.map((r) => r.customerId));

  // Step-1 leads: filled details, never reached payment (OPEN checkout_leads).
  // Wrapped defensively so the page still works if migration 0016 isn't applied.
  type LeadRow = {
    id: string;
    items: unknown;
    fullName: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    subtotalInr: number;
    customerId: string;
    updatedAt: Date;
  };
  let leadRows: LeadRow[] = [];
  try {
    leadRows = (await db
      .select({
        id: checkoutLeads.id,
        items: checkoutLeads.items,
        fullName: checkoutLeads.fullName,
        phone: checkoutLeads.phone,
        city: checkoutLeads.city,
        state: checkoutLeads.state,
        subtotalInr: checkoutLeads.subtotalInr,
        customerId: checkoutLeads.customerId,
        updatedAt: checkoutLeads.updatedAt,
      })
      .from(checkoutLeads)
      .where(
        and(
          inArray(checkoutLeads.siteId, siteIds),
          eq(checkoutLeads.status, "OPEN"),
          gte(checkoutLeads.updatedAt, since),
          lt(checkoutLeads.updatedAt, until),
        ),
      )
      .orderBy(desc(checkoutLeads.updatedAt))
      .limit(500)) as LeadRow[];
  } catch {
    leadRows = [];
  }

  const leadCarts: Cart[] = leadRows.map((l) => ({
    id: l.id,
    kind: "lead",
    status: "OPEN",
    items: l.items,
    shippingAddress: {
      fullName: l.fullName ?? undefined,
      phone: l.phone ?? undefined,
      city: l.city ?? undefined,
      state: l.state ?? undefined,
    },
    totalInr: l.subtotalInr,
    paymentMethod: "",
    source: "web",
    customerId: l.customerId,
    // "age" = time since last activity, so the caller sees how long ago the
    // buyer actually went quiet (not their first-ever visit).
    placedAt: l.updatedAt,
  }));

  // Order-carts (richer) take precedence over leads for the same customer.
  const merged = [
    ...(cartRows as Omit<Cart, "kind">[]).map((c) => ({ ...c, kind: "order" as const })),
    ...leadCarts,
  ].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());

  // One row per customer (their most recent unpaid attempt); skip anyone who paid.
  const seenCustomer = new Set<string>();
  const recoverable = merged.filter((c) => {
    if (paidSet.has(c.customerId)) return false;
    const key = c.customerId ?? c.id;
    if (seenCustomer.has(key)) return false;
    seenCustomer.add(key);
    return true;
  });

  const fresh = recoverable.filter((c) => c.placedAt.getTime() >= freshCutoff);
  const cold = recoverable.filter((c) => c.placedAt.getTime() < freshCutoff);
  const freshValue = fresh.reduce((sum, c) => sum + c.totalInr, 0);
  const coldValue = cold.reduce((sum, c) => sum + c.totalInr, 0);

  return { fresh, cold, freshValue, coldValue };
}
