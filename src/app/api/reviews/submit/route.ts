/**
 * POST /api/reviews/submit
 *
 * Verified-buyer review submission (R01). Body:
 *   { orderId, skuId, rating, title?, body?, customerName?, customerCity? }
 *
 * The order-id + sku gate happens in lib/reviews.submitReview — this route
 * is the thin HTTP wrapper. Returns 200 with { ok: true, reviewId } on
 * success and 422 with { ok: false, reason } when the gate rejects.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { submitReview } from "@/lib/reviews";

const Body = z.object({
  siteId: z.string().min(1).max(40).default("prc"),
  orderId: z.string().min(1).max(40),
  skuId: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
  customerName: z.string().max(80).optional(),
  customerCity: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    const json = await req.json();
    parsed = Body.safeParse(json);
  } catch {
    return NextResponse.json({ ok: false, reason: "Bad JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "Bad input" },
      { status: 400 },
    );
  }
  const result = await submitReview(parsed.data);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }
  return NextResponse.json(result);
}
