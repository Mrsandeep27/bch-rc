/**
 * GET /api/reviews/summary
 *
 * Public, read-only { skuId → { count, averageRating } } for APPROVED reviews.
 * Powers the star row on the storefront product cards.
 *
 * A SKU with no approved reviews is absent from the map, and its card renders
 * no star row. Nothing here fabricates a rating — see lib/reviews.ts.
 *
 * Fail-soft: on a DB error we return an empty map and the grid renders without
 * stars. A shopping page must never 500 over social proof.
 */

import { NextResponse } from "next/server";
import { getReviewSummaries } from "@/lib/reviews";
import { logError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

/** Same site the PDP reads reviews for. */
const REVIEWS_SITE_ID = "prc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, { scope: "reviews-summary", limit: 60 });
  if (limited) return limited;

  try {
    const summaries = await getReviewSummaries(REVIEWS_SITE_ID);
    return NextResponse.json(
      { ok: true, reviews: summaries },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (err) {
    logError("api:reviews-summary", err);
    return NextResponse.json({ ok: false, reviews: {} });
  }
}
