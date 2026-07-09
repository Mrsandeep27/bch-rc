/**
 * Reviews — server helpers. Reads + writes for the per-SKU storefront
 * reviews module (X06) and the verified-purchase submission gate (R01).
 */

import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reviews, orders } from "@/db/schema";

export type StoreReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  customerName: string | null;
  customerCity: string | null;
  verifiedPurchase: boolean;
  images: string[];
  createdAt: Date;
};

export type ReviewAggregate = {
  count: number;
  averageRating: number;
  /** 1..5 → number of reviews at that exact rating. Used for the bar chart. */
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
};

const EMPTY_AGG: ReviewAggregate = {
  count: 0,
  averageRating: 0,
  histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/** Card-sized slice of an aggregate: enough for a star row, nothing more. */
export type ReviewSummary = { count: number; averageRating: number };

/** skuId → summary. A SKU with no APPROVED reviews is simply absent. */
export type ReviewSummaryMap = Record<string, ReviewSummary>;

/**
 * Count + average for EVERY SKU on a site, in one query.
 *
 * The storefront grid renders 3–20 cards; calling getReviewAggregateForSku per
 * card would be one round trip each. This is the grid's version.
 *
 * Absent means "no approved reviews" — the card then renders no star row at
 * all. There is deliberately no baseline/placeholder here: a rating is a claim
 * about what real customers said, and inventing one is a lie to the shopper
 * (and, for the AggregateRating markup Google reads, to Google). Compare
 * `src/lib/reviews-baseline.ts`, which the PDP still uses.
 */
export async function getReviewSummaries(siteId: string): Promise<ReviewSummaryMap> {
  try {
    const rows = await db
      .select({
        skuId: reviews.skuId,
        count: sql<number>`count(*)::int`,
        avg: sql<string>`round(avg(${reviews.rating})::numeric, 1)`,
      })
      .from(reviews)
      .where(and(eq(reviews.siteId, siteId), eq(reviews.status, "approved")))
      .groupBy(reviews.skuId);

    const map: ReviewSummaryMap = {};
    for (const r of rows) {
      const count = Number(r.count) || 0;
      const averageRating = Number(r.avg) || 0;
      if (r.skuId && count > 0) map[r.skuId] = { count, averageRating };
    }
    return map;
  } catch {
    // DB unreachable → grid renders without stars rather than 500-ing.
    return {};
  }
}

/**
 * Approved reviews for a SKU on a site, newest first. Limited at the
 * source so a SKU with 5,000 reviews doesn't ship the whole list to the
 * PDP. Pagination can be added if/when we hit that scale.
 */
export async function getApprovedReviewsForSku(
  siteId: string,
  skuId: string,
  limit = 30,
): Promise<StoreReview[]> {
  try {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        customerName: reviews.customerName,
        customerCity: reviews.customerCity,
        verifiedPurchase: reviews.verifiedPurchase,
        images: reviews.images,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.siteId, siteId),
          eq(reviews.skuId, skuId),
          eq(reviews.status, "approved"),
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
    return rows;
  } catch {
    // DB unreachable - return empty so PDP still renders. R01/R03 retention
    // dashboards will flag this separately.
    return [];
  }
}

/**
 * Count + average rating + histogram. One query so the PDP doesn't pay for
 * a second round trip. Used by both the in-page summary block AND the
 * AggregateRating JSON-LD that Google reads for star ratings in search.
 */
export async function getReviewAggregateForSku(
  siteId: string,
  skuId: string,
): Promise<ReviewAggregate> {
  try {
    const rows = await db
      .select({
        rating: reviews.rating,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.siteId, siteId),
          eq(reviews.skuId, skuId),
          eq(reviews.status, "approved"),
        ),
      )
      .groupBy(reviews.rating);

    if (rows.length === 0) return EMPTY_AGG;

    const histogram: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    let total = 0;
    let sum = 0;
    for (const r of rows) {
      const rating = r.rating as 1 | 2 | 3 | 4 | 5;
      const count = Number(r.count) || 0;
      if (rating >= 1 && rating <= 5) histogram[rating] = count;
      total += count;
      sum += rating * count;
    }
    return {
      count: total,
      averageRating: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
      histogram,
    };
  } catch {
    return EMPTY_AGG;
  }
}

/**
 * R01 — verified-purchase submission. The PDP / post-purchase page calls
 * this. We accept ONLY when:
 *   1. orderId resolves to a real order with status DELIVERED (or
 *      otherwise terminal-successful).
 *   2. The order contains the SKU being reviewed.
 *   3. No prior approved review for this (order, sku) — UNIQUE INDEX
 *      guarantees this at the DB level; the app pre-check gives a
 *      friendlier error than a constraint violation.
 *
 * Status defaults to "pending" so admin can moderate before display.
 */
export async function submitReview(input: {
  siteId: string;
  orderId: string;
  skuId: string;
  rating: number;
  title?: string;
  body?: string;
  customerName?: string;
  customerCity?: string;
  images?: string[];
}): Promise<
  | { ok: true; reviewId: string }
  | { ok: false; reason: string }
> {
  if (input.rating < 1 || input.rating > 5) {
    return { ok: false, reason: "Rating must be 1-5." };
  }

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      customerId: orders.customerId,
      items: orders.items,
      siteId: orders.siteId,
    })
    .from(orders)
    .where(eq(orders.id, input.orderId));

  if (!order) return { ok: false, reason: "Order not found." };
  if (order.siteId !== input.siteId) {
    return { ok: false, reason: "Order belongs to a different site." };
  }
  const items = (order.items as Array<{ skuId: string }>) ?? [];
  if (!items.some((i) => i.skuId === input.skuId)) {
    return { ok: false, reason: "That SKU isn't in this order." };
  }
  if (!["DELIVERED", "PAID", "PACKED", "SHIPPED"].includes(order.status)) {
    return { ok: false, reason: "Review unlocks after delivery." };
  }

  try {
    const [row] = await db
      .insert(reviews)
      .values({
        siteId: input.siteId,
        skuId: input.skuId,
        orderId: input.orderId,
        customerId: order.customerId ?? null,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body ?? null,
        customerName: input.customerName ?? null,
        customerCity: input.customerCity ?? null,
        verifiedPurchase: true,
        images: input.images ?? [],
        status: "pending",
        source: "post_purchase",
      })
      .onConflictDoUpdate({
        target: [reviews.orderId, reviews.skuId],
        set: {
          rating: input.rating,
          title: input.title ?? null,
          body: input.body ?? null,
          customerName: input.customerName ?? null,
          customerCity: input.customerCity ?? null,
          images: input.images ?? [],
          // Re-submission goes back to pending; admin re-moderates.
          status: "pending",
        },
      })
      .returning({ id: reviews.id });
    return { ok: true, reviewId: row.id };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Database error.",
    };
  }
}
