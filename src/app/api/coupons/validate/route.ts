/**
 * GET /api/coupons/validate?code=X&siteId=prc&subtotalInr=1299&shippingInr=0
 *
 * Read-only preview. Returns the discount the customer WILL get without
 * incrementing used_count. The actual redemption happens transactionally in
 * /api/orders/create.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { validateCoupon, CouponError } from "@/lib/coupons";
import { rateLimit } from "@/lib/rate-limit";

const Query = z.object({
  code: z.string().min(1).max(40),
  siteId: z.string().min(1).max(40).default("prc"),
  subtotalInr: z.coerce.number().int().nonnegative(),
  shippingInr: z.coerce.number().int().nonnegative().default(0),
});

export async function GET(req: Request) {
  // Throttle to blunt coupon-code enumeration (distinct error messages make
  // this an oracle). 20/min/IP is far above any legitimate checkout use.
  const limited = rateLimit(req, { scope: "coupons:validate", limit: 20 });
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    code: url.searchParams.get("code"),
    siteId: url.searchParams.get("siteId") ?? "prc",
    subtotalInr: url.searchParams.get("subtotalInr"),
    shippingInr: url.searchParams.get("shippingInr") ?? 0,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid query" }, { status: 400 });
  }

  try {
    const result = await validateCoupon(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof CouponError) {
      return NextResponse.json({ ok: false, error: err.reason }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
}
