/**
 * GET /api/stock[?skuIds=a,b,c]
 *
 * Public, read-only live stock map keyed `${skuId}:${variantSlug}` (variant ""
 * for colourless SKUs). This is how the storefront (PDP + grid) reflects the
 * authoritative DB inventory instead of the static products.ts values — no
 * drift possible.
 *
 * Fail-soft: on a DB error we return an empty map (clients treat stock as
 * unknown and stay optimistic); the order-create endpoint remains the hard gate
 * so an optimistic add still can't oversell.
 */

import { NextResponse } from "next/server";
import { getStockMap } from "@/lib/inventory";
import { logError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Public live-stock map. A 10s CDN cache absorbs normal storefront reads, so
  // a high per-IP cap only sheds cache-busting enumeration of exact counts.
  const limited = rateLimit(req, { scope: "stock", limit: 90 });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("skuIds");
  const skuIds = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const stock = await getStockMap(skuIds);
    return NextResponse.json(
      { ok: true, stock },
      {
        headers: {
          "Cache-Control":
            "public, max-age=10, s-maxage=10, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    logError("api:stock", err);
    return NextResponse.json({ ok: false, stock: {} });
  }
}
