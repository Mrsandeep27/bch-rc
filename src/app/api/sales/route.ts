/**
 * GET /api/sales
 *
 * Public, read-only "units sold in the last 30 days" per SKU. Powers the real
 * social-proof line ("16 sold this month"), the "Selling fast" badge, and the
 * earned BESTSELLER badge on the storefront grid.
 *
 * Only SKUs at/above `MIN_PUBLIC_UNITS` are returned (see lib/sales.ts) — the
 * slow tail never reaches the browser.
 *
 * Fail-soft: on a DB error we return an empty map and the grid simply renders
 * without social proof. A product page must never 500 over a vanity metric.
 */

import { NextResponse } from "next/server";
import { getUnitsSoldBySku } from "@/lib/sales";
import { logError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Sales counts move far slower than stock, so a 5-minute CDN cache serves
  // nearly every read and the origin barely sees this query.
  const limited = rateLimit(req, { scope: "sales", limit: 60 });
  if (limited) return limited;

  try {
    const sales = await getUnitsSoldBySku();
    return NextResponse.json(
      { ok: true, sales },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (err) {
    logError("api:sales", err);
    return NextResponse.json({ ok: false, sales: {} });
  }
}
