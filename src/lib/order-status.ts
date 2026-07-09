/**
 * Order-status vocabulary + the canonical groupings every analytics/funnel
 * surface must share. Pure and dependency-free (no drizzle/db import) so it can
 * be used from server queries, client components, and the math-verification
 * script alike.
 *
 * The string list MIRRORS the `order_status` pgEnum in src/db/schema.ts. If a
 * status is ever added/removed there, update ALL_ORDER_STATUSES here too — the
 * `satisfies` guards below make every group a compile-time subset of it, and the
 * `bucketOfStatus` "other" fallback means an unmirrored status degrades to a
 * visible "Other" bucket rather than silently vanishing from a total.
 */

export const ALL_ORDER_STATUSES = [
  "PENDING",
  "PENDING_COD_VERIFICATION",
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
  "FAILED",
  "ABANDONED",
] as const;

export type OrderStatus = (typeof ALL_ORDER_STATUSES)[number];

/**
 * "Live" money — orders that actually banked (or will, once COD is delivered).
 * Revenue charts, best-sellers and the "paid" funnel stage use exactly this set.
 */
export const PAID_STATUSES = [
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
] as const satisfies readonly OrderStatus[];

/** In-flight orders awaiting payment confirmation (incl. COD phone verify). */
export const PENDING_STATUSES = [
  "PENDING",
  "PENDING_COD_VERIFICATION",
] as const satisfies readonly OrderStatus[];

/**
 * The "failed / did-not-complete-as-a-sale" bucket for the status-mix report.
 * Includes post-sale reversals (RETURNED/REFUNDED) because they're no longer
 * live revenue — distinct from the funnel's "was this ever a real order?"
 * question below.
 */
export const FAILED_STATUSES = [
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
  "FAILED",
  "ABANDONED",
] as const satisfies readonly OrderStatus[];

/**
 * Statuses that represent a REAL placed order (genuine buyer intent) for the
 * conversion funnel's "Placed order" stage. Explicit whitelist, NOT count(*):
 * excludes the three "never actually an order" states (FAILED, ABANDONED,
 * CANCELLED) so abandoned carts and failed payment attempts can't inflate the
 * funnel. RETURNED/REFUNDED are kept — they WERE placed (and paid) — which also
 * guarantees PAID_STATUSES ⊆ VALID_ORDER_STATUSES, so "Paid" can never exceed
 * "Placed order".
 */
export const VALID_ORDER_STATUSES = [
  "PENDING",
  "PENDING_COD_VERIFICATION",
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[];

/** The inverse of VALID_ORDER_STATUSES — never a real order. */
export const INVALID_ORDER_STATUSES = [
  "CANCELLED",
  "FAILED",
  "ABANDONED",
] as const satisfies readonly OrderStatus[];

export type StatusBucket = "live" | "pending" | "failed" | "other";

const LIVE_SET = new Set<string>(PAID_STATUSES);
const PENDING_SET = new Set<string>(PENDING_STATUSES);
const FAILED_SET = new Set<string>(FAILED_STATUSES);

/**
 * Classify a status into the 4 status-mix buckets. Unknown/future statuses fall
 * to "other" so the status-mix denominator always includes every order — no
 * status can silently disappear from the total.
 */
export function bucketOfStatus(status: string): StatusBucket {
  if (LIVE_SET.has(status)) return "live";
  if (PENDING_SET.has(status)) return "pending";
  if (FAILED_SET.has(status)) return "failed";
  return "other";
}
